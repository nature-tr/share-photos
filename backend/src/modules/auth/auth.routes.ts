import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { registerSchema, loginSchema } from '@photo/shared';
import { authService } from './auth.service.js';
import { config } from '../../config/index.js';
import { Errors } from '../../common/errors.js';
import { now } from '../../common/time.js';

const REFRESH_COOKIE = 'rt';
const REFRESH_COOKIE_PATH = '/api/auth';

function setRefreshCookie(reply: FastifyReply, value: string, expiresAt: number) {
  reply.setCookie(REFRESH_COOKIE, value, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

function buildAccessToken(app: FastifyInstance, userId: string, email: string) {
  const accessToken = app.jwt.sign({ sub: userId, email });
  return {
    accessToken,
    accessExpiresAt: now() + authService.accessTokenTtlMs,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // 注册
  app.post('/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const user = await authService.register(body);
    const ctx = { userAgent: req.headers['user-agent'] ?? undefined, ip: req.ip };
    const refresh = await authService.issueRefreshToken(user.id, ctx);
    const access = buildAccessToken(app, user.id, user.email);

    setRefreshCookie(reply, refresh.refreshTokenPlain, refresh.refreshExpiresAt);
    reply.code(201).send({ data: { user, ...access } });
  });

  // 登录
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await authService.login(body);
    const ctx = { userAgent: req.headers['user-agent'] ?? undefined, ip: req.ip };
    const refresh = await authService.issueRefreshToken(user.id, ctx);
    const access = buildAccessToken(app, user.id, user.email);

    setRefreshCookie(reply, refresh.refreshTokenPlain, refresh.refreshExpiresAt);
    reply.send({ data: { user, ...access } });
  });

  // 刷新 token
  app.post('/refresh', async (req, reply) => {
    const cookie = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!cookie) throw Errors.refreshInvalid();
    const ctx = { userAgent: req.headers['user-agent'] ?? undefined, ip: req.ip };
    const { userId, tokens } = await authService.rotateRefreshToken(cookie, ctx);
    const user = await authService.getById(userId);
    const access = buildAccessToken(app, user.id, user.email);

    setRefreshCookie(reply, tokens.refreshTokenPlain, tokens.refreshExpiresAt);
    reply.send({ data: access });
  });

  // 登出
  app.post('/logout', async (req, reply) => {
    const cookie = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    await authService.revokeRefreshToken(cookie);
    clearRefreshCookie(reply);
    reply.code(204).send();
  });

  // 当前用户
  app.get('/me', { preHandler: [app.authenticate] }, async (req: FastifyRequest) => {
    const userId = req.currentUser!.sub;
    const user = await authService.getById(userId);
    return { data: user };
  });
}
