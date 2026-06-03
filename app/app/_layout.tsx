import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth.store';

/**
 * 子 layout 用的 Stack 公共选项：
 * - headerBackTitle/headerBackButtonDisplayMode：去掉 iOS 上返回按钮旁的「上一页标题」
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
 * Root Stack：默认所有页面都不显示 header，由各页 / 各分组 layout 自己负责。
 * 这样可以彻底避免「root 给分组 (me)/(auth) 显示一条 header + 子 Stack 又显示一条」
 * 的双 top bar 问题。
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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f8fafc' } }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
