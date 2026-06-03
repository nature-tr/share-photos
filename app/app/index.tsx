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
import { colors, font, radius, shadow, space } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [code, setCode] = useState('');

  function go() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    router.push({ pathname: '/viewer/[code]', params: { code: c } });
  }

  function gotoShare() {
    if (user) router.push('/(me)/new');
    else router.push({ pathname: '/(auth)/login', params: { redirect: '/(me)/new' } });
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* 顶部账户状态条 */}
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
            <View style={s.guestAvatar}>
              <Text style={s.guestAvatarText}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.guestTitle}>未登录</Text>
              <Text style={s.guestSub}>登录后可创建并管理分享</Text>
            </View>
            <Link href="/(auth)/login" asChild>
              <Pressable style={({ pressed }) => [s.topBtnPrimary, pressed && s.pressed]}>
                <Text style={s.topBtnPrimaryText}>登录 / 注册</Text>
              </Pressable>
            </Link>
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
          showsVerticalScrollIndicator={false}
        >
          {/* 品牌 */}
          <View style={s.brand}>
            <View style={s.logo}>
              <Text style={s.logoText}>D</Text>
            </View>
            <Text style={s.title}>Dolmo Photo</Text>
            <Text style={s.subtitle}>限时分享相册 · 一键存到手机相册</Text>
          </View>

          {/* 输入分享码 */}
          <View style={s.heroCard}>
            <Text style={s.heroEyebrow}>输入分享码</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="ABCD1234"
              placeholderTextColor={colors.text4}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={s.codeInput}
              returnKeyType="go"
              onSubmitEditing={go}
            />
            <Pressable
              style={({ pressed }) => [s.btnPrimary, pressed && s.pressed, !code.trim() && { opacity: 0.5 }]}
              onPress={go}
              disabled={!code.trim()}
            >
              <Text style={s.btnPrimaryText}>查看相册</Text>
            </Pressable>
          </View>

          {/* 行动入口 */}
          <Text style={s.sectionLabel}>更多操作</Text>

          <Pressable
            style={({ pressed }) => [s.actionCard, pressed && s.pressed]}
            onPress={() => router.push('/scan')}
          >
            <View style={[s.actionIconBox, { backgroundColor: colors.primarySoft }]}>
              <Text style={[s.actionIcon, { color: colors.primary }]}>⌒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>扫一扫</Text>
              <Text style={s.actionDesc}>对方分享了二维码？相机扫描秒进</Text>
            </View>
            <Text style={s.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.actionCard, pressed && s.pressed]}
            onPress={gotoShare}
          >
            <View style={[s.actionIconBox, { backgroundColor: colors.successSoft }]}>
              <Text style={[s.actionIcon, { color: colors.success }]}>↑</Text>
            </View>
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
              style={({ pressed }) => [s.actionCard, pressed && s.pressed]}
              onPress={() => router.push('/(me)/shares')}
            >
              <View style={[s.actionIconBox, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[s.actionIcon, { color: colors.text2 }]}>≡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.actionTitle}>我的分享</Text>
                <Text style={s.actionDesc}>查看、续期或结束已创建的分享</Text>
              </View>
              <Text style={s.actionArrow}>›</Text>
            </Pressable>
          )}

          <View style={{ height: space.xl }} />
          <Text style={s.footer}>Dolmo Photo · v0.1</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  container: { padding: space.lg, paddingTop: space.md, paddingBottom: 60 },
  pressed: { opacity: 0.7 },

  /* 顶部账户状态栏 */
  topBar: {
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userName: { ...font.smallStrong, color: colors.text1 },
  userEmail: { ...font.caption, color: colors.text3, marginTop: 1 },
  topArrow: { fontSize: 22, color: colors.text3, fontWeight: '300' },

  guestTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  guestAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarText: { fontSize: 18 },
  guestTitle: { ...font.smallStrong, color: colors.text1 },
  guestSub: { ...font.caption, color: colors.text3, marginTop: 1 },
  topBtnPrimary: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnPrimaryText: { ...font.smallStrong, color: '#fff' },

  /* 品牌 */
  brand: { alignItems: 'center', marginTop: space.lg, marginBottom: space.xl },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
    ...shadow.md,
  },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  title: { ...font.display, color: colors.text1 },
  subtitle: { ...font.small, color: colors.text3, marginTop: 6 },

  /* 输入卡片 */
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.lg,
    ...shadow.sm,
  },
  heroEyebrow: {
    ...font.eyebrow,
    color: colors.text3,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  codeInput: {
    height: 60,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.primary,
    backgroundColor: colors.primarySofter,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    marginBottom: space.md,
  },

  /* 行动卡片 */
  sectionLabel: {
    ...font.eyebrow,
    color: colors.text3,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: space.sm,
    ...shadow.sm,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { fontSize: 22, fontWeight: '600' },
  actionTitle: { ...font.bodyStrong, color: colors.text1 },
  actionDesc: { ...font.caption, color: colors.text3, marginTop: 2 },
  actionArrow: { fontSize: 24, color: colors.text4, fontWeight: '300' },

  /* 通用按钮 */
  btnPrimary: {
    height: 50,
    paddingHorizontal: space.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { ...font.bodyStrong, color: '#fff' },

  footer: {
    ...font.caption,
    color: colors.text4,
    textAlign: 'center',
    marginTop: space.xl,
  },
});
