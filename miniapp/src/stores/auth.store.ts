import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { UserDTO } from '@photo/shared/dto';
import { refreshAccessToken, logout as apiLogout } from '@/api/auth.api';

const STORAGE_KEY_TOKEN = 'access_token';
const STORAGE_KEY_REFRESH = 'refresh_token';
const STORAGE_KEY_REFRESH_EXP = 'refresh_expires_at';
const STORAGE_KEY_USER = 'auth_user';

interface AuthState {
  user: UserDTO | null;
  accessToken: string | null;
  setAuth: (user: UserDTO, accessToken: string, refreshToken?: string, refreshExpiresAt?: number) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

function persistUser(user: UserDTO) {
  Taro.setStorageSync(STORAGE_KEY_USER, JSON.stringify(user));
}

/** 从 storage 同步恢复用户信息 */
export function tryRestoreSession(): { user: UserDTO | null; token: string | null } {
  try {
    const token = Taro.getStorageSync(STORAGE_KEY_TOKEN);
    const raw = Taro.getStorageSync(STORAGE_KEY_USER);
    if (!token || !raw) return { user: null, token: null };
    const user = JSON.parse(raw) as UserDTO;
    if (!user || !user.id || !user.email) return { user: null, token: null };
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

function clearPersist() {
  Taro.removeStorageSync(STORAGE_KEY_TOKEN);
  Taro.removeStorageSync(STORAGE_KEY_REFRESH);
  Taro.removeStorageSync(STORAGE_KEY_REFRESH_EXP);
  Taro.removeStorageSync(STORAGE_KEY_USER);
}

async function silentRefresh(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const rt = Taro.getStorageSync(STORAGE_KEY_REFRESH) as string | null;
  if (!rt) return null;
  try {
    const refreshRes = await refreshAccessToken(rt);
    if (refreshRes.data) {
      const d = refreshRes.data;
      Taro.setStorageSync(STORAGE_KEY_TOKEN, d.accessToken);
      Taro.setStorageSync(STORAGE_KEY_REFRESH, d.refreshToken);
      if (d.refreshExpiresAt) Taro.setStorageSync(STORAGE_KEY_REFRESH_EXP, d.refreshExpiresAt);
      return { accessToken: d.accessToken, refreshToken: d.refreshToken };
    }
  } catch { /* ignore */ }
  return null;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,

  setAuth: (user, accessToken, refreshToken, refreshExpiresAt) => {
    Taro.setStorageSync(STORAGE_KEY_TOKEN, accessToken);
    persistUser(user);
    if (refreshToken) {
      Taro.setStorageSync(STORAGE_KEY_REFRESH, refreshToken);
      if (refreshExpiresAt) Taro.setStorageSync(STORAGE_KEY_REFRESH_EXP, refreshExpiresAt);
    }
    set({ user, accessToken });
  },

  logout: () => {
    const rt = Taro.getStorageSync(STORAGE_KEY_REFRESH);
    if (rt) apiLogout(rt).catch(() => {});
    clearPersist();
    set({ user: null, accessToken: null });
  },

  checkAuth: async () => {
    const { user, token } = tryRestoreSession();

    // 先在 store 中恢复本地已有的 session
    if (user && token) {
      set({ user, accessToken: token });
    }

    if (!token) return;

    // 后台验证 /me
    try {
      const meRes = await Taro.request({
        url: `${API_BASE}/api/auth/me`,
        method: 'GET',
        header: { Authorization: `Bearer ${token}` },
      });
      if (meRes.statusCode === 200 && meRes.data?.data?.user) {
        set({ user: meRes.data.data.user, accessToken: token });
        return;
      }
    } catch { return; }

    // /me 失败 → refresh
    const fresh = await silentRefresh();
    if (!fresh) {
      clearPersist();
      set({ user: null, accessToken: null });
      return;
    }

    // 新 token 再试 /me
    try {
      const meRes2 = await Taro.request({
        url: `${API_BASE}/api/auth/me`,
        method: 'GET',
        header: { Authorization: `Bearer ${fresh.accessToken}` },
      });
      if (meRes2.statusCode === 200 && meRes2.data?.data?.user) {
        set({ user: meRes2.data.data.user, accessToken: fresh.accessToken });
      } else {
        clearPersist();
        set({ user: null, accessToken: null });
      }
    } catch { /* 网络错误不清除 */ }
  },

  getAccessToken: async () => {
    const token = get().accessToken;
    if (token) return token;

    const cached = Taro.getStorageSync(STORAGE_KEY_TOKEN) as string | null;
    if (cached) {
      set({ accessToken: cached });
      return cached;
    }

    const fresh = await silentRefresh();
    if (fresh) {
      set({ accessToken: fresh.accessToken });
      return fresh.accessToken;
    }

    return null;
  },
}));

/** 后端 API 地址 */
export const API_BASE = 'https://www.dolmo.top';
