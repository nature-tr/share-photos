import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { getViewerShare, getThumbUrl, getOriginalUrl } from '@/api/share.api';
import type { ShareDetail } from '@photo/shared/dto';
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
  const [album, setAlbum] = useState<ShareDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });

  useLoad((options) => {
    const c = (options?.code as string) ?? '';
    setCode(c.toUpperCase());
  });

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    getViewerShare(code).then((res) => {
      if (res.data) setAlbum(res.data as ShareDetail);
      else setError(res.error?.message ?? '相册不存在');
    }).catch(() => setError('加载失败')).finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalBytes = useMemo(() => album?.photos.reduce((s, p) => s + p.sizeBytes, 0) ?? 0, [album]);

  async function saveOne(photoId: string) {
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
    const confirmed = await Taro.showModal({
      title: '保存全部到相册？',
      content: `共 ${album.photos.length} 张 · ${formatBytes(totalBytes)}\n下载并写入手机相册`,
    });
    if (!confirmed.confirm) return;
    setSaving(true);
    setSaveProgress({ done: 0, total: album.photos.length });
    let done = 0;
    let failed = 0;
    for (const p of album.photos) {
      try {
        const url = getOriginalUrl(code, p.id);
        const downloadRes = await Taro.downloadFile({ url });
        if (downloadRes.statusCode === 200) {
          await Taro.saveImageToPhotosAlbum({ filePath: downloadRes.tempFilePath });
          done++;
        } else { failed++; }
      } catch { failed++; }
      setSaveProgress({ done: done + failed, total: album.photos.length });
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
        <Text className="action-info">{photos.length} 张 · {formatBytes(totalBytes)}</Text>
        <View
          className={`save-all-btn ${saving || photos.length === 0 ? 'save-all-disabled' : ''}`}
          onClick={() => !saving && photos.length > 0 && saveAll()}
        >
          <Text className="save-all-btn-text">{saving ? '保存中…' : '↓ 一键存到相册'}</Text>
        </View>
      </View>

      {/* 网格 */}
      {photos.length === 0 ? (
        <View className="center">
          <Text style={{ fontSize: '80rpx', marginBottom: '24rpx' }}>🖼️</Text>
          <Text style={{ fontSize: '36rpx', fontWeight: 700 }}>暂无图片</Text>
          <Text style={{ fontSize: '24rpx', color: '#9ca3af', marginTop: '8rpx' }}>该分享尚未上传任何图片</Text>
        </View>
      ) : (
        <View className="grid">
          {photos.map((p) => (
            <View key={p.id} className="grid-item" onClick={() => saveOne(p.id)}>
              <Image src={getThumbUrl(code, p.id)} className="grid-img" mode="aspectFill" lazyLoad />
            </View>
          ))}
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
    </View>
  );
}
