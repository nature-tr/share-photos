import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { ShareSummary } from '@photo/shared';
import { TTL_PRESETS } from '@photo/shared';
import { ApiException } from '@/api/client';
import { shareApi } from '@/api/share.api';
import { useAuth } from '@/stores/auth.store';
import { useRequireAuth } from '@/utils/useRequireAuth';
import { toast } from '@/utils/toast';
import { formatBytes, formatDateTime, formatRemaining } from '@/utils/format';
import { colors, font, radius, shadow, space } from '@/theme';
import ShareQrSheet from '@/components/ShareQrSheet';

export default function MySharesScreen() {
  const router = useRouter();
  const authed = useRequireAuth();
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);

  const [items, setItems] = useState<ShareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [qrItem, setQrItem] = useState<ShareSummary | null>(null);

  async function load() {
    try {
      const r = await shareApi.list({ page: 1, pageSize: 50 });
      setItems(r.items);
    } catch (err) {
      toast(err instanceof ApiException ? err.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (authed) void load();
    }, [authed]),
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function statusInfo(item: ShareSummary) {
    if (item.status === 'cleaned') return { text: '已清理', color: colors.text3, bg: colors.surfaceMuted };
    if (item.status === 'ended') return { text: '已结束', color: colors.warning, bg: colors.warningSoft };
    if (item.expiresAt <= now) return { text: '已过期', color: colors.danger, bg: colors.dangerSoft };
    return { text: '生效中', color: colors.success, bg: colors.successSoft };
  }

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    toast('分享码已复制');
  }
  async function copyLink(code: string) {
    await Clipboard.setStringAsync(`https://www.dolmo.top/v/${code}`);
    toast('链接已复制');
  }

  function endShare(item: ShareSummary) {
    Alert.alert(
      '结束分享',
      `确认提前结束分享「${item.title || item.code}」？所有图片将被清理，且不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认结束',
          style: 'destructive',
          onPress: async () => {
            try {
              await shareApi.end(item.id);
              toast('已结束');
              void load();
            } catch (err) {
              toast(err instanceof ApiException ? err.message : '操作失败');
            }
          },
        },
      ],
    );
  }

  function extendShare(item: ShareSummary) {
    Alert.alert(
      '续期',
      `当前剩余 ${formatRemaining(item.expiresAt - now)}`,
      [
        { text: '取消', style: 'cancel' },
        ...TTL_PRESETS.map((p) => ({
          text: `续 ${p.label}`,
          onPress: async () => {
            try {
              const r = await shareApi.extend(item.id, p.seconds);
              setItems((arr) =>
                arr.map((x) => (x.id === item.id ? { ...x, expiresAt: r.expiresAt } : x)),
              );
              toast('已续期');
            } catch (err) {
              toast(err instanceof ApiException ? err.message : '续期失败');
            }
          },
        })),
      ],
      { cancelable: true },
    );
  }

  function confirmLogout() {
    Alert.alert('退出登录', '确认登出当前账号？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: '我的分享' }} />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📂</Text>
              <Text style={s.emptyTitle}>还没有分享</Text>
              <Text style={s.emptyDesc}>点击右下角「+ 新建分享」开始</Text>
            </View>
          }
          ListFooterComponent={
            user ? (
              <View style={s.footer}>
                <View style={s.userRow}>
                  <View style={s.footerAvatar}>
                    <Text style={s.footerAvatarText}>
                      {(user.displayName || user.email).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.footerName} numberOfLines={1}>
                      {user.displayName || '我的'}
                    </Text>
                    <Text style={s.footerEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.7 }]}
                  onPress={confirmLogout}
                >
                  <Text style={s.logoutBtnText}>退出登录</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const st = statusInfo(item);
            const active = item.status === 'active' && item.expiresAt > now;
            const remaining = active ? formatRemaining(item.expiresAt - now) : '—';
            const lowTime = active && item.expiresAt - now < 3600_000;
            return (
              <View style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {item.title || '未命名相册'}
                  </Text>
                  <View style={[s.pill, { backgroundColor: st.bg }]}>
                    <Text style={[s.pillText, { color: st.color }]}>{st.text}</Text>
                  </View>
                </View>

                <View style={s.codeRow}>
                  <Text style={s.codeText}>{item.code}</Text>
                  <Pressable
                    style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => setQrItem(item)}
                  >
                    <Text style={s.iconBtnText}>码图</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => copyCode(item.code)}
                  >
                    <Text style={s.iconBtnText}>复制</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => copyLink(item.code)}
                  >
                    <Text style={s.iconBtnText}>链接</Text>
                  </Pressable>
                </View>

                <View style={s.metaRow}>
                  <Text style={s.meta}>
                    {item.photoCount} 张 · {formatBytes(item.totalBytes)}
                  </Text>
                  <Text style={[s.meta, lowTime && { color: colors.warning, fontWeight: '600' }]}>
                    {active ? `剩余 ${remaining}` : st.text}
                  </Text>
                </View>
                <Text style={s.metaWeak}>{formatDateTime(item.createdAt)}</Text>

                <View style={s.actions}>
                  <Pressable
                    style={({ pressed }) => [s.btnSm, pressed && { opacity: 0.7 }]}
                    onPress={() =>
                      router.push({
                        pathname: '/viewer/[code]',
                        params: { code: item.code },
                      })
                    }
                  >
                    <Text style={s.btnSmText}>预览</Text>
                  </Pressable>
                  {active && (
                    <>
                      <Pressable
                        style={({ pressed }) => [s.btnSm, pressed && { opacity: 0.7 }]}
                        onPress={() => extendShare(item)}
                      >
                        <Text style={s.btnSmText}>续期</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          s.btnSm,
                          { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => endShare(item)}
                      >
                        <Text style={[s.btnSmText, { color: colors.danger }]}>结束</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <Pressable
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/me/new')}
      >
        <Text style={s.fabIcon}>+</Text>
        <Text style={s.fabText}>新建分享</Text>
      </Pressable>

      <ShareQrSheet
        visible={!!qrItem}
        code={qrItem?.code ?? ''}
        title={qrItem?.title || '未命名相册'}
        onClose={() => setQrItem(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: space.xs,
  },
  emptyEmoji: { fontSize: 48, marginBottom: space.sm },
  emptyTitle: { ...font.h2, color: colors.text2 },
  emptyDesc: { ...font.small, color: colors.text3 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 10,
    ...shadow.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, ...font.h3, color: colors.text1 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  pillText: { ...font.captionStrong },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.primarySofter,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  codeText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 4,
  },
  iconBtn: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { ...font.captionStrong, color: colors.text2 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: { ...font.caption, color: colors.text2 },
  metaWeak: { ...font.caption, color: colors.text3, marginTop: -4 },

  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 4,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  btnSm: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnSmText: { ...font.smallStrong, color: colors.text1 },

  fab: {
    position: 'absolute',
    bottom: space.xl,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    ...shadow.lg,
  },
  fabIcon: { color: '#fff', fontSize: 22, fontWeight: '600', marginTop: -2 },
  fabText: { ...font.bodyStrong, color: '#fff' },

  /* 列表底部：用户信息 + 退出 */
  footer: {
    marginTop: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: space.sm,
  },
  footerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footerName: { ...font.bodyStrong, color: colors.text1 },
  footerEmail: { ...font.caption, color: colors.text3, marginTop: 2 },
  logoutBtn: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: { ...font.smallStrong, color: colors.danger },
});
