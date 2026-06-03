import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/stores/auth.store';
import { colors, radius, space } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [code, setCode] = useState('');

  function go() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    router.push({ pathname: '/viewer/[code]', params: { code: c } });
  }

  /** 分享图片 → 已登录跳新建分享，未登录跳登录页 */
  function gotoShare() {
    if (user) router.push('/(me)/new');
    else router.push({ pathname: '/(auth)/login', params: { redirect: '/(me)/new' } });
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* 顶部账户状态栏 */}
      <View style={s.topBar}>
        {user ? (
          <Pressable style={s.userTab} onPress={() => router.push('/(me)/shares')}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(user.displayName || user.email).slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName} numberOfLines={1}>
                {user.displayName || '我的'}
              </Text>
              <Text style={s.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <Text style={s.topArrow}>›</Text>
          </Pressable>
        ) : (
          <View style={s.guestTab}>
            <Text style={s.guestText}>未登录 · 仅可查看分享</Text>
            <View style={s.guestBtns}>
              <Link href="/(auth)/login" asChild>
                <Pressable style={s.topBtnGhost}>
                  <Text style={s.topBtnGhostText}>登录</Text>
                </Pressable>
              </Link>
              <Link href="/(auth)/register" asChild>
                <Pressable style={s.topBtnPrimary}>
                  <Text style={s.topBtnPrimaryText}>注册</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* 顶部品牌 */}
          <View style={s.brand}>
            <View style={s.logo}>
              <Text style={s.logoText}>📷</Text>
            </View>
            <Text style={s.title}>Dolmo Photo</Text>
            <Text style={s.subtitle}>限时分享相册 · 一键存到手机</Text>
          </View>

          {/* 输入分享码 */}
          <View style={s.card}>
            <Text style={s.cardTitle}>输入分享码</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="K7M2X9PQ"
              placeholderTextColor={colors.text3}
              autoCapitalize="characters"
              maxLength={8}
              style={s.codeInput}
              returnKeyType="go"
              onSubmitEditing={go}
            />
            <Pressable
              style={({ pressed }) => [s.btnPrimary, pressed && s.btnPressed]}
              onPress={go}
            >
              <Text style={s.btnPrimaryText}>查看相册</Text>
            </Pressable>
          </View>

          {/* 扫码 */}
          <Pressable
            style={({ pressed }) => [s.actionCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/scan')}
          >
            <Text style={s.actionIcon}>⌒</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>扫一扫</Text>
              <Text style={s.actionDesc}>对方分享了二维码？直接扫描进入</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          {/* 分享图片（新增）*/}
          <Pressable
            style={({ pressed }) => [s.actionCard, pressed && { opacity: 0.85 }]}
            onPress={gotoShare}
          >
            <Text style={s.actionIcon}>↑</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>分享图片</Text>
              <Text style={s.actionDesc}>
                {user ? '从相册选图，生成分享码与二维码' : '需要先登录账号'}
              </Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          {user && (
            <Pressable
              style={({ pressed }) => [s.actionCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(me)/shares')}
            >
              <Text style={s.actionIcon}>≡</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.actionTitle}>我的分享</Text>
                <Text style={s.actionDesc}>查看、续期或结束已创建的分享</Text>
              </View>
              <Text style={s.actionArrow}>›</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  container: { padding: space.lg, paddingBottom: 60 },

  /* 顶部账户状态栏 */
  topBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  userTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  userName: { fontSize: 14, fontWeight: '600', color: colors.text1 },
  userEmail: { fontSize: 11, color: colors.text3, marginTop: 1 },
  topArrow: { fontSize: 20, color: colors.text3 },

  guestTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: space.sm,
  },
  guestText: { fontSize: 13, color: colors.text2, flex: 1 },
  guestBtns: { flexDirection: 'row', gap: 8 },
  topBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topBtnGhostText: { color: colors.text1, fontSize: 13, fontWeight: '600' },
  topBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  topBtnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  /* 品牌区 */
  brand: { alignItems: 'center', marginTop: space.lg, marginBottom: space.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  logoText: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text1, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: colors.text3, marginTop: 4 },

  /* 输入分享码 */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text2, marginBottom: space.sm },
  codeInput: {
    height: 56,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.primary,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },

  /* 行动卡片：扫一扫 / 分享 / 我的分享 */
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: space.sm,
  },
  actionIcon: {
    fontSize: 28,
    color: colors.primary,
    width: 40,
    textAlign: 'center',
  },
  actionTitle: { fontSize: 15, fontWeight: '600', color: colors.text1 },
  actionDesc: { fontSize: 12, color: colors.text3, marginTop: 2 },
  actionArrow: { fontSize: 24, color: colors.text3 },

  /* 通用按钮 */
  btnPrimary: {
    height: 48,
    paddingHorizontal: space.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnPressed: { opacity: 0.85 },
});
