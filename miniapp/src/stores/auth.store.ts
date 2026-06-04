import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { UserDTO } from '@photo/shared/dto';

interface AuthState {
  user: UserDTO | null;
  accessToken: string | null;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  // 登录/注册成功后调用
  setAuth: (user: UserDTO, accessToken: string) => void;
  // 退出登录
  logout: () => void;
  // 启动时从本地恢复 token 并验证
  checkAuth: () => Promise<void>;
  // 获取有效的 access token（过期则自动刷新）
  getAccessToken: () => Promise<string | null>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  setIsLoading: (v) => set({ isLoading: v }),

  setAuth: (user, accessToken) => {
    Taro.setStorageSync('access_token', accessToken);
    set({ user, accessToken });
  },

  logout: () => {
    Taro.removeStorageSync('access_token');
    set({ user: null, accessToken: null });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = Taro.getStorageSync('access_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // 调用后端 /api/auth/me 验证 token 是否有效
      const res = await Taro.request({
        url: `${API_BASE}/api/auth/me`,
        method: 'GET',
        header: { Authorization: `Bearer ${token}` },
      });
      if (res.statusCode === 200 && res.data?.data?.user) {
        set({ user: res.data.data.user, accessToken: token });
      } else {
        Taro.removeStorageSync('access_token');
        set({ user: null, accessToken: null });
      }
    } catch {
      set({ user: null, accessToken: null });
    } finally {
      set({ isLoading: false });
    }
  },

  getAccessToken: async () => {
    const token = get().accessToken;
    if (token) return token;
    const cached = Taro.getStorageSync('access_token');
    if (cached) {
      set({ accessToken: cached });
      return cached;
    }
    return null;
  },
}));

/** 后端 API 地址 */
export const API_BASE = 'https://www.dolmo.top';
