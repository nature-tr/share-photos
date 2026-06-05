import { api } from './client';
import type { UserDTO } from '@photo/shared/dto';

interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export async function login(email: string, password: string) {
  return api<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function register(email: string, password: string, displayName?: string) {
  return api<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
  });
}

export async function getMe() {
  return api<{ user: UserDTO }>('/api/auth/me');
}

export async function refreshAccessToken(refreshToken: string) {
  return api<{
    accessToken: string;
    accessExpiresAt: number;
    refreshToken: string;
    refreshExpiresAt: number;
  }>('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function logout(refreshToken?: string) {
  return api('/api/auth/logout', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : undefined,
  });
}
