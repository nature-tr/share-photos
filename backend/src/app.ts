import Fastify from 'fastify';
import cors, { type OriginFunction } from '@fastify/cors';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { shareRoutes } from './modules/share/share.routes.js';
import { photoRoutes } from './modules/photo/photo.routes.js';
import { viewerRoutes } from './modules/viewer/viewer.routes.js';
import { startCleanupCron } from './modules/cleanup/cleanup.cron.js';
import { MAX_FILE_SIZE } from '@photo/shared';

/* ───────── CORS origin 校验：白名单 + 局域网（仅开发） ───────── */

/** 是否为本地/局域网 origin（仅开发态放行） */
function isLanOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function makeCorsOriginCheck(): OriginFunction {
  const allow = new Set(config.corsOrigins);
  return (origin, cb) => {
    // 同源 / 直连（如 curl、移动端 webview）：origin 为空，放行
    if (!origin) { cb(null, true); return; }
    if (allow.has(origin)) { cb(null, true); return; }
    if (!config.isProduction && isLanOrigin(origin)) { cb(null, true); return; }
    cb(new Error('Not allowed by CORS'), false);
  };
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.isProduction ? 'info' : 'debug',
      transport: config.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss.l' },
          },
    },
    // 仅当 TRUSTED_PROXY_IPS 显式配置时才信任代理头
    trustProxy: config.trustProxy as any,
    bodyLimit: 2 * 1024 * 1024,
  });

  // 错误处理（先注册，后续抛错都能走自定义 handler）
  await app.register(errorHandlerPlugin);

  await app.register(cors, {
    origin: makeCorsOriginCheck(),
    credentials: true,
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 2000,
    timeWindow: '1 minute',
    allowList: [],
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
      // 防御 multipart fields 撑爆内存
      fields: 16,
      fieldNameSize: 100,
      fieldSize: 1024 * 100, // 100KB / field
      headerPairs: 200,
      parts: 32,
    },
  });

  await app.register(authPlugin);

  // 路由
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(shareRoutes, { prefix: '/api/shares' });
  await app.register(photoRoutes, { prefix: '/api/shares' });
  await app.register(viewerRoutes, { prefix: '/api/v' });

  // 健康检查
  app.get('/api/health', async () => ({ data: { ok: true, ts: Date.now() } }));

  // 启动后台清理
  app.ready(() => {
    startCleanupCron(app);
  });

  return app;
}
