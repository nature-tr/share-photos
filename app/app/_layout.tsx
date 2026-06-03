import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth.store';

/**
 * 共用 Stack 选项：
 * - headerBackTitle/headerBackButtonDisplayMode：iOS 不显示上一页标题
 */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: '#ffffff' },
  headerTintColor: '#0f172a',
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 16 },
  headerShadowVisible: false,
  headerBackTitle: '',
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: '#f8fafc' },
};

/**
 * Root Stack：所有路由都注册在这里，保证 native-stack 在 push 二级页时
 * 自动渲染原生返回按钮（iOS 液态玻璃 ‹）。
 *
 * /me 路径下用 _layout.tsx (Slot + 认证守卫) 控制访问。
 */
export default function RootLayout() {
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="scan"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="viewer/[code]" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ title: '登录' }} />
          <Stack.Screen name="auth/register" options={{ title: '注册' }} />
          <Stack.Screen name="me/shares" options={{ title: '我的分享' }} />
          <Stack.Screen name="me/new" options={{ title: '新建分享' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
