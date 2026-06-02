import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { UserDTO } from '@photo/shared';
import { authApi } from '@/api/auth.api';
import { tokenStore, setOnUnauthorized } from '@/api/client';
import router from '@/router';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDTO | null>(null);
  const restored = ref(false);

  const isAuthenticated = computed(() => !!user.value);

  function applyAuth(payload: { user: UserDTO; accessToken: string; accessExpiresAt: number }) {
    user.value = payload.user;
    tokenStore.set(payload.accessToken, payload.accessExpiresAt);
  }

  async function register(input: { email: string; password: string; displayName?: string }) {
    const res = await authApi.register(input);
    applyAuth(res);
  }

  async function login(input: { email: string; password: string }) {
    const res = await authApi.login(input);
    applyAuth(res);
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    user.value = null;
    tokenStore.clear();
  }

  /** 应用启动时尝试用 refresh cookie 恢复登录态 */
  async function tryRestore() {
    if (restored.value) return;
    restored.value = true;
    try {
      const r = await authApi.refresh();
      tokenStore.set(r.accessToken, r.accessExpiresAt);
      const me = await authApi.me();
      user.value = me;
    } catch {
      user.value = null;
      tokenStore.clear();
    }
  }

  // 401 兜底：清状态 + 跳登录
  setOnUnauthorized(() => {
    user.value = null;
    tokenStore.clear();
    if (router.currentRoute.value.meta.requiresAuth) {
      router.push({ name: 'login' });
    }
  });

  return { user, restored, isAuthenticated, register, login, logout, tryRestore };
});
