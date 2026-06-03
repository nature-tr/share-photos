import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth.store';

/**
 * 全局 Stack 屏幕选项：
 * - headerBackTitle/headerBackButtonDisplayMode：去掉 iOS 上返回按钮旁的「上一页标题」，
 *   避免与当前页标题挤在一起（用户反馈的"返回按钮和标题小冲突"）
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
          <Stack.Screen name="scan" options={{ title: '扫码', presentation: 'modal' }} />
          <Stack.Screen name="viewer/[code]" options={{ title: '相册' }} />
          {/* 分组路由：子 layout 自己负责注册页面与标题 */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(me)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
