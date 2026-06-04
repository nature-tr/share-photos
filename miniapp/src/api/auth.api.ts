import { api } from './client';
import type { UserDTO } from '@photo/shared/dto';

interface AuthResponse {
  user: UserDTO;
  accessToken: string;
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

export async function logout() {
  return api('/api/auth/logout', { method: 'POST' });
}
