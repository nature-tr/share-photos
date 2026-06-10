import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Input, Image, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';
import { MAX_PHOTOS_PER_SHARE, MAX_FILE_SIZE, TTL_PRESETS } from '@photo/shared';
import { createShare } from '@/api/share.api';
import { useTaskStore } from '@/stores/task.store';
import { taskManager, type UploadItem } from '@/stores/task.manager';
import { pickImagesFromAlbum } from '@/utils/hooks';
import QrSheet from '@/components/QrSheet';
import GlobalProgress from '@/components/GlobalProgress';
import './index.scss';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewSharePage() {
  const [title, setTitle] = useState('');
  const [ttl, setTtl] = useState<number>(TTL_PRESETS[2]!.seconds);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [restoreShareId, setRestoreShareId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  /* ── URL 参数：仅当从全局进度卡片跳进来时携带 ── */
  useLoad((options) => {
    if (options?.restoreShareId) setRestoreShareId(options.restoreShareId as string);
  });

  /* ── 恢复模式：从 manager 读取上下文 + 订阅 ── */
  useDidShow(() => {
    if (!restoreShareId) return;
    const ctx = taskManager.getUploadCtx(restoreShareId);
    if (!ctx) return;

    setTitle(ctx.meta.title);
    setTtl(ctx.meta.ttl);
    setItems(ctx.items.map((i) => ({ ...i })));
    setCreated({ id: restoreShareId, code: '' });

    // 订阅后续变化
    unsubRef.current?.();
    unsubRef.current = taskManager.subscribeUpload(restoreShareId, () => {
      const c = taskManager.getUploadCtx(restoreShareId);
      if (c) setItems(c.items.map((i) => ({ ...i })));
    });
  });

  // 卸载时取消订阅
  useEffect(() => () => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  /* ── 任务状态（仅用于 UI 文案） ── */
  const taskStatus = useTaskStore((s) => (created?.id ? s.uploads[created.id]?.status : undefined));

  /* ── 统计 ── */
  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === 'done').length;
    const error = items.filter((i) => i.status === 'error').length;
    const totalBytes = items.reduce((s, i) => s + (i.size ?? 0), 0);
    return { total, done, error, totalBytes };
  }, [items]);

  /* ── 选图 ── */
  async function pickImages() {
    const remaining = MAX_PHOTOS_PER_SHARE - items.length;
    if (remaining <= 0) {
      Taro.showToast({ title: `最多 ${MAX_PHOTOS_PER_SHARE} 张`, icon: 'none' });
      return;
    }
    const picked = await pickImagesFromAlbum({ count: remaining });
    if (picked.items.length === 0) {
      if (picked.reason === 'denied') {
        Taro.showModal({
          title: '相册权限未开启',
          content: '请前往手机「设置」→「微信」→ 开启「照片」权限，然后重新打开小程序。',
          confirmText: '我知道了',
          showCancel: false,
        });
      }
      return;
    }
    const newItems: UploadItem[] = picked.items.map((p) => ({
      id: Math.random().toString(36).slice(2),
      path: p.path,
      name: p.path.split('/').pop() || `photo-${Date.now()}.jpg`,
      size: p.size,
      status: 'pending',
    }));
    setItems((arr) => [...arr, ...newItems]);
  }

  function removeItem(id: string) {
    setItems((arr) => arr.filter((i) => i.id !== id));
  }

  /* ── 创建并启动上传（仅首次发起） ── */
  async function start() {
    if (items.length === 0) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    setCreating(true);
    try {
      // 提前过滤超大文件
      const oversized = items.find((i) => i.size && i.size > MAX_FILE_SIZE);
      if (oversized) {
        Taro.showToast({
          title: `${oversized.name} 过大（${formatBytes(oversized.size!)}）`,
          icon: 'none',
        });
        setCreating(false);
        return;
      }

      const shareRes = await createShare(ttl, title.trim() || undefined);
      if (shareRes.error || !shareRes.data) {
        Taro.showToast({ title: shareRes.error?.message ?? '创建失败', icon: 'none' });
        setCreating(false);
        return;
      }
      const share = shareRes.data;
      setCreated({ id: share.id, code: share.code });

      // 交给 manager 接管
      taskManager.startUpload(share.id, items, {
        title: title.trim(),
        ttl,
        totalBytes: stats.totalBytes,
      });

      // 订阅 items 变化以驱动缩略图状态
      unsubRef.current?.();
      unsubRef.current = taskManager.subscribeUpload(share.id, () => {
        const c = taskManager.getUploadCtx(share.id);
        if (c) setItems(c.items.map((i) => ({ ...i })));
      });
    } finally {
      setCreating(false);
    }
  }

  /* ── 全部完成的成功页 ── */
  if (created && created.code && taskStatus === 'done' && stats.error === 0) {
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
        <View className="btn-primary" onClick={() => setQrVisible(true)}>
          <Text className="btn-primary-text">展示二维码</Text>
        </View>
        <View className="btn-outline-group">
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

        <QrSheet
          visible={qrVisible}
          code={created.code}
          title={title.trim() || '未命名相册'}
          onClose={() => setQrVisible(false)}
        />
      </View>
    );
  }

  // 是否处于正在上传（含暂停态）的进行中状态：禁用编辑
  const inProgress =
    creating ||
    taskStatus === 'uploading' ||
    taskStatus === 'paused';

  return (
    <>
      <ScrollView className="page" scrollY enhanced showScrollbar={false}>
      {/* 表单 */}
      <View className="card">
        <Text className="label">相册标题</Text>
        <Input
          className="input"
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          placeholder="例如：周末聚会（可选）"
          disabled={inProgress}
        />

        <Text className="label mt-lg">有效期</Text>
        <View className="ttl-row">
          {TTL_PRESETS.map((p) => (
            <View
              key={p.seconds}
              className={`ttl-chip ${ttl === p.seconds ? 'ttl-chip-active' : ''}`}
              onClick={() => !inProgress && setTtl(p.seconds)}
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
          {items.length > 0 && !inProgress && (
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
                  <View className="thumb-overlay thumb-overlay-done">
                    <Text style={{ color: '#fff', fontSize: '44rpx', fontWeight: 700 }}>✓</Text>
                  </View>
                )}
                {it.status === 'error' && (
                  <View className="thumb-overlay thumb-overlay-error">
                    <Text style={{ color: '#fff', fontSize: '18rpx', textAlign: 'center', padding: '4rpx' }}>
                      {it.error || '失败'}
                    </Text>
                  </View>
                )}
                {it.status === 'pending' && !inProgress && (
                  <View className="thumb-close" onClick={() => removeItem(it.id)}>
                    <Text style={{ color: '#fff', fontSize: '24rpx', fontWeight: 600 }}>×</Text>
                  </View>
                )}
              </View>
            ))}
            {!inProgress && items.length < MAX_PHOTOS_PER_SHARE && (
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
            {inProgress
              ? `${taskStatus === 'paused' ? '已暂停' : '上传中'} · ${stats.done}/${stats.total}${stats.error ? ` · 失败 ${stats.error}` : ''}`
              : `${items.length} 张 · ${formatBytes(stats.totalBytes)}`}
          </Text>
          {inProgress && stats.total > 0 && (
            <View className="progress-track">
              <View
                className="progress-fill"
                style={{
                  width: `${Math.round((stats.done / stats.total) * 100)}%`,
                  background: taskStatus === 'paused' ? '#94a3b8' : undefined,
                }}
              />
            </View>
          )}
        </View>
        <View
          className={`btn ${(items.length === 0 || inProgress || !!restoreShareId) ? 'btn-disabled' : ''}`}
          onClick={() => !inProgress && !restoreShareId && items.length > 0 && start()}
        >
          <Text className="btn-text">
            {restoreShareId
              ? taskStatus === 'paused' ? '已暂停' : '正在上传中'
              : creating
              ? '创建中…'
              : taskStatus === 'uploading'
              ? '上传中'
              : taskStatus === 'paused'
              ? '已暂停'
              : '创建并上传'}
          </Text>
        </View>
      </View>
      </ScrollView>
      <GlobalProgress />
    </>
  );
}

const colorsText3 = '#9ca3af';
