import { create } from 'zustand';
import type { UserDTO } from '@photo/shared';
import { authApi } from '@/api/auth.api';
import { setOnUnauthorized, tokenStore } from '@/api/client';

interface AuthState {
  user: UserDTO | null;
  ready: boolean;
  /** App 启动时调用：从 SecureStore 恢复 refresh token，再用它换 user + access */
  bootstrap: () => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** 调用方式：useAuth.getState().setUnauthorized(...) ; */
  _onUnauthorized: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  ready: false,

  async bootstrap() {
    await tokenStore.restore();
    if (tokenStore.isRefreshValid()) {
      try {
        const r = await authApi.refresh();
        await tokenStore.setAll(
          r.accessToken,
          r.accessExpiresAt,
          r.refreshToken,
          r.refreshExpiresAt,
        );
        const me = await authApi.me();
        set({ user: me });
      } catch {
        await tokenStore.clear();
        set({ user: null });
      }
    }
    set({ ready: true });
  },

  async login(input) {
    const r = await authApi.login(input);
    await tokenStore.setAll(
      r.accessToken,
      r.accessExpiresAt,
      r.refreshToken,
      r.refreshExpiresAt,
    );
    set({ user: r.user });
  },

  async register(input) {
    const r = await authApi.register(input);
    await tokenStore.setAll(
      r.accessToken,
      r.accessExpiresAt,
      r.refreshToken,
      r.refreshExpiresAt,
    );
    set({ user: r.user });
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    await tokenStore.clear();
    set({ user: null });
  },

  _onUnauthorized() {
    void tokenStore.clear();
    set({ user: null });
  },
}));

// 注册全局 401 处理：清状态
setOnUnauthorized(() => {
  useAuth.getState()._onUnauthorized();
});
