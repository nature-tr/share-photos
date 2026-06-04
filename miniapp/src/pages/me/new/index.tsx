import { useMemo, useState } from 'react';
import { View, Text, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { MAX_PHOTOS_PER_SHARE, MAX_FILE_SIZE, TTL_PRESETS } from '@photo/shared';
import { createShare, uploadPhoto } from '@/api/share.api';
import './index.scss';

interface PickedItem {
  id: string;
  path: string;
  name: string;
  size?: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewSharePage() {
  const [title, setTitle] = useState('');
  const [ttl, setTtl] = useState<number>(TTL_PRESETS[2]!.seconds);
  const [items, setItems] = useState<PickedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === 'done').length;
    const error = items.filter((i) => i.status === 'error').length;
    const totalBytes = items.reduce((s, i) => s + (i.size ?? 0), 0);
    return { total, done, error, totalBytes };
  }, [items]);

  function pickImages() {
    const remaining = MAX_PHOTOS_PER_SHARE - items.length;
    if (remaining <= 0) {
      Taro.showToast({ title: `最多 ${MAX_PHOTOS_PER_SHARE} 张`, icon: 'none' });
      return;
    }
    Taro.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sizeType: ['original'],
      success: (res) => {
        const newItems: PickedItem[] = res.tempFiles.map((f) => {
          const name = f.tempFilePath.split('/').pop() || `photo-${Date.now()}.jpg`;
          return {
            id: Math.random().toString(36).slice(2),
            path: f.tempFilePath,
            name,
            size: f.size,
            status: 'pending',
          };
        });
        setItems((arr) => [...arr, ...newItems]);
      },
    });
  }

  function removeItem(id: string) {
    setItems((arr) => arr.filter((i) => i.id !== id));
  }

  async function start() {
    if (items.length === 0) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      // 1. 创建分享
      const shareRes = await createShare(ttl);
      if (shareRes.error || !shareRes.data) {
        Taro.showToast({ title: shareRes.error?.message ?? '创建失败', icon: 'none' });
        setSubmitting(false);
        return;
      }
      const share = shareRes.data;
      setCreated({ id: share.id, code: share.code });

      // 2. 逐张上传
      for (const it of items) {
        if (it.status === 'done') continue;
        setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, status: 'uploading', error: undefined } : x)));
        try {
          if (it.size && it.size > MAX_FILE_SIZE) {
            throw new Error(`文件过大（${formatBytes(it.size)}），单文件需 ≤ ${formatBytes(MAX_FILE_SIZE)}`);
          }
          const uploadRes = await uploadPhoto(share.id, it.path);
          if (uploadRes.statusCode === 200) {
            setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, status: 'done' } : x)));
          } else {
            throw new Error('上传失败');
          }
        } catch (err: any) {
          setItems((arr) =>
            arr.map((x) => (x.id === it.id ? { ...x, status: 'error', error: err?.message || '上传失败' } : x)),
          );
        }
      }
      Taro.showToast({ title: '上传完成', icon: 'success', duration: 2000 });
    } catch {
      Taro.showToast({ title: '创建分享失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }

  // 创建成功页
  if (created && stats.done === stats.total && stats.error === 0) {
    return (
      <View className="success-page">
        <View className="success-icon-box"><Text className="success-icon">✓</Text></View>
        <Text className="success-title">上传完成！</Text>
        <Text className="success-desc">把分享码或二维码发给朋友</Text>
        <View className="code-box">
          <Text className="code-box-label">分享码</Text>
          <Text className="code-big">{created.code}</Text>
          <Text className="code-meta">{stats.done} 张 · {formatBytes(stats.totalBytes)}</Text>
        </View>
        <View className="success-actions">
          <View className="btn-outline" onClick={() => Taro.redirectTo({ url: '/pages/me/shares/index' })}>
            <Text className="btn-outline-text">我的分享</Text>
          </View>
          <View
            className="btn-outline"
            onClick={() => Taro.redirectTo({ url: `/pages/viewer/detail/index?code=${created.code}` })}
          >
            <Text className="btn-outline-text">查看相册</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="page">
      {/* 表单 */}
      <View className="card">
        <Text className="label">相册标题</Text>
        <Input
          className="input"
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          placeholder="例如：周末聚会（可选）"
          disabled={submitting}
        />

        <Text className="label mt-lg">有效期</Text>
        <View className="ttl-row">
          {TTL_PRESETS.map((p) => (
            <View
              key={p.seconds}
              className={`ttl-chip ${ttl === p.seconds ? 'ttl-chip-active' : ''}`}
              onClick={() => !submitting && setTtl(p.seconds)}
            >
              <Text className={`ttl-chip-text ${ttl === p.seconds ? 'ttl-chip-text-active' : ''}`}>
                {p.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 图片选择 */}
      <View className="card flex-1">
        <View className="img-header">
          <Text className="label">
            图片 <Text className="label-hint">{items.length}/{MAX_PHOTOS_PER_SHARE}</Text>
          </Text>
          <View style={{ flex: 1 }} />
          {items.length > 0 && !submitting && (
            <Text className="clear-link" onClick={() => setItems([])}>清空</Text>
          )}
        </View>

        {items.length === 0 ? (
          <View className="dz" onClick={pickImages}>
            <Text className="dz-icon">＋</Text>
            <Text className="dz-title">从相册选择图片</Text>
            <Text className="dz-hint">JPEG / PNG · 单张 ≤ {formatBytes(MAX_FILE_SIZE)}</Text>
          </View>
        ) : (
          <View className="grid">
            {items.map((it) => (
              <View key={it.id} className="thumb">
                <Image src={it.path} className="thumb-img" mode="aspectFill" />
                {it.status === 'uploading' && (
                  <View className="thumb-overlay"><Text style={{ color: '#fff' }}>⏳</Text></View>
                )}
                {it.status === 'done' && (
                  <View className="thumb-overlay thumb-overlay-done"><Text style={{ color: '#fff', fontSize: '44rpx', fontWeight: 700 }}>✓</Text></View>
                )}
                {it.status === 'error' && (
                  <View className="thumb-overlay thumb-overlay-error">
                    <Text style={{ color: '#fff', fontSize: '18rpx', textAlign: 'center', padding: '4rpx' }}>{it.error || '失败'}</Text>
                  </View>
                )}
                {it.status === 'pending' && !submitting && (
                  <View className="thumb-close" onClick={() => removeItem(it.id)}>
                    <Text style={{ color: '#fff', fontSize: '24rpx', fontWeight: 600 }}>×</Text>
                  </View>
                )}
              </View>
            ))}
            {!submitting && items.length < MAX_PHOTOS_PER_SHARE && (
              <View className="add-thumb" onClick={pickImages}>
                <Text style={{ fontSize: '48rpx', color: colorsText3, fontWeight: 300 }}>＋</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 底部操作条 */}
      <View className="bottom-bar">
        <View style={{ flex: 1 }}>
          <Text className="bb-info">
            {submitting
              ? `上传中 · ${stats.done}/${stats.total}${stats.error ? ` · 失败 ${stats.error}` : ''}`
              : `${items.length} 张 · ${formatBytes(stats.totalBytes)}`}
          </Text>
          {submitting && stats.total > 0 && (
            <View className="progress-track">
              <View className="progress-fill" style={{ width: `${Math.round((stats.done / stats.total) * 100)}%` }} />
            </View>
          )}
        </View>
        <View
          className={`btn ${(items.length === 0 || submitting) ? 'btn-disabled' : ''}`}
          onClick={() => !submitting && items.length > 0 && start()}
        >
          <Text className="btn-text">{submitting ? '上传中' : '创建并上传'}</Text>
        </View>
      </View>
    </View>
  );
}

const colorsText3 = '#9ca3af';
