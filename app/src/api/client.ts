/**
 * App 端 API 客户端：基于 fetch + SecureStore 持久化 token。
 *
 * 与 web 端的区别：
 * - 没有浏览器 cookie，refresh token 通过 X-Refresh-Token header 传递
 * - access token 内存即可；refresh token 持久化到 SecureStore
 */
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ErrorCode, type ApiError } from '@photo/shared';

const RT_KEY = 'photo.refresh_token';
const RT_EXP_KEY = 'photo.refresh_expires_at';

// 优先用 expo-constants extra.apiBaseUrl（来自 app.json）
// 也允许通过 EXPO_PUBLIC_API_BASE_URL 环境变量覆盖
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  'https://www.dolmo.top';

export class ApiException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshTokenCache: string | null = null;
let refreshExpiresAt = 0;
let restored = false;

export const tokenStore = {
  setAccess(token: string, expiresAt: number) {
    accessToken = token;
    accessExpiresAt = expiresAt;
  },
  async setRefresh(token: string, expiresAt: number) {
    refreshTokenCache = token;
    refreshExpiresAt = expiresAt;
    await SecureStore.setItemAsync(RT_KEY, token);
    await SecureStore.setItemAsync(RT_EXP_KEY, String(expiresAt));
  },
  async setAll(at: string, atExp: number, rt: string, rtExp: number) {
    this.setAccess(at, atExp);
    await this.setRefresh(rt, rtExp);
  },
  getAccess(): string | null {
    return accessToken;
  },
  getRefresh(): string | null {
    return refreshTokenCache;
  },
  isAccessExpiringSoon(): boolean {
    return !accessToken || Date.now() >= accessExpiresAt - 30_000;
  },
  isRefreshValid(): boolean {
    return !!refreshTokenCache && Date.now() < refreshExpiresAt;
  },
  async clear() {
    accessToken = null;
    accessExpiresAt = 0;
    refreshTokenCache = null;
    refreshExpiresAt = 0;
    await SecureStore.deleteItemAsync(RT_KEY);
    await SecureStore.deleteItemAsync(RT_EXP_KEY);
  },
  /** App 启动时调用一次：从 SecureStore 加载 refresh token */
  async restore() {
    if (restored) return;
    restored = true;
    const rt = await SecureStore.getItemAsync(RT_KEY);
    const exp = await SecureStore.getItemAsync(RT_EXP_KEY);
    if (rt && exp) {
      refreshTokenCache = rt;
      refreshExpiresAt = Number(exp);
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  if (!refreshTokenCache) {
    throw new ApiException('REFRESH_INVALID', '未登录', 401);
  }
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Refresh-Token': refreshTokenCache,
      },
    });
  } catch {
    throw new ApiException('NETWORK_ERROR', '网络异常', 0);
  }
  if (!resp.ok) {
    await tokenStore.clear();
    throw await toApiException(resp);
  }
  const json = (await resp.json()) as {
    data: {
      accessToken: string;
      accessExpiresAt: number;
      refreshToken: string;
      refreshExpiresAt: number;
    };
  };
  await tokenStore.setAll(
    json.data.accessToken,
    json.data.accessExpiresAt,
    json.data.refreshToken,
    json.data.refreshExpiresAt,
  );
}

async function ensureFreshToken(): Promise<void> {
  if (refreshPromise) {
    await refreshPromise;
    return;
  }
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  await refreshPromise;
}

async function toApiException(resp: Response): Promise<ApiException> {
  let body: ApiError | null = null;
  try {
    body = (await resp.json()) as ApiError;
  } catch {
    // ignore
  }
  const code = body?.error?.code ?? ErrorCode.INTERNAL_ERROR;
  const message = body?.error?.message ?? `HTTP ${resp.status}`;
  return new ApiException(String(code), message, resp.status, body?.error?.details);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  auth?: boolean;
  autoRefresh?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const base = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  if (!query) return base;
  const url = new URL(base);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth !== false;
  const autoRefresh = opts.autoRefresh !== false;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers ?? {}),
  };

  let bodyInit: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      bodyInit = opts.body as unknown as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      bodyInit = JSON.stringify(opts.body);
    }
  }

  if (auth && tokenStore.getAccess()) {
    headers.Authorization = `Bearer ${tokenStore.getAccess()}`;
  }

  const url = buildUrl(path, opts.query);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: bodyInit,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiException('NETWORK_ERROR', '网络异常', 0);
  }

  if (resp.status === 401 && auth && autoRefresh && tokenStore.getRefresh()) {
    try {
      await ensureFreshToken();
    } catch {
      onUnauthorized?.();
      throw await toApiException(resp);
    }
    return request<T>(path, { ...opts, autoRefresh: false });
  }

  if (resp.status === 204) {
    return undefined as T;
  }

  if (!resp.ok) {
    const exc = await toApiException(resp);
    if (resp.status === 401 && auth && autoRefresh) {
      await tokenStore.clear();
      onUnauthorized?.();
    }
    throw exc;
  }

  const ct = resp.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const json = (await resp.json()) as { data: T };
    return json.data;
  }
  return resp as unknown as T;
}
