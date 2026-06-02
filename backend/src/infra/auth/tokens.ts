import crypto from 'node:crypto';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** 生成 64 字符的高熵随机字符串作为 refresh token 明文 */
export function generateRefreshTokenPlain(): string {
  return crypto.randomBytes(48).toString('base64url');
}
