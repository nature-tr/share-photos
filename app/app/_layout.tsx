import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth.store';

export default function RootLayout() {
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#0f172a',
            headerTitleStyle: { fontWeight: '600' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: '#f8fafc' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ title: '扫码', presentation: 'modal' }} />
          <Stack.Screen name="viewer/[code]" options={{ title: '相册' }} />
          <Stack.Screen name="(auth)/login" options={{ title: '登录' }} />
          <Stack.Screen name="(auth)/register" options={{ title: '注册' }} />
          <Stack.Screen name="(me)/shares" options={{ title: '我的分享' }} />
          <Stack.Screen name="(me)/new" options={{ title: '新建分享' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
