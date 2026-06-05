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

/** 直接从 storage 读取 user，不走 zustand 订阅链 */
export function getUserFromStorage(): UserDTO | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY_USER);
    if (!raw) return null;
    const u = JSON.parse(raw) as UserDTO;
    return u?.id ? u : null;
  } catch { return null; }
}

/** 还原：什么都不做，只写 zustand */
function restoreToStore(set: (s: Partial<AuthState>) => void) {
  const u = getUserFromStorage();
  const t = Taro.getStorageSync(STORAGE_KEY_TOKEN) as string | null;
  if (u && t) set({ user: u, accessToken: t });
}

function persistUser(user: UserDTO) {
  Taro.setStorageSync(STORAGE_KEY_USER, JSON.stringify(user));
}
function clearPersist() {
  Taro.removeStorageSync(STORAGE_KEY_TOKEN);
  Taro.removeStorageSync(STORAGE_KEY_REFRESH);
  Taro.removeStorageSync(STORAGE_KEY_REFRESH_EXP);
  Taro.removeStorageSync(STORAGE_KEY_USER);
}

async function silentRefresh(): Promise<string | null> {
  const rt = Taro.getStorageSync(STORAGE_KEY_REFRESH) as string | null;
  if (!rt) return null;
  try {
    const r = await refreshAccessToken(rt);
    if (r.data) {
      Taro.setStorageSync(STORAGE_KEY_TOKEN, r.data.accessToken);
      Taro.setStorageSync(STORAGE_KEY_REFRESH, r.data.refreshToken);
      if (r.data.refreshExpiresAt) Taro.setStorageSync(STORAGE_KEY_REFRESH_EXP, r.data.refreshExpiresAt);
      return r.data.accessToken;
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
    // 先把 storage 里的值灌到 store
    restoreToStore(set);

    const token = Taro.getStorageSync(STORAGE_KEY_TOKEN) as string | null;
    if (!token) return;

    // 用 token 调 /me 验证
    try {
      const me = await Taro.request({
        url: `${API_BASE}/api/auth/me`,
        method: 'GET',
        header: { Authorization: `Bearer ${token}` },
      });
      if (me.statusCode === 200 && me.data?.data?.user) {
        set({ user: me.data.data.user, accessToken: token });
        return;
      }
    } catch { return; }

    // 过期 → refresh
    const freshToken = await silentRefresh();
    if (!freshToken) {
      clearPersist();
      set({ user: null, accessToken: null });
      return;
    }

    try {
      const me2 = await Taro.request({
        url: `${API_BASE}/api/auth/me`,
        method: 'GET',
        header: { Authorization: `Bearer ${freshToken}` },
      });
      if (me2.statusCode === 200 && me2.data?.data?.user) {
        set({ user: me2.data.data.user, accessToken: freshToken });
      } else {
        clearPersist();
        set({ user: null, accessToken: null });
      }
    } catch { /* 网络错不清除 */ }
  },

  getAccessToken: async () => {
    const token = get().accessToken;
    if (token) return token;
    const cached = Taro.getStorageSync(STORAGE_KEY_TOKEN) as string | null;
    if (cached) { set({ accessToken: cached }); return cached; }
    const ft = await silentRefresh();
    if (ft) { set({ accessToken: ft }); return ft; }
    return null;
  },
}));

export const API_BASE = 'https://www.dolmo.top';
