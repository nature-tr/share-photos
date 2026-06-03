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

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
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
            style={({ pressed }) => [s.scanCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/scan')}
          >
            <Text style={s.scanIcon}>⌒</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.scanTitle}>扫一扫</Text>
              <Text style={s.scanDesc}>对方分享了二维码？直接扫描进入</Text>
            </View>
            <Text style={s.scanArrow}>›</Text>
          </Pressable>

          {/* 个人入口 */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>账户</Text>
            {user ? (
              <View style={s.userBox}>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{user.displayName}</Text>
                  <Text style={s.userEmail}>{user.email}</Text>
                </View>
                <Link href="/(me)/shares" asChild>
                  <Pressable style={s.linkBtn}>
                    <Text style={s.linkBtnText}>我的分享</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View style={s.guestRow}>
                <Link href="/(auth)/login" asChild>
                  <Pressable style={[s.btnOutline, { flex: 1 }]}>
                    <Text style={s.btnOutlineText}>登录</Text>
                  </Pressable>
                </Link>
                <Link href="/(auth)/register" asChild>
                  <Pressable style={[s.btnPrimary, { flex: 1 }]}>
                    <Text style={s.btnPrimaryText}>注册</Text>
                  </Pressable>
                </Link>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  container: { padding: space.lg, paddingBottom: 60 },

  brand: { alignItems: 'center', marginTop: space.xl, marginBottom: space.xl },
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

  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: space.lg,
  },
  scanIcon: {
    fontSize: 28,
    color: colors.primary,
    width: 40,
    textAlign: 'center',
  },
  scanTitle: { fontSize: 15, fontWeight: '600', color: colors.text1 },
  scanDesc: { fontSize: 12, color: colors.text3, marginTop: 2 },
  scanArrow: { fontSize: 24, color: colors.text3 },

  section: { marginTop: space.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: space.sm,
    paddingHorizontal: 4,
  },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text1 },
  userEmail: { fontSize: 12, color: colors.text3, marginTop: 2 },
  guestRow: { flexDirection: 'row', gap: space.sm },

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
  btnOutline: {
    height: 48,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnOutlineText: { color: colors.text1, fontSize: 15, fontWeight: '600' },
  linkBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.full,
  },
  linkBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
