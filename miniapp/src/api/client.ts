import Taro from '@tarojs/taro';
import { useAuth, API_BASE } from '@/stores/auth.store';
import { refreshAccessToken } from './auth.api';

/**
 * 小程序请求封装。
 * - 自动注入 Bearer token
 * - 401 时自动用 refresh token 刷新（带正确的 body）
 * - 返回 { data, error } 统一格式
 */
export async function api<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    formData?: boolean;
  } = {}
): Promise<{ data?: T; error?: { code: string; message: string } }> {
  const { method = 'GET', body, headers, formData } = options;

  const token = await useAuth.getState().getAccessToken();

  const header: Record<string, string> = {
    ...headers,
  };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  let dataToSend: any = body;
  if (!formData) {
    header['Content-Type'] = 'application/json';
    if (body === undefined || body === null) {
      dataToSend = {};
    }
  }

  try {
    const res = await Taro.request({
      url: `${API_BASE}${path}`,
      method,
      header,
      data: dataToSend,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const payload = res.data as any;
      return { data: payload.data ?? payload };
    }

    // 401 → 用本地 refreshToken 刷新一次后重试
    if (res.statusCode === 401 && path !== '/api/auth/refresh' && path !== '/api/auth/me') {
      const rt = Taro.getStorageSync('refresh_token') as string | null;
      if (rt) {
        try {
          const refreshRes = await refreshAccessToken(rt);
          const newToken = refreshRes.data?.accessToken;
          if (newToken) {
            useAuth.setState({ accessToken: newToken });
            header['Authorization'] = `Bearer ${newToken}`;
            const retryRes = await Taro.request({
              url: `${API_BASE}${path}`,
              method,
              header,
              data: dataToSend,
            });
            if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
              const payload = retryRes.data as any;
              return { data: payload.data ?? payload };
            }
          }
        } catch {
          /* refresh 失败也不清空 */
        }
      }
    }

    const errPayload = res.data as any;
    return {
      error: {
        code: errPayload?.error?.code ?? 'UNKNOWN',
        message: errPayload?.error?.message ?? '请求失败',
      },
    };
  } catch (e: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: e?.errMsg ?? '网络错误',
      },
    };
  }
}
