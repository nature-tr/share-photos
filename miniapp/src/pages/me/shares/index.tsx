import { useState } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { getMyShares, endShare, extendShare, renameShare, getShareContributors, reviewContributor, deleteShare, batchEndShares, batchDeleteShares } from '@/api/share.api';
import type { ContributorInfo } from '@photo/shared/dto';
import { useAuth } from '@/stores/auth.store';
import { colors } from '@/theme';
import QrSheet from '@/components/QrSheet';
import { iconQrcode, iconCopy, iconLink, iconFolder, iconUser, iconTrash } from '@/assets/icons';
import type { ShareSummary } from '@photo/shared/dto';
import { TTL_PRESETS } from '@photo/shared';
import { useNow } from '@/utils/hooks';
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
  const now = useNow();
  const [qrItem, setQrItem] = useState<ShareSummary | null>(null);
  const [manageOpen, setManageOpen] = useState<{ shareId: string; code: string } | null>(null);
  const [contributors, setContributors] = useState<ContributorInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await getMyShares();
      if (res.data?.items) setItems(res.data.items);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useDidShow(() => { void load(); });

  async function onRefresherRefresh() {
    setRefreshing(true);
    await load();
  }

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

  function onRename(item: ShareSummary) {
    Taro.showModal({
      title: '重命名',
      editable: true,
      placeholderText: item.title || '输入新标题',
      content: (item as any)._inputValue ?? item.title ?? '',
      success: async (res) => {
        if (!res.confirm || !res.content?.trim()) return;
        try {
          await renameShare(item.id, res.content.trim());
          Taro.showToast({ title: '已更新', icon: 'success' });
          void load();
        } catch {
          Taro.showToast({ title: '重命名失败', icon: 'none' });
        }
      },
    });
  }

  function onDelete(item: ShareSummary) {
    Taro.showModal({
      title: '删除分享',
      content: `永久删除「${item.title || item.code}」？此操作不可撤销。`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await deleteShare(item.id);
          Taro.showToast({ title: '已删除', icon: 'success' });
          void load();
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  }

  async function onBatchEnd() {
    if (selectedIds.size === 0) return;
    Taro.showModal({
      title: '批量结束',
      content: `确认结束选中的 ${selectedIds.size} 个分享？`,
      confirmColor: '#ef4444',
      success: async (m) => {
        if (!m.confirm) return;
        try {
          await batchEndShares(Array.from(selectedIds));
          Taro.showToast({ title: `已结束 ${selectedIds.size} 个`, icon: 'success' });
          setSelectMode(false);
          setSelectedIds(new Set());
          void load();
        } catch {
          Taro.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  }

  async function onBatchDelete() {
    if (selectedIds.size === 0) return;
    Taro.showModal({
      title: '批量删除',
      content: `永久删除选中的 ${selectedIds.size} 个分享？此操作不可撤销。`,
      confirmColor: '#ef4444',
      success: async (m) => {
        if (!m.confirm) return;
        try {
          await batchDeleteShares(Array.from(selectedIds));
          Taro.showToast({ title: `已删除 ${selectedIds.size} 个`, icon: 'success' });
          setSelectMode(false);
          setSelectedIds(new Set());
          void load();
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function leaveSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function confirmLogout() {
    Taro.showModal({
      title: '退出登录',
      content: '确认登出当前账号？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          logout();
          Taro.redirectTo({ url: '/pages/index/index' });
        }
      },
    });
  }

  async function openManage(shareId: string, code: string) {
    setManageOpen({ shareId, code });
    const res = await getShareContributors(shareId);
    if (res.data) setContributors(res.data);
  }

  async function handleReview(shareId: string, userId: string, action: 'accepted' | 'rejected') {
    const res = await reviewContributor(shareId, userId, action);
    if (res.data) {
      setContributors((arr) => arr.map((c) => (c.userId === userId ? { ...c, status: action } : c)));
      Taro.showToast({ title: action === 'accepted' ? '已通过' : '已拒绝', icon: 'success' });
      void load();
    }
  }

  if (loading && items.length === 0) {
    return <ScrollView className="page" scrollY enhanced showScrollbar={false}><View className="center"><Text>加载中…</Text></View></ScrollView>;
  }

  return (
    <>
      <ScrollView
        className="page"
        scrollY enhanced showScrollbar={false}
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresherRefresh}
      >
      {/* 批量操作 header */}
      {items.length > 0 && (
        <View className="batch-header">
          {selectMode ? (
            <>
              <Text className="batch-header-count">已选 {selectedIds.size} 个</Text>
              <View style={{ flex: 1 }} />
              <View className="batch-header-btn" onClick={leaveSelectMode}>
                <Text className="batch-header-btn-text">取消</Text>
              </View>
            </>
          ) : (
            <>
              <Text className="batch-header-title">我的分享</Text>
              <View style={{ flex: 1 }} />
              <View className="batch-header-btn" onClick={() => setSelectMode(true)}>
                <Text className="batch-header-btn-text">管理</Text>
              </View>
            </>
          )}
        </View>
      )}

      {items.length === 0 ? (
        <View className="center">
          <View className="empty-icon">
            <Image src={iconFolder('#94a3b8')} className="empty-icon-img" />
          </View>
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
              <View
                key={item.id}
                className={`share-card ${selectMode ? 'share-card-selectable' : ''} ${selectMode && selectedIds.has(item.id) ? 'share-card-selected' : ''}`}
                onClick={() => { if (selectMode) toggleSelect(item.id); }}
              >
                {selectMode && (
                  <View className={`select-check ${selectedIds.has(item.id) ? 'select-check-on' : ''}`}>
                    {selectedIds.has(item.id) && <Text className="select-check-icon">✓</Text>}
                  </View>
                )}
                <View className="card-top">
                  <Text className="card-title" numberOfLines={1} onClick={(e: any) => { e.stopPropagation(); if (!selectMode) onRename(item); }}>{item.title || '未命名相册'}</Text>
                  <View className="pill" style={{ backgroundColor: st.bg }}>
                    <Text className="pill-text" style={{ color: st.color }}>{st.text}</Text>
                  </View>
                  {!selectMode && (item.status === 'ended' || item.status === 'cleaned') && (
                    <View className="delete-icon" onClick={(e: any) => { e.stopPropagation(); onDelete(item); }}>
                      <Image src={iconTrash('#ef4444')} className="delete-icon-img" />
                    </View>
                  )}
                </View>

                <View className="code-row">
                  <Text className="code-text">{item.code}</Text>
                  <View className="code-actions">
                    <View className="icon-btn" onClick={() => setQrItem(item)}>
                      <Image src={iconQrcode('#475569')} className="icon-btn-img" />
                    </View>
                    <View className="icon-btn" onClick={() => copyCode(item.code)}>
                      <Image src={iconCopy('#475569')} className="icon-btn-img" />
                    </View>
                    <View className="icon-btn" onClick={() => copyLink(item.code)}>
                      <Image src={iconLink('#475569')} className="icon-btn-img" />
                    </View>
                  </View>
                </View>

                <View className="meta-row">
                  <Text className="meta">{item.photoCount} 张 · {formatBytes(item.totalBytes)}</Text>
                  <Text className={`meta ${lowTime ? 'meta-warn' : ''}`}>
                    {active ? `剩余 ${remaining}` : st.text}
                  </Text>
                </View>
                <Text className="meta-weak">{formatDate(item.createdAt)}</Text>

                <View className="actions">
                  <View
                    className="action-btn"
                    onClick={() => Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${item.code}` })}
                  >
                    <Text className="action-btn-text">预览</Text>
                  </View>
                  {active && (
                    <View className="action-btn" onClick={() => onExtend(item)}>
                      <Text className="action-btn-text">续期</Text>
                    </View>
                  )}
                  {/* 贡献者管理 */}
                  <View className="action-btn" onClick={() => openManage(item.id, item.code)}>
                    <Text className="action-btn-text">
                      管理{(item as any).pendingContributorCount > 0 ? ` (${(item as any).pendingContributorCount})` : ''}
                    </Text>
                  </View>
                  {active && (
                    <View className="action-btn action-btn-danger" onClick={() => onEnd(item)}>
                      <Text className="action-btn-text-danger">结束</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 批量操作条 */}
      {selectMode && selectedIds.size > 0 && (
        <View className="batch-bar">
          <View className="batch-bar-action batch-bar-end" onClick={onBatchEnd}>
            <Text className="batch-bar-action-text">结束</Text>
          </View>
          <View className="batch-bar-action batch-bar-delete" onClick={onBatchDelete}>
            <Text className="batch-bar-action-text">永久删除</Text>
          </View>
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
          <View className="logout-btn" onClick={confirmLogout}>
            <Text className="logout-btn-text">退出登录</Text>
          </View>
        </View>
      )}

      {/* 贡献者管理弹层 */}
      {manageOpen && (
        <View className="manage-overlay" onClick={() => setManageOpen(null)}>
          <View className="manage-sheet" onClick={(e: any) => e.stopPropagation()}>
            <View className="manage-handle" />
            <Text className="manage-title">贡献者管理</Text>

            {contributors.length === 0 ? (
              <View className="manage-empty">
                <View className="empty-icon">
                  <Image src={iconUser('#94a3b8')} className="empty-icon-img" />
                </View>
                <Text style={{ fontSize: '26rpx', color: '#9ca3af', marginTop: '8rpx' }}>暂无贡献者申请</Text>
              </View>
            ) : (
              <View className="manage-list">
                {contributors.map((c) => (
                  <View key={c.userId} className="manage-item">
                    <View className="manage-avatar">
                      <Text className="manage-avatar-text">
                        {(c.displayName || c.email).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View className="manage-info">
                      <Text className="manage-name">{c.displayName || c.email}</Text>
                      <Text className={`manage-status manage-status-${c.status}`}>
                        {c.status === 'pending' ? '待审核' : c.status === 'accepted' ? '已通过' : '已拒绝'}
                      </Text>
                    </View>
                    {c.status === 'pending' && (
                      <View className="manage-actions">
                        <View className="manage-accept" onClick={() => handleReview(manageOpen.shareId, c.userId, 'accepted')}>
                          <Text className="manage-accept-text">通过</Text>
                        </View>
                        <View className="manage-reject" onClick={() => handleReview(manageOpen.shareId, c.userId, 'rejected')}>
                          <Text className="manage-reject-text">拒绝</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View className="manage-close" onClick={() => setManageOpen(null)}>
              <Text className="manage-close-text">关闭</Text>
            </View>
          </View>
        </View>
      )}

      {/* FAB 新建分享 */}
      {!selectMode && (
      <View className="fab" onClick={() => Taro.navigateTo({ url: '/pages/me/new/index' })}>
        <Text className="fab-icon">+</Text>
        <Text className="fab-text">新建分享</Text>
      </View>
      )}

      {/* 二维码弹层 */}
      <QrSheet
        visible={!!qrItem}
        code={qrItem?.code ?? ''}
        title={qrItem?.title || '未命名相册'}
        onClose={() => setQrItem(null)}
      />
      </ScrollView>
    </>
  );
}
