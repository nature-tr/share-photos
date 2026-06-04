import Taro from '@tarojs/taro';
import { useAuth, API_BASE } from '@/stores/auth.store';

/**
 * 小程序请求封装。
 * - 自动注入 Bearer token
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

  // 关键：微信 wx.request 默认 Content-Type = application/json。
  // 若 body 为空 / 无 body，但 Content-Type 仍是 application/json，
  // Fastify 解析空 body 会抛 400，所以这里：
  //   - 有 body → 正常 application/json
  //   - 无 body → 显式发 {} 避免空 body 触发解析失败
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

    // 401 → 尝试刷新 token 后重试一次
    if (res.statusCode === 401) {
      try {
        const refreshRes = await Taro.request({
          url: `${API_BASE}/api/auth/refresh`,
          method: 'POST',
        });
        if (refreshRes.statusCode === 200) {
          const newToken = (refreshRes.data as any)?.data?.accessToken;
          if (newToken) {
            useAuth.setState({ accessToken: newToken });
            Taro.setStorageSync('access_token', newToken);
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
        }
      } catch {
        // refresh 失败，往下走
      }
      useAuth.getState().logout();
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
