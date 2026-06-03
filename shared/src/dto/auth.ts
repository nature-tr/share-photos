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
  /**
   * 移动端使用：响应 body 里同时返回 refresh token 明文，以便 App 持久化到
   * SecureStore（浏览器端忽略此字段，仍使用 httpOnly cookie 自动维持登录态）。
   */
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface RefreshResponse {
  accessToken: string;
  accessExpiresAt: number;
  /** 同上：移动端续期时使用 */
  refreshToken: string;
  refreshExpiresAt: number;
}
