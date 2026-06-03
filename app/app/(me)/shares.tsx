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
import { toast } from '@/utils/toast';
import { formatBytes, formatDateTime, formatRemaining } from '@/utils/format';
import { colors, radius, space } from '@/theme';

export default function MySharesScreen() {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);

  const [items, setItems] = useState<ShareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

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
      void load();
    }, []),
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function statusInfo(s: ShareSummary) {
    if (s.status === 'cleaned') return { text: '已清理', color: colors.text3 };
    if (s.status === 'ended') return { text: '已结束', color: colors.warning };
    if (s.expiresAt <= now) return { text: '已过期', color: colors.danger };
    return { text: '生效中', color: colors.success };
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

  return (
    <View style={s.root}>
      <Stack.Screen
        options={{
          title: '我的分享',
          headerRight: () => (
            <Pressable onPress={logout} hitSlop={10}>
              <Text style={{ color: colors.text3, fontSize: 13 }}>登出</Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
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
          ListHeaderComponent={
            user ? (
              <View style={s.userHeader}>
                <Text style={s.userTitle}>{user.displayName}</Text>
                <Text style={s.userSub}>{items.length} 个分享 · {user.email}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>还没有分享</Text>
              <Text style={s.emptyDesc}>创建你的第一个分享相册</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = statusInfo(item);
            const remaining =
              item.status === 'active' ? formatRemaining(item.expiresAt - now) : '—';
            return (
              <View style={s.card}>
                <View style={s.row}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {item.title || '未命名相册'}
                  </Text>
                  <View style={[s.pill, { backgroundColor: st.color + '22' }]}>
                    <Text style={[s.pillText, { color: st.color }]}>{st.text}</Text>
                  </View>
                </View>

                <View style={s.codeRow}>
                  <Text style={s.code}>{item.code}</Text>
                  <Pressable style={s.iconBtn} onPress={() => copyCode(item.code)}>
                    <Text style={s.iconBtnText}>复制码</Text>
                  </Pressable>
                  <Pressable style={s.iconBtn} onPress={() => copyLink(item.code)}>
                    <Text style={s.iconBtnText}>复制链接</Text>
                  </Pressable>
                </View>

                <Text style={s.meta}>
                  {item.photoCount} 张 · {formatBytes(item.totalBytes)} ·{' '}
                  {formatDateTime(item.createdAt)}
                </Text>
                <Text
                  style={[
                    s.meta,
                    item.status === 'active' &&
                    item.expiresAt - now < 3600_000 && { color: colors.warning },
                  ]}
                >
                  {item.status === 'active' ? `剩余 ${remaining}` : st.text}
                </Text>

                <View style={s.actions}>
                  <Pressable
                    style={s.btnSm}
                    onPress={() =>
                      router.push({
                        pathname: '/viewer/[code]',
                        params: { code: item.code },
                      })
                    }
                  >
                    <Text style={s.btnSmText}>预览</Text>
                  </Pressable>
                  {item.status === 'active' && (
                    <>
                      <Pressable style={s.btnSm} onPress={() => extendShare(item)}>
                        <Text style={s.btnSmText}>续期</Text>
                      </Pressable>
                      <Pressable
                        style={[s.btnSm, { borderColor: colors.danger + '66' }]}
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
        onPress={() => router.push('/(me)/new')}
      >
        <Text style={s.fabText}>＋ 新建分享</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text2 },
  emptyDesc: { fontSize: 13, color: colors.text3 },

  userHeader: { paddingVertical: space.sm, marginBottom: space.sm },
  userTitle: { fontSize: 17, fontWeight: '700', color: colors.text1 },
  userSub: { fontSize: 12, color: colors.text3, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text1 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  pillText: { fontSize: 11, fontWeight: '600' },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  code: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 4,
  },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnText: { fontSize: 11, color: colors.text2, fontWeight: '500' },

  meta: { fontSize: 12, color: colors.text3 },

  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: 6,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  btnSm: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSmText: { fontSize: 13, color: colors.text1, fontWeight: '500' },

  fab: {
    position: 'absolute',
    bottom: space.lg + 16,
    right: space.lg,
    paddingHorizontal: space.lg,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
