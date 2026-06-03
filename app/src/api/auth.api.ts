import type { AuthResponse, RefreshResponse, UserDTO } from '@photo/shared';
import { request } from './client';

export const authApi = {
  register(input: { email: string; password: string; displayName?: string }) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
      autoRefresh: false,
    });
  },
  login(input: { email: string; password: string }) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
      autoRefresh: false,
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
    return request<void>('/api/auth/logout', {
      method: 'POST',
      autoRefresh: false,
    });
  },
  me() {
    return request<UserDTO>('/api/auth/me');
  },
};
