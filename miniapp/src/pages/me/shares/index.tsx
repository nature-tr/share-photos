import { useEffect, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { getMyShares, endShare, extendShare } from '@/api/share.api';
import { useAuth } from '@/stores/auth.store';
import { colors } from '@/theme';
import type { ShareSummary } from '@photo/shared/dto';
import { TTL_PRESETS } from '@photo/shared';
import './index.scss';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  if (m > 0) return `${m} 分钟`;
  return '不足 1 分钟';
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MySharesPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [items, setItems] = useState<ShareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function load() {
    setLoading(true);
    try {
      const res = await getMyShares();
      if (res.data?.items) setItems(res.data.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useDidShow(() => { void load(); });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function statusInfo(item: ShareSummary) {
    if (item.status === 'cleaned') return { text: '已清理', color: colors.text3, bg: colors.surfaceMuted };
    if (item.status === 'ended') return { text: '已结束', color: '#f59e0b', bg: '#fef3c7' };
    if (item.expiresAt <= now) return { text: '已过期', color: '#ef4444', bg: '#fee2e2' };
    return { text: '生效中', color: colors.success, bg: colors.successSoft };
  }

  function copyCode(code: string) {
    Taro.setClipboardData({ data: code });
    Taro.showToast({ title: '分享码已复制', icon: 'none' });
  }

  function copyLink(code: string) {
    Taro.setClipboardData({ data: `https://www.dolmo.top/v/${code}` });
    Taro.showToast({ title: '链接已复制', icon: 'none' });
  }

  function onEnd(item: ShareSummary) {
    Taro.showModal({
      title: '结束分享',
      content: `确认提前结束分享「${item.title || item.code}」？所有图片将被清理，且不可恢复。`,
      confirmColor: '#ef4444',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        try {
          await endShare(item.id);
          Taro.showToast({ title: '已结束', icon: 'success' });
          void load();
        } catch {
          Taro.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  }

  function onExtend(item: ShareSummary) {
    const remaining = formatRemaining(item.expiresAt - now);
    const presetLabels = TTL_PRESETS.map((p) => p.label);
    Taro.showActionSheet({
      itemList: presetLabels,
      success: async (sheetRes) => {
        const preset = TTL_PRESETS[sheetRes.tapIndex];
        if (!preset) return;
        try {
          const res = await extendShare(item.id, preset.seconds);
          if (res.data) {
            setItems((arr) =>
              arr.map((x) => (x.id === item.id ? { ...x, expiresAt: (res.data as any).expiresAt ?? x.expiresAt } : x)),
            );
            Taro.showToast({ title: '已续期', icon: 'success' });
          }
        } catch {
          Taro.showToast({ title: '续期失败', icon: 'none' });
        }
      },
    });
  }

  function confirmLogout() {
    Taro.showModal({
      title: '退出登录',
      content: '确认登出当前账号？',
      confirmColor: '#ef4444',
      success: (res) => { if (res.confirm) void logout(); },
    });
  }

  if (loading) {
    return <View className="page"><View className="center"><Text>加载中…</Text></View></View>;
  }

  return (
    <View className="page">
      {items.length === 0 ? (
        <View className="center">
          <Text style={{ fontSize: '80rpx', marginBottom: '24rpx' }}>📂</Text>
          <Text style={{ fontSize: '36rpx', fontWeight: 700, color: colors.text2 }}>还没有分享</Text>
          <Text style={{ fontSize: '24rpx', color: colors.text3, marginTop: '8rpx' }}>
            点击右下角「+ 新建分享」开始
          </Text>
        </View>
      ) : (
        <View className="list">
          {items.map((item) => {
            const st = statusInfo(item);
            const active = item.status === 'active' && item.expiresAt > now;
            const remaining = active ? formatRemaining(item.expiresAt - now) : '—';
            const lowTime = active && item.expiresAt - now < 3600_000;
            return (
              <View key={item.id} className="share-card">
                <View className="card-top">
                  <Text className="card-title" numberOfLines={1}>{item.title || '未命名相册'}</Text>
                  <View className="pill" style={{ backgroundColor: st.bg }}>
                    <Text className="pill-text" style={{ color: st.color }}>{st.text}</Text>
                  </View>
                </View>

                <View className="code-row">
                  <Text className="code-text">{item.code}</Text>
                  <Button className="icon-btn" size="mini" onClick={() => copyCode(item.code)}>复制</Button>
                  <Button className="icon-btn" size="mini" onClick={() => copyLink(item.code)}>链接</Button>
                </View>

                <View className="meta-row">
                  <Text className="meta">{item.photoCount} 张 · {formatBytes(item.totalBytes)}</Text>
                  <Text className={`meta ${lowTime ? 'meta-warn' : ''}`}>
                    {active ? `剩余 ${remaining}` : st.text}
                  </Text>
                </View>
                <Text className="meta-weak">{formatDate(item.createdAt)}</Text>

                <View className="actions">
                  <Button
                    className="action-btn"
                    size="mini"
                    onClick={() => Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${item.code}` })}
                  >预览</Button>
                  {active && (
                    <>
                      <Button className="action-btn" size="mini" onClick={() => onExtend(item)}>续期</Button>
                      <Button className="action-btn action-btn-danger" size="mini" onClick={() => onEnd(item)}>结束</Button>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 底部用户信息 + 退出 */}
      {user && (
        <View className="footer">
          <View className="user-row">
            <View className="avatar">
              <Text className="avatar-text">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</Text>
            </View>
            <View className="footer-user-info">
              <Text className="user-name">{user.displayName || '我的'}</Text>
              <Text className="user-email">{user.email}</Text>
            </View>
          </View>
          <Button className="logout-btn" onClick={confirmLogout}>退出登录</Button>
        </View>
      )}

      {/* FAB 新建分享 */}
      <View className="fab" onClick={() => Taro.navigateTo({ url: '/pages/me/new/index' })}>
        <Text className="fab-icon">+</Text>
        <Text className="fab-text">新建分享</Text>
      </View>
    </View>
  );
}
