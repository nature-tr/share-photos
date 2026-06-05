import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useLoad, useDidHide, useDidShow, usePageScroll } from '@tarojs/taro';
import { getViewerShare, getThumbUrl, getMediumUrl, getOriginalUrl, requestJoin } from '@/api/share.api';
import { useAuth, API_BASE } from '@/stores/auth.store';
import { addBrowsingHistory, updateLastPosition, getLastPosition } from '@/utils/history';
import type { ShareDetail, ContributorInfo } from '@photo/shared/dto';
import './index.scss';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  if (m > 0) return `${m} 分钟`;
  return '不足 1 分钟';
}

export default function ViewerPage() {
  const user = useAuth((s) => s.user);
  const [album, setAlbum] = useState<ShareDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [joinStatus, setJoinStatus] = useState<'none' | 'loading' | 'pending' | 'accepted' | 'rejected'>('none');
  const [loadMore, setLoadMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [uploadingMore, setUploadingMore] = useState(false);
  const scrollTopRef = useRef(0);
  const scrollTargetRef = useRef(0);
  const PAGE_SIZE = 50;

  useLoad((options) => {
    const c = (options?.code as string) ?? '';
    setCode(c.toUpperCase());
  });

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setPage(1);
    (async () => {
      try {
        // 1. 加载第一页
        const firstRes = await getViewerShare(code, 1, PAGE_SIZE);
        if (cancelled) return;
        if (!firstRes.data) {
          setError(firstRes.error?.message ?? '相册不存在');
          setLoading(false);
          return;
        }
        const firstData = firstRes.data as ShareDetail;
        const totalPhotos = (firstRes.data as any).totalPhotos ?? firstData.photos?.length ?? 0;
        let allPhotos = [...firstData.photos];
        let currentPage = 1;
        let hasMorePages = (firstRes.data as any).hasMore ?? false;

        // 2. 恢复上次位置：自动加载到上次所在页
        const { photoCount: lastPhotoCount, scrollTop: lastScrollTop } = getLastPosition(code);
        const needPages = Math.min(Math.ceil(Math.max(lastPhotoCount, allPhotos.length) / PAGE_SIZE), Math.ceil(totalPhotos / PAGE_SIZE));

        for (let pg = 2; pg <= needPages; pg++) {
          const pageRes = await getViewerShare(code, pg, PAGE_SIZE);
          if (cancelled) return;
          if (pageRes.data) {
            const pData = pageRes.data as ShareDetail;
            allPhotos = [...allPhotos, ...pData.photos];
            currentPage = pg;
            hasMorePages = (pageRes.data as any).hasMore ?? false;
          }
        }

        if (cancelled) return;
        // 一次性设置完整数据
        setAlbum({ ...firstData, photos: allPhotos } as ShareDetail);
        setPage(currentPage);
        setHasMore(hasMorePages);
        setIsOwner((firstRes.data as any).isOwner ?? false);
        addBrowsingHistory(code, firstData.title || '未命名相册', totalPhotos);

        // 3. 保存目标滚动位置供 useDidShow 使用
        if (lastScrollTop > 0) {
          scrollTargetRef.current = lastScrollTop;
        }

        // 检测贡献者状态
        const contributors: ContributorInfo[] = (firstRes.data as any).contributors ?? [];
        if (user && contributors.length > 0) {
          const me = contributors.find((c: ContributorInfo) => c.userId === user.id);
          setJoinStatus(me ? (me.status as any) : 'none');
        }
      } catch {
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, user]);

  // 页面显示时恢复滚动位置（此时 DOM 已完全渲染）
  useDidShow(() => {
    if (scrollTargetRef.current > 0 && album) {
      const target = scrollTargetRef.current;
      // 多次尝试，确保图片加载后页面高度足够
      [300, 600, 1000, 1500].forEach((delay) => {
        setTimeout(() => {
          Taro.pageScrollTo({ scrollTop: target, duration: 0 });
        }, delay);
      });
      scrollTargetRef.current = 0;  // 只恢复一次
    }
  });

  // 离开页面时保存浏览位置（真实滚动高度 + 已加载照片数）
  useDidHide(() => {
    if (!album) return;
    // 直接从 DOM 查询真实滚动位置，比 ref 更可靠
    Taro.createSelectorQuery()
      .selectViewport()
      .scrollOffset()
      .exec((res) => {
        const realScrollTop = res?.[0]?.scrollTop ?? scrollTopRef.current;
        updateLastPosition(code, album.photos.length, realScrollTop);
      });
  });

  // 实时跟踪滚动位置（作为 fallback）
  usePageScroll((e) => {
    scrollTopRef.current = e.scrollTop;
  });

  /** 加载更多照片 */
  async function handleLoadMore() {
    if (!album || loadMore || !hasMore) return;
    setLoadMore(true);
    const nextPage = page + 1;
    getViewerShare(code, nextPage, PAGE_SIZE).then((res) => {
      if (res.data) {
        const data = res.data as ShareDetail;
        setAlbum((prev) => prev ? { ...prev, photos: [...prev.photos, ...data.photos] } : data);
        setPage(nextPage);
        setHasMore((res.data as any).hasMore ?? false);
      }
    }).finally(() => setLoadMore(false));
  }

  /** 号主上传新照片 */
  async function handleOwnerUpload() {
    if (!album || !isOwner) return;
    Taro.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sizeType: ['original'],
      success: async (chooseRes) => {
        setUploadingMore(true);
        let done = 0;
        let failed = 0;
        for (const f of chooseRes.tempFiles) {
          try {
            const uploadRes = await Taro.uploadFile({
              url: `${API_BASE}/api/shares/${album.id}/photos`,
              filePath: f.tempFilePath,
              name: 'file',
              header: user ? { Authorization: `Bearer ${await useAuth.getState().getAccessToken()}` } : {},
            });
            if (uploadRes.statusCode === 201 || uploadRes.statusCode === 200) done++;
            else failed++;
          } catch { failed++; }
        }
        setUploadingMore(false);
        Taro.showToast({ title: `完成 ${done}${failed ? `，失败 ${failed}` : ''}`, icon: 'success' });
        // 重新加载首页
        getViewerShare(code, 1, PAGE_SIZE).then((res) => {
          if (res.data) {
            setAlbum(res.data as ShareDetail);
            setPage(1);
            setHasMore((res.data as any).hasMore ?? false);
          }
        });
      },
    });
  }

  /** 申请加入 */
  async function handleJoin() {
    if (!user) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    setJoinStatus('loading');
    try {
      const res = await requestJoin(code);
      if (res.data) {
        setJoinStatus(res.data.status as any);
        Taro.showToast({ title: '申请已提交，等待创建者审核', icon: 'none' });
      } else {
        setJoinStatus('none');
        Taro.showToast({ title: res.error?.message ?? '申请失败', icon: 'none' });
      }
    } catch {
      setJoinStatus('none');
      Taro.showToast({ title: '申请失败', icon: 'none' });
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalBytes = useMemo(() => album?.photos.reduce((s, p) => s + p.sizeBytes, 0) ?? 0, [album]);

  /** 点击网格中的图片 → 打开预览 */
  function openPreview(index: number) {
    setPreviewIdx(index);
  }

  /** 在预览弹窗中保存当前图片到相册 */
  async function saveCurrent(photoId: string) {
    const url = getOriginalUrl(code, photoId);
    try {
      const downloadRes = await Taro.downloadFile({ url });
      if (downloadRes.statusCode === 200) {
        await Taro.saveImageToPhotosAlbum({ filePath: downloadRes.tempFilePath });
        Taro.showToast({ title: '已保存到相册', icon: 'success' });
      }
    } catch {
      Taro.showToast({ title: '保存失败，请检查相册权限', icon: 'none' });
    }
  }

  async function saveAll() {
    if (!album || album.photos.length === 0) return;
    const totalCount = (album as any).totalPhotos ?? album.photos.length;
    const confirmed = await Taro.showModal({
      title: '保存全部到相册？',
      content: `共 ${totalCount} 张 · ${formatBytes(totalBytes)}\n下载并写入手机相册`,
    });
    if (!confirmed.confirm) return;
    setSaving(true);
    setSaveProgress({ done: 0, total: totalCount });

    // 如果还有未加载的照片，先后台获取全部ID（不渲染到UI）
    let allPhotos = [...album.photos];
    if (allPhotos.length < totalCount) {
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      for (let pg = 2; pg <= totalPages; pg++) {
        const pageRes = await getViewerShare(code, pg, PAGE_SIZE);
        if (pageRes.data) {
          allPhotos.push(...(pageRes.data as ShareDetail).photos);
        }
      }
    }

    let done = 0;
    let failed = 0;
    for (const p of allPhotos) {
      try {
        const url = getOriginalUrl(code, p.id);
        const downloadRes = await Taro.downloadFile({ url });
        if (downloadRes.statusCode === 200) {
          await Taro.saveImageToPhotosAlbum({ filePath: downloadRes.tempFilePath });
          done++;
        } else { failed++; }
      } catch { failed++; }
      setSaveProgress({ done: done + failed, total: totalCount });
    }
    setSaving(false);
    if (failed === 0) Taro.showToast({ title: `已保存 ${done} 张`, icon: 'success' });
    else Taro.showToast({ title: `完成 ${done}，失败 ${failed}`, icon: 'none' });
  }

  if (loading) return <View className="page"><View className="center"><Text>加载中…</Text></View></View>;

  if (error || !album) {
    return (
      <View className="page">
        <View className="center">
          <Text style={{ fontSize: '80rpx', marginBottom: '24rpx' }}>🚫</Text>
          <Text style={{ fontSize: '36rpx', fontWeight: 700 }}>{error ?? '加载失败'}</Text>
          <Text style={{ fontSize: '24rpx', color: '#9ca3af', marginTop: '8rpx', textAlign: 'center', padding: '0 48rpx' }}>
            请确认分享码是否正确，或该分享是否已过期
          </Text>
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <Text className="back-btn-text">返回首页</Text>
          </View>
        </View>
      </View>
    );
  }

  const photos = album.photos;
  const expired = album.expiresAt - now <= 0;

  return (
    <View className="page">
      {/* 顶栏 */}
      <View className="nav-bar">
        <View className="nav-back" onClick={() => Taro.navigateBack()}><Text className="nav-back-text">‹</Text></View>
        <View className="nav-info">
          <Text className="nav-title" numberOfLines={1}>{album.title || '相册'}</Text>
          <Text className="nav-sub">
            <Text className="nav-code">{album.code}</Text>
            <Text> · {photos.length} 张 · 剩余 {formatRemaining(album.expiresAt - now)}</Text>
          </Text>
        </View>
      </View>

      {/* 操作条 */}
      <View className="action-bar">
        <View style={{ flex: 1 }}>
          <Text className="action-info">
            {(album as any)?.totalPhotos ?? photos.length} 张 · {formatBytes(totalBytes)}
          </Text>
          <Text className="action-info-sub">原图已加密传输</Text>
        </View>
        {isOwner && !expired && (
          <View className="add-photo-btn" onClick={handleOwnerUpload}>
            <Text className="add-photo-btn-text">{uploadingMore ? '上传中…' : '+ 补充'}</Text>
          </View>
        )}
        <View
          className={`save-all-btn ${saving || photos.length === 0 ? 'save-all-disabled' : ''}`}
          onClick={() => !saving && photos.length > 0 && saveAll()}
        >
          <Text className="save-all-btn-text">{saving ? '保存中…' : '↓ 一键存到相册'}</Text>
        </View>
      </View>

      {/* 贡献者区域 + 申请按钮 */}
      {!expired && (
        <View className="contrib-section">
          {/* 已接受的贡献者头像行 */}
          {(album as any).contributors?.length > 0 && (
            <View className="contrib-row">
              {(album as any).contributors
                .filter((c: ContributorInfo) => c.status === 'accepted')
                .slice(0, 5)
                .map((c: ContributorInfo) => (
                  <View key={c.userId} className="contrib-avatar" title={c.displayName || c.email}>
                    <Text className="contrib-avatar-text">
                      {(c.displayName || c.email).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                ))}
              <Text className="contrib-label">
                {(album as any).contributors.filter((c: ContributorInfo) => c.status === 'accepted').length} 位贡献者
              </Text>
            </View>
          )}

          {/* 申请按钮 */}
          {!expired && (
            <View className="join-row">
              {joinStatus === 'accepted' ? (
                <View className="join-badge join-badge-accepted">
                  <Text className="join-badge-text">✓ 已是贡献者，可上传照片参与分享</Text>
                </View>
              ) : joinStatus === 'pending' ? (
                <View className="join-badge join-badge-pending">
                  <Text className="join-badge-text">⏳ 申请审核中…</Text>
                </View>
              ) : joinStatus === 'rejected' ? (
                <View className="join-badge join-badge-rejected">
                  <Text className="join-badge-text">申请已被拒绝</Text>
                  <View className="join-btn-sm" onClick={handleJoin}>
                    <Text className="join-btn-sm-text">重新申请</Text>
                  </View>
                </View>
              ) : (
                <View className="join-btn" onClick={handleJoin}>
                  <Text className="join-btn-text">
                    {joinStatus === 'loading' ? '申请中…' : '📷 申请加入成为贡献者'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 网格 */}
      {photos.length === 0 ? (
        <View className="center">
          <Text style={{ fontSize: '80rpx', marginBottom: '24rpx' }}>🖼️</Text>
          <Text style={{ fontSize: '36rpx', fontWeight: 700 }}>暂无图片</Text>
          <Text style={{ fontSize: '24rpx', color: '#9ca3af', marginTop: '8rpx' }}>该分享尚未上传任何图片</Text>
        </View>
      ) : (
        <View className="grid">
          {photos.map((p, i) => (
            <View key={p.id} className="grid-item" onClick={() => openPreview(i)}>
              <Image
                src={getThumbUrl(code, p.id)}
                className="grid-img"
                mode="aspectFill"
                lazyLoad
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          ))}
        </View>
      )}

      {/* 加载更多 */}
      {hasMore && (
        <View className="loadmore-row">
          <View className="loadmore-btn" onClick={handleLoadMore}>
            <Text className="loadmore-btn-text">
              {loadMore ? '加载中…' : `加载更多 · ${(album as any)?.totalPhotos ? `${(album as any).totalPhotos - photos.length} 张剩余` : ''}`}
            </Text>
          </View>
        </View>
      )}

      {/* 进度条 */}
      {saving && (
        <View className="progress-bar">
          <Text className="progress-text">保存到相册中 · {saveProgress.done}/{saveProgress.total}</Text>
          <View className="progress-track">
            <View className="progress-fill" style={{ width: `${saveProgress.total ? Math.round((saveProgress.done / saveProgress.total) * 100) : 0}%` }} />
          </View>
        </View>
      )}

      {/* 过期红条 */}
      {expired && (
        <View className="expired-bar">
          <Text className="expired-text">该分享已过期，图片已不可下载</Text>
        </View>
      )}

      {/* 大图预览弹窗 */}
      {previewIdx !== null && photos.length > 0 && (
        <PreviewModal
          photos={photos}
          code={code}
          startIdx={previewIdx}
          onClose={() => setPreviewIdx(null)}
          onSave={(photoId) => saveCurrent(photoId)}
        />
      )}
    </View>
  );
}

/* ---------- 全屏图片预览 ---------- */

interface PhotoMeta {
  id: string;
  originalName: string;
}

function PreviewModal({
  photos,
  code,
  startIdx,
  onClose,
  onSave,
}: {
  photos: PhotoMeta[];
  code: string;
  startIdx: number;
  onClose: () => void;
  onSave: (photoId: string) => void;
}) {
  const [current, setCurrent] = useState(startIdx);

  const handleSwiperChange = useCallback(
    (e: any) => {
      setCurrent(e.detail.current);
    },
    [],
  );

  return (
    <View className="preview-mask">
      {/* 顶栏 */}
      <View className="preview-header">
        <View className="preview-close" onClick={onClose}>
          <Text className="preview-close-text">关闭</Text>
        </View>
        <Text className="preview-count">
          {current + 1} / {photos.length}
        </Text>
        <View
          className="preview-save"
          onClick={() => onSave(photos[current]?.id)}
        >
          <Text className="preview-save-text">保存</Text>
        </View>
      </View>

      {/* 图片轮播 */}
      <Swiper
        className="preview-swiper"
        current={startIdx}
        onChange={handleSwiperChange}
        indicatorDots={false}
        circular
      >
        {photos.map((p) => (
          <SwiperItem key={p.id} className="preview-swiper-item">
            <Image
              src={getMediumUrl(code, p.id)}
              className="preview-img"
              mode="aspectFit"
            />
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  );
}
