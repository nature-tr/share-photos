import { Link, useLocalSearchParams, useRouter } from 'expo-router';
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
import { ApiException } from '@/api/client';
import { useAuth } from '@/stores/auth.store';
import { toast } from '@/utils/toast';
import { colors, font, radius, shadow, space } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      toast('请填写完整');
      return;
    }
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      toast('登录成功');
      const target = (params.redirect as string | undefined) || '/me/shares';
      router.replace(target as never);
    } catch (err) {
      toast(err instanceof ApiException ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <Text style={s.heroTitle}>欢迎回来</Text>
          <Text style={s.heroSub}>登录后管理你的分享相册</Text>
        </View>

        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.text4}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.text4}
              secureTextEntry
              style={s.input}
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />
          </View>

          <Pressable
            disabled={loading}
            style={({ pressed }) => [
              s.btn,
              (loading || pressed) && { opacity: 0.85 },
              !email.trim() || !password ? { opacity: 0.5 } : null,
            ]}
            onPress={onSubmit}
          >
            <Text style={s.btnText}>{loading ? '登录中…' : '登录'}</Text>
          </Pressable>
        </View>

        <View style={s.linkRow}>
          <Text style={s.linkLabel}>没有账号？</Text>
          <Link href="/auth/register" replace>
            <Text style={s.link}>立即注册</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  container: { padding: space.lg, paddingTop: space.xl },

  heroBlock: { marginBottom: space.lg, paddingHorizontal: 4 },
  heroTitle: { ...font.h1, color: colors.text1 },
  heroSub: { ...font.small, color: colors.text3, marginTop: 6 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    ...shadow.sm,
  },
  field: { marginBottom: space.md },
  label: { ...font.smallStrong, color: colors.text2, marginBottom: 6 },
  input: {
    height: 50,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text1,
  },
  btn: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  btnText: { ...font.bodyStrong, color: '#fff' },

  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: space.lg,
    gap: 4,
  },
  linkLabel: { ...font.small, color: colors.text3 },
  link: { ...font.smallStrong, color: colors.primary },
});
