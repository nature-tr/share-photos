import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users, refreshTokens } from '../../db/schema.js';
import { Errors } from '../../common/errors.js';
import { newId, newJti } from '../../common/id.js';
import { now } from '../../common/time.js';
import { hashPassword, verifyPassword } from '../../infra/auth/password.js';
import { sha256, generateRefreshTokenPlain } from '../../infra/auth/tokens.js';
import { REFRESH_TOKEN_TTL_MS, ACCESS_TOKEN_TTL_MS } from '@photo/shared';
import type { UserDTO } from '@photo/shared';

export interface RegisterParams {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface IssueTokensContext {
  userAgent?: string;
  ip?: string;
}

export interface IssueTokensResult {
  refreshTokenPlain: string;
  refreshTokenId: string;
  refreshExpiresAt: number;
}

function toUserDTO(u: typeof users.$inferSelect): UserDTO {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName ?? u.email.split('@')[0]!,
    createdAt: u.createdAt,
  };
}

export const authService = {
  async register(params: RegisterParams): Promise<UserDTO> {
    const email = params.email.trim().toLowerCase();
    const exists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (exists) throw Errors.emailTaken();

    const id = newId();
    const ts = now();
    const hash = await hashPassword(params.password);

    await db
      .insert(users)
      .values({
        id,
        email,
        passwordHash: hash,
        displayName: params.displayName ?? email.split('@')[0]!,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();

    const user = await db.select().from(users).where(eq(users.id, id)).get();
    return toUserDTO(user!);
  },

  async login(params: LoginParams): Promise<UserDTO> {
    const email = params.email.trim().toLowerCase();
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) throw Errors.invalidCredentials();

    const ok = await verifyPassword(user.passwordHash, params.password);
    if (!ok) throw Errors.invalidCredentials();

    return toUserDTO(user);
  },

  async getById(userId: string): Promise<UserDTO> {
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw Errors.unauthorized('用户不存在');
    return toUserDTO(user);
  },

  /** 签发并存储 refresh token，返回明文以便下发到 cookie */
  async issueRefreshToken(
    userId: string,
    ctx: IssueTokensContext = {},
  ): Promise<IssueTokensResult> {
    const id = newJti();
    const plain = generateRefreshTokenPlain();
    const tokenHash = sha256(plain);
    const issuedAt = now();
    const expiresAt = issuedAt + REFRESH_TOKEN_TTL_MS;

    await db
      .insert(refreshTokens)
      .values({
        id,
        userId,
        tokenHash,
        issuedAt,
        expiresAt,
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
      })
      .run();

    return { refreshTokenPlain: `${id}.${plain}`, refreshTokenId: id, refreshExpiresAt: expiresAt };
  },

  /**
   * Rotate：校验旧 refresh token，吊销并签发新的。
   * 检测重放：若发现旧 token 已被 revoke，吊销整链并抛错。
   */
  async rotateRefreshToken(
    rawCookie: string,
    ctx: IssueTokensContext = {},
  ): Promise<{ userId: string; tokens: IssueTokensResult }> {
    const dotIdx = rawCookie.indexOf('.');
    if (dotIdx <= 0) throw Errors.refreshInvalid();
    const id = rawCookie.slice(0, dotIdx);
    const plain = rawCookie.slice(dotIdx + 1);
    const tokenHash = sha256(plain);

    const record = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, id))
      .get();
    if (!record) throw Errors.refreshInvalid();
    if (record.tokenHash !== tokenHash) throw Errors.refreshInvalid();
    if (record.expiresAt <= now()) throw Errors.refreshInvalid();

    if (record.revokedAt !== null) {
      // 重放：吊销该用户所有未吊销的 refresh token
      await db
        .update(refreshTokens)
        .set({ revokedAt: now() })
        .where(and(eq(refreshTokens.userId, record.userId), isNull(refreshTokens.revokedAt)))
        .run();
      throw Errors.refreshReused();
    }

    const newTokens = await this.issueRefreshToken(record.userId, ctx);

    await db
      .update(refreshTokens)
      .set({ revokedAt: now(), replacedBy: newTokens.refreshTokenId })
      .where(eq(refreshTokens.id, id))
      .run();

    return { userId: record.userId, tokens: newTokens };
  },

  async revokeRefreshToken(rawCookie: string | undefined): Promise<void> {
    if (!rawCookie) return;
    const dotIdx = rawCookie.indexOf('.');
    if (dotIdx <= 0) return;
    const id = rawCookie.slice(0, dotIdx);
    await db
      .update(refreshTokens)
      .set({ revokedAt: now() })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .run();
  },

  accessTokenTtlMs: ACCESS_TOKEN_TTL_MS,
  refreshTokenTtlMs: REFRESH_TOKEN_TTL_MS,
};
