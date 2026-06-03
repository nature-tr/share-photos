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
import { colors, radius, space } from '@/theme';

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
      const target = (params.redirect as string | undefined) || '/(me)/shares';
      // expo-router 类型限制 replace 接受字符串字面量；这里目标都是已知静态路径，强制断言
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
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.title}>欢迎回来</Text>
          <Text style={s.sub}>登录后管理你的分享相册</Text>

          <View style={s.field}>
            <Text style={s.label}>邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.text3}
              autoCapitalize="none"
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
              placeholderTextColor={colors.text3}
              secureTextEntry
              style={s.input}
              onSubmitEditing={onSubmit}
            />
          </View>

          <Pressable
            disabled={loading}
            style={({ pressed }) => [s.btn, (loading || pressed) && { opacity: 0.85 }]}
            onPress={onSubmit}
          >
            <Text style={s.btnText}>{loading ? '登录中…' : '登录'}</Text>
          </Pressable>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>没有账号？</Text>
            <Link href="/(auth)/register" replace>
              <Text style={s.link}>立即注册</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  container: { padding: space.lg, paddingTop: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text1, marginBottom: 6 },
  sub: { fontSize: 13, color: colors.text3, marginBottom: space.lg },
  field: { marginBottom: space.md },
  label: { fontSize: 13, color: colors.text2, marginBottom: 6, fontWeight: '500' },
  input: {
    height: 48,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text1,
  },
  btn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: space.lg,
    gap: 4,
  },
  linkLabel: { color: colors.text3, fontSize: 13 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
