import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/stores/auth.store';
import { colors, radius, space } from '@/theme';
import { stackScreenOptions } from '../_layout';
import HeaderBackButton from '@/components/HeaderBackButton';

/**
 * /(me) 这一组都需要登录；未登录推到 login
 */
export default function MeLayout() {
  const router = useRouter();
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (ready && !user) {
      router.replace('/(auth)/login');
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
        <Pressable style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.btnText}>去登录</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        headerLeft: () => <HeaderBackButton />,
        headerBackVisible: false,
      }}
    >
      <Stack.Screen name="shares" options={{ title: '我的分享' }} />
      <Stack.Screen name="new" options={{ title: '新建分享' }} />
    </Stack>
  );
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
