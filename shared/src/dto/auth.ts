export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  accessExpiresAt: number;
}

export interface RefreshResponse {
  accessToken: string;
  accessExpiresAt: number;
}
