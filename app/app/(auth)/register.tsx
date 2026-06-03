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
import { colors, font, radius, shadow, space } from '@/theme';

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
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <Text style={s.heroTitle}>创建账号</Text>
          <Text style={s.heroSub}>开始你的相册分享之旅</Text>
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
            <Text style={s.label}>
              密码 <Text style={s.labelHint}>至少 8 位</Text>
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.text4}
              secureTextEntry
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>
              昵称 <Text style={s.labelHint}>可选</Text>
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="你的称呼"
              placeholderTextColor={colors.text4}
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
              (!email.trim() || password.length < 8) && { opacity: 0.5 },
            ]}
            onPress={onSubmit}
          >
            <Text style={s.btnText}>{loading ? '注册中…' : '注册'}</Text>
          </Pressable>
        </View>

        <View style={s.linkRow}>
          <Text style={s.linkLabel}>已有账号？</Text>
          <Link href="/(auth)/login" replace>
            <Text style={s.link}>直接登录</Text>
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
  labelHint: { ...font.caption, color: colors.text4, fontWeight: '400' },
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
