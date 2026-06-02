import Fastify from 'fastify';
import cors from '@fastify/cors';
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
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024, // JSON body 2MB（图片走 multipart）
  });

  // 错误处理（先注册，后续抛错都能走自定义 handler）
  await app.register(errorHandlerPlugin);

  await app.register(cors, {
    // 开发模式：允许任何 origin（含局域网 IP），方便手机调试；生产严格按 .env 配置
    origin: config.isProduction
      ? config.corsOrigin.split(',').map((s) => s.trim())
      : true,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    allowList: [],
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
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
