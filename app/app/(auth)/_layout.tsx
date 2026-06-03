import { Stack } from 'expo-router';
import { stackScreenOptions } from '../_layout';

export default function AuthLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="login" options={{ title: '登录' }} />
      <Stack.Screen name="register" options={{ title: '注册' }} />
    </Stack>
  );
}
