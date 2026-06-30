import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useDidHide } from '@tarojs/taro';
import { getViewerShare, getThumbUrl, getMediumUrl, getOriginalUrl, requestJoin, deletePhoto, deletePhotos } from '@/api/share.api';
import { useAuth } from '@/stores/auth.store';
import { useTaskStore } from '@/stores/task.store';
import { taskManager, type UploadItem } from '@/stores/task.manager';
import { addBrowsingHistory, updateLastPosition, getLastPosition } from '@/utils/history';
import { useNow, pickImagesFromAlbum } from '@/utils/hooks';
import { requestWriteAlbumPermission } from '@/utils/permission';
import QrSheet from '@/components/QrSheet';
import GlobalProgress from '@/components/GlobalProgress';
import { iconQrcode, iconImagePlus, iconTrash } from '@/assets/icons';
import type { ViewerAlbum, ContributorInfo } from '@photo/shared/dto';
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
  const [album, setAlbum] = useState<ViewerAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const now = useNow();
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [joinStatus, setJoinStatus] = useState<'none' | 'loading' | 'pending' | 'accepted' | 'rejected'>('none');
  const [loadMore, setLoadMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollTopRef = useRef(0);
  const lastScrollTargetRef = useRef(0);
  const scrolledOnceRef = useRef(false);
  const [svScrollTop, setSvScrollTop] = useState<number | undefined>(undefined);
  const PAGE_SIZE = 50;

  // 派生：是否正在保存（由 manager 任务状态驱动）
  const dlStatus = useTaskStore((s) => s.downloads[code]?.status);
  const saving = dlStatus === 'downloading' || dlStatus === 'paused';


  // 上传任务状态：完成时刷新 album
  const upStatus = useTaskStore((s) => (album?.id ? s.uploads[album.id]?.status : undefined));
  const lastUpStatusRef = useRef<typeof upStatus>(undefined);
  const uploadingMore = upStatus === 'uploading' || upStatus === 'paused';

  useLoad((options) => {
    const c = String(options?.code ?? '');
    if (!c) return;
    setCode(c.toUpperCase());
    // 只有从最近浏览点进来才恢复滚动位置
    if (options?.fromHistory === '1') {
      const { scrollTop: lastScrollTop } = getLastPosition(c.toUpperCase());
      lastScrollTargetRef.current = lastScrollTop;
    }
  });

  // 监听下载任务状态：从 paused 恢复到 downloading 时自动继续
  // ── manager 自驱动，page 不再需要触发恢复 ──
  // 上传完成 → 刷新 album（status 任意态变为 done 都触发一次刷新）
  useEffect(() => {
    const prev = lastUpStatusRef.current;
    lastUpStatusRef.current = upStatus;
    // prev 初始为 undefined，不能用 prev && 短路（否则首次 done 时跳过了）
    if (prev !== 'done' && upStatus === 'done') {
      getViewerShare(code, 1, PAGE_SIZE).then((res) => {
        if (res.data) {
          setAlbum(res.data);
          setPage(1);
          setHasMore(res.data.hasMore ?? false);
        }
      });
    }
  }, [upStatus, code]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setPage(1);
    scrolledOnceRef.current = false;
    (async () => {
      try {
        const firstRes = await getViewerShare(code, 1, PAGE_SIZE);
        if (cancelled) return;
        if (!firstRes.data) {
          setError(firstRes.error?.message ?? '相册不存在');
          setLoading(false);
          return;
        }
        const firstData = firstRes.data;
        const totalPhotos = firstData.totalPhotos ?? firstData.photos?.length ?? 0;
        let allPhotos = [...firstData.photos];
        let currentPage = 1;
        let hasMorePages = firstData.hasMore ?? false;

        const lastPhotoCount = getLastPosition(code).photoCount;
        const needPages = Math.min(
          Math.ceil(Math.max(lastPhotoCount, allPhotos.length) / PAGE_SIZE),
          Math.ceil(totalPhotos / PAGE_SIZE),
        );

        for (let pg = 2; pg <= needPages; pg++) {
          const pageRes = await getViewerShare(code, pg, PAGE_SIZE);
          if (cancelled) return;
          if (pageRes.data) {
            const pData = pageRes.data;
            allPhotos = [...allPhotos, ...pData.photos];
            currentPage = pg;
            hasMorePages = pData.hasMore ?? false;
          }
        }

        if (cancelled) return;
        setAlbum({ ...firstData, photos: allPhotos });
        setPage(currentPage);
        setHasMore(hasMorePages);
        setIsOwner(firstData.isOwner ?? false);
        addBrowsingHistory(code, firstData.title || '未命名相册', totalPhotos);

        const contributors: ContributorInfo[] = firstData.contributors ?? [];
        if (user && contributors.length > 0) {
          const me = contributors.find((c) => c.userId === user.id);
          setJoinStatus(me ? me.status : 'none');
        }
      } catch {
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, user?.id]);

  // ── 滚动恢复：改由 ScrollView scrollTop 受控属性驱动 ──
  useEffect(() => {
    if (loading || !album || lastScrollTargetRef.current <= 0 || scrolledOnceRef.current) return;
    scrolledOnceRef.current = true;
    const target = lastScrollTargetRef.current;
    let cancelled = false;
    const doScroll = () => {
      if (cancelled) return;
      setSvScrollTop(target);
    };
    if (typeof Taro.nextTick === 'function') Taro.nextTick(doScroll);
    else doScroll();
    const fallback = setTimeout(doScroll, 500);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [loading, album]);

  // ── ScrollView onScroll：跟踪滚动位置 + 防抖保存 ──
  const saveDebounce = useRef<any>(undefined);
  const handleScroll = (e: any) => {
    const st = e.detail?.scrollTop ?? 0;
    if (st === 0) return;
    scrollTopRef.current = st;
    if (!album) return;
    if (saveDebounce.current !== undefined) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      updateLastPosition(code, album.photos.length, st);
    }, 1000);
  };

  // ── 离开页面前立即写入 + 清理 debounce ──
  useDidHide(() => {
    if (saveDebounce.current !== undefined) {
      clearTimeout(saveDebounce.current);
      saveDebounce.current = undefined;
    }
    if (!album) return;
    const top = scrollTopRef.current;
    if (top > 0) updateLastPosition(code, album.photos.length, top);
  });

  // 组件卸载也清理 debounce timer
  useEffect(() => () => { if (saveDebounce.current !== undefined) clearTimeout(saveDebounce.current); }, []);

  /** 加载更多照片 */
  async function handleLoadMore() {
    if (!album || loadMore || !hasMore) return;
    setLoadMore(true);
    const nextPage = page + 1;
    try {
      const res = await getViewerShare(code, nextPage, PAGE_SIZE);
      if (res.data) {
        const data = res.data as ShareDetail;
        setAlbum((prev) => prev ? { ...prev, photos: [...prev.photos, ...data.photos] } : data);
        setPage(nextPage);
        setHasMore(res.data.hasMore ?? false);
      } else if (res.error) {
        Taro.showToast({ title: res.error.message ?? '加载失败', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      setLoadMore(false);
    }
  }

  /** 上传新照片（owner 或 accepted 贡献者均可） */
  async function handleOwnerUpload() {
    if (!album || !user) return;
    const picked = await pickImagesFromAlbum({ count: 9 });
    if (picked.items.length === 0) {
      if (picked.reason === 'denied') {
        Taro.showToast({ title: '已保存授权，请再次点击选图', icon: 'none', duration: 2500 });
      }
      return;
    }
    const items: UploadItem[] = picked.items.map((p) => ({
      id: Math.random().toString(36).slice(2),
      path: p.path,
      name: p.path.split('/').pop() || `photo-${Date.now()}.jpg`,
      size: p.size,
      status: 'pending',
    }));
    taskManager.startUpload(album.id, items, {
      title: album.title || '相册',
      ttl: 0,
      totalBytes: items.reduce((s, i) => s + (i.size ?? 0), 0),
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
        setJoinStatus(res.data.status);
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

  const totalBytes = useMemo(() => album?.totalBytes ?? album?.photos.reduce((s, p) => s + p.sizeBytes, 0) ?? 0, [album]);

  /** 点击网格中的图片 → 打开预览 */
  function openPreview(index: number) {
    setPreviewIdx(index);
  }

  /** 批量删除 */
  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    Taro.showModal({
      title: '批量删除',
      content: `确认删除选中的 ${selectedIds.size} 张照片？`,
      confirmColor: '#ef4444',
      success: async (m) => {
        if (!m.confirm) return;
        try {
          await deletePhotos(album!.id, Array.from(selectedIds));
          setAlbum((prev) => prev ? { ...prev, photos: prev.photos.filter((p) => !selectedIds.has(p.id)) } : prev);
          setSelectMode(false);
          setSelectedIds(new Set());
          Taro.showToast({ title: '已删除', icon: 'success' });
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  }

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId); else next.add(photoId);
      return next;
    });
  }

  /** 在预览弹窗中删除当前图片 */
  async function deleteCurrent(photoId: string) {
    if (!album) return;
    Taro.showModal({
      title: '删除照片',
      content: '确认从该分享中移除此照片？',
      confirmColor: '#ef4444',
      success: async (m) => {
        if (!m.confirm) return;
        try {
          await deletePhoto(album!.id, photoId);
          setAlbum((prev) => prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev);
          setPreviewIdx(null);
          Taro.showToast({ title: '已删除', icon: 'success' });
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  }

  /** 在预览弹窗中保存当前图片到相册 */
  async function saveCurrent(photoId: string) {
    const ok = await requestWriteAlbumPermission();
    if (!ok) return;
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
    const totalCount = album.totalPhotos ?? album.photos.length;
    const confirmed = await Taro.showModal({
      title: '保存全部到相册？',
      content: `共 ${totalCount} 张 · ${formatBytes(totalBytes)}\n下载并写入手机相册`,
    });
    if (!confirmed.confirm) return;

    // 收齐所有 photoId（manager 不发请求拉取分页）
    let allPhotos = [...album.photos];
    if (allPhotos.length < totalCount) {
      Taro.showLoading({ title: '加载列表中…' });
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      let hasError = false;
      for (let pg = 2; pg <= totalPages; pg++) {
        try {
          const pageRes = await getViewerShare(code, pg, PAGE_SIZE);
          if (pageRes.data) {
            allPhotos.push(...(pageRes.data as ShareDetail).photos);
          } else {
            hasError = true;
          }
        } catch {
          hasError = true;
        }
      }
      Taro.hideLoading();
      if (hasError) {
        Taro.showToast({ title: '部分照片加载失败，将保存已加载的照片', icon: 'none' });
      }
    }

    taskManager.startDownload(code, allPhotos.map((p) => ({ id: p.id })));
  }

  if (loading) return <ScrollView className="page" scrollY enhanced showScrollbar={false}><View className="center"><Text>加载中…</Text></View></ScrollView>;

  if (error || !album) {
    return (
      <ScrollView className="page" scrollY enhanced showScrollbar={false}>
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
      </ScrollView>
    );
  }

  const photos = album.photos;
  const expired = album.expiresAt - now <= 0;

  return (
    <>
      <ScrollView
        className="page"
        scrollY enhanced showScrollbar={false}
      scrollTop={svScrollTop}
      onScroll={handleScroll}
    >
      {/* 顶栏 */}
      <View className="nav-bar">
        <View className="nav-info">
          <View className="nav-sub">
            <Text className="nav-title" numberOfLines={1}>{album.title || '相册'}</Text>
            <Text className="nav-code">{album.code}</Text>
          </View>
          <Text className="nav-meta">
            {photos.length}/{(album?.totalPhotos ?? photos.length)}张 · {formatBytes(totalBytes)} · {formatRemaining(album.expiresAt - now)}
          </Text>
        </View>
        <View className="nav-qr" onClick={() => setQrVisible(true)}>
          <Image src={iconQrcode('#2563eb')} className="nav-qr-img" />
        </View>
      </View>

      {/* 操作条 */}
      <View className="action-bar">
        {user && !expired && (
          <>
            <View
              className={`add-photo-btn ${uploadingMore ? 'save-all-disabled' : ''}`}
              onClick={() => !uploadingMore && handleOwnerUpload()}
            >
              <Image src={iconImagePlus('#475569')} className="action-bar-icon" />
            </View>
            <View className="add-photo-btn" onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>
              <Image src={iconTrash('#ef4444')} className="action-bar-icon" />
            </View>
          </>
        )}
        {dlStatus === 'downloading' ? (
          <View className="save-all-btn save-all-disabled">
            <Text className="save-all-btn-text">保存中…</Text>
          </View>
        ) : dlStatus === 'paused' ? (
          <View
            className="save-all-btn"
            onClick={() => taskManager.resumeDownload(code)}
          >
            <Text className="save-all-btn-text">继续保存</Text>
          </View>
        ) : (
          <View
            className={`save-all-btn ${photos.length === 0 ? 'save-all-disabled' : ''}`}
            onClick={() => photos.length > 0 && saveAll()}
          >
            <Text className="save-all-btn-text">一键存到相册</Text>
          </View>
        )}
      </View>

      {/* 申请按钮（非 owner 非过期） */}
      {!expired && !isOwner && (
        <View className="contrib-section">
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
                <Image src={iconImagePlus('#ffffff')} className="join-btn-icon" />
                <Text className="join-btn-text">
                  {joinStatus === 'loading' ? '申请中…' : '申请加入成为贡献者'}
                </Text>
              </View>
            )}
          </View>
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
            <View
              key={p.id}
              className={`grid-item ${selectMode && selectedIds.has(p.id) ? 'grid-item-selected' : ''}`}
              onClick={() => selectMode ? toggleSelect(p.id) : openPreview(i)}
            >
              <Image
                src={getThumbUrl(code, p.id)}
                className="grid-img"
                mode="aspectFill"
                lazyLoad
                style={{ width: '100%', height: '100%' }}
              />
              {selectMode && (
                <View className={`grid-check ${selectedIds.has(p.id) ? 'grid-check-on' : ''}`}>
                  {selectedIds.has(p.id) && <Text className="grid-check-icon">✓</Text>}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* 加载更多 */}
      {hasMore && (
        <View className="loadmore-row">
          <View className="loadmore-btn" onClick={handleLoadMore}>
            <Text className="loadmore-btn-text">
              {loadMore ? '加载中…' : `加载更多 · ${album?.totalPhotos ? `${album.totalPhotos - photos.length} 张剩余` : ''}`}
            </Text>
          </View>
        </View>
      )}

      {/* 批量删除条 */}
      {selectMode && selectedIds.size > 0 && (
        <View className="batch-bar">
          <Text className="batch-bar-text">已选 {selectedIds.size} 张</Text>
          <View className="batch-delete-btn" onClick={handleBatchDelete}>
            <Text className="batch-delete-btn-text">删除</Text>
          </View>
        </View>
      )}

      {/* 过期红条 */}
      {expired && (
        <View className="expired-bar">
          <Text className="expired-text">该分享已过期，图片已不可下载</Text>
        </View>
      )}

      {/* QR 码弹层 */}
      <QrSheet visible={qrVisible} code={album.code} title={album.title || '未命名相册'} onClose={() => setQrVisible(false)} />

      {/* 大图预览弹窗 */}
      {previewIdx !== null && photos.length > 0 && (
        <PreviewModal
          photos={photos}
          code={code}
          startIdx={previewIdx}
          onClose={() => setPreviewIdx(null)}
          onSave={(photoId) => saveCurrent(photoId)}
          onDelete={user ? (photoId) => deleteCurrent(photoId) : undefined}
        />
      )}
      </ScrollView>
      <GlobalProgress />
    </>
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
  onDelete,
}: {
  photos: PhotoMeta[];
  code: string;
  startIdx: number;
  onClose: () => void;
  onSave: (photoId: string) => void;
  onDelete?: (photoId: string) => void;
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
        {onDelete && (
          <View className="preview-delete" onClick={() => onDelete(photos[current]?.id)}>
            <Text className="preview-delete-text">删除</Text>
          </View>
        )}
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
              onClick={() => {
                // 点击图片打开系统原生预览，支持双指缩放
                Taro.previewImage({
                  urls: photos.map((pp) => getOriginalUrl(code, pp.id)),
                  current: getOriginalUrl(code, p.id),
                });
              }}
            />
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  );
}
