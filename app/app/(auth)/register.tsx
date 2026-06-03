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
import { ApiException } from '@/api/client';
import { useAuth } from '@/stores/auth.store';
import { toast } from '@/utils/toast';
import { colors, radius, space } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      toast('请填写邮箱和密码');
      return;
    }
    if (password.length < 8) {
      toast('密码至少 8 位');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      toast('注册成功');
      router.replace('/(me)/shares');
    } catch (err) {
      toast(err instanceof ApiException ? err.message : '注册失败');
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
          <Text style={s.title}>创建账号</Text>
          <Text style={s.sub}>开始你的相册分享之旅</Text>

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
            <Text style={s.label}>密码（至少 8 位）</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.text3}
              secureTextEntry
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>昵称（可选）</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="你的称呼"
              placeholderTextColor={colors.text3}
              style={s.input}
              onSubmitEditing={onSubmit}
            />
          </View>

          <Pressable
            disabled={loading}
            style={({ pressed }) => [s.btn, (loading || pressed) && { opacity: 0.85 }]}
            onPress={onSubmit}
          >
            <Text style={s.btnText}>{loading ? '注册中…' : '注册'}</Text>
          </Pressable>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>已有账号？</Text>
            <Link href="/(auth)/login" replace>
              <Text style={s.link}>直接登录</Text>
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
