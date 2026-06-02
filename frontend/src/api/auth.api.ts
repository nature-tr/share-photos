import { request } from './client';
import type { AuthResponse, RefreshResponse, UserDTO } from '@photo/shared';

export const authApi = {
  register(input: { email: string; password: string; displayName?: string }) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    });
  },
  login(input: { email: string; password: string }) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    });
  },
  refresh() {
    return request<RefreshResponse>('/api/auth/refresh', {
      method: 'POST',
      auth: false,
      autoRefresh: false,
    });
  },
  logout() {
    return request<void>('/api/auth/logout', { method: 'POST', auth: false, autoRefresh: false });
  },
  me() {
    return request<UserDTO>('/api/auth/me');
  },
};
