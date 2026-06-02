/**
 * 基于原生 fetch 的 API 客户端。
 * 自动注入 access token、自动 refresh、统一错误处理。
 */
import { ErrorCode, type ApiError } from '@photo/shared';

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

export const tokenStore = {
  set(token: string, expiresAt: number) {
    accessToken = token;
    accessExpiresAt = expiresAt;
  },
  get(): string | null {
    return accessToken;
  },
  clear() {
    accessToken = null;
    accessExpiresAt = 0;
  },
  isExpiringSoon(): boolean {
    // 提前 30 秒认为过期
    return !accessToken || Date.now() >= accessExpiresAt - 30_000;
  },
};

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    tokenStore.clear();
    throw new ApiException('NETWORK_ERROR', '网络异常', 0);
  }
  if (!resp.ok) {
    tokenStore.clear();
    throw await toApiException(resp);
  }
  const json = (await resp.json()) as { data: { accessToken: string; accessExpiresAt: number } };
  tokenStore.set(json.data.accessToken, json.data.accessExpiresAt);
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
  /** 默认 true：自动注入 token；公开接口可设为 false */
  auth?: boolean;
  /** 默认 true：失败 401 时自动刷新一次重试 */
  autoRefresh?: boolean;
  /** 取消信号 */
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(path, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.pathname + url.search;
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
      bodyInit = opts.body;
    } else {
      headers['Content-Type'] = 'application/json';
      bodyInit = JSON.stringify(opts.body);
    }
  }

  if (auth && tokenStore.get()) {
    headers.Authorization = `Bearer ${tokenStore.get()}`;
  }

  const url = buildUrl(path, opts.query);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: bodyInit,
      credentials: 'include',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiException('NETWORK_ERROR', '网络异常', 0);
  }

  if (resp.status === 401 && auth && autoRefresh) {
    // 尝试刷新一次
    try {
      await ensureFreshToken();
    } catch {
      tokenStore.clear();
      onUnauthorized?.();
      throw await toApiException(resp);
    }
    // 重试一次
    return request<T>(path, { ...opts, autoRefresh: false });
  }

  if (resp.status === 204) {
    return undefined as T;
  }

  if (!resp.ok) {
    const exc = await toApiException(resp);
    // 仅在「需要鉴权的接口」遇 401 时触发全局未登录处理；
    // 对 auth=false 的接口（refresh/login/register）401 是正常业务错误，不应触发踢下线
    if (resp.status === 401 && auth) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    throw exc;
  }

  const ct = resp.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const json = (await resp.json()) as { data: T };
    return json.data;
  }
  // 非 JSON 响应（比如二进制下载）
  return resp as unknown as T;
}

/** 上传文件，带进度回调（使用 XHR 因为 fetch 没原生进度 API） */
export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    if (tokenStore.isExpiringSoon()) {
      try {
        await ensureFreshToken();
      } catch {
        // 刷新失败也继续，让 XHR 自然 401
      }
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path), true);
    xhr.withCredentials = true;
    if (tokenStore.get()) {
      xhr.setRequestHeader('Authorization', `Bearer ${tokenStore.get()}`);
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      const ct = xhr.getResponseHeader('content-type') ?? '';
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204) {
          resolve(undefined as T);
          return;
        }
        if (ct.includes('application/json')) {
          try {
            const json = JSON.parse(xhr.responseText) as { data: T };
            resolve(json.data);
            return;
          } catch (err) {
            reject(new ApiException('PARSE_ERROR', '响应解析失败', xhr.status));
            return;
          }
        }
        resolve(xhr.response as T);
        return;
      }
      // 错误
      try {
        const body = JSON.parse(xhr.responseText) as ApiError;
        reject(
          new ApiException(
            String(body.error?.code ?? ErrorCode.INTERNAL_ERROR),
            body.error?.message ?? `HTTP ${xhr.status}`,
            xhr.status,
            body.error?.details,
          ),
        );
      } catch {
        reject(new ApiException(ErrorCode.INTERNAL_ERROR, `HTTP ${xhr.status}`, xhr.status));
      }
    });
    xhr.addEventListener('error', () => {
      reject(new ApiException('NETWORK_ERROR', '网络异常', 0));
    });
    xhr.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'));
    });

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(formData);
  });
}
