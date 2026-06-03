import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth.store';

/**
 * 路由守卫 hook：未登录则 replace 到登录页。
 *
 * 用法：在需要登录的页面顶部调用一次
 *   const ready = useRequireAuth();
 *   if (!ready) return <Loading />;
 */
export function useRequireAuth(): boolean {
  const router = useRouter();
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (ready && !user) {
      router.replace('/auth/login');
    }
  }, [ready, user, router]);

  return ready && !!user;
}
