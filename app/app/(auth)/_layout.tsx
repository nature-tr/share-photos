import { Stack } from 'expo-router';
import HeaderBackButton from '@/components/HeaderBackButton';
import { stackScreenOptions } from '../_layout';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        headerLeft: () => <HeaderBackButton />,
        headerBackVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: '登录' }} />
      <Stack.Screen name="register" options={{ title: '注册' }} />
    </Stack>
  );
}
