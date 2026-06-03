import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/stores/auth.store';
import { colors, radius, space } from '@/theme';

/**
 * /me 子路径：仅做认证守卫，未登录跳登录；header 由 root Stack 统一管理。
 */
export default function MeLayout() {
  const router = useRouter();
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (ready && !user) {
      router.replace('/auth/login');
    }
  }, [ready, user, router]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.text3, marginBottom: space.lg }}>需要登录</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.btnText}>去登录</Text>
        </Pressable>
      </View>
    );
  }
  return <Slot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },
  btn: {
    paddingHorizontal: space.xl,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
