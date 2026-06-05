import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
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
    bodyLimit: 2 * 1024 * 1024,
    http2: config.isProduction,  // 生产启用 HTTP/2 多路复用
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

  await app.register(compress, {
    global: true,       // 全局启用 gzip/brotli 压缩
    threshold: 1024,    // 1KB 以上才压缩
  });

  await app.register(rateLimit, {
    max: 500,           // 提高配额，图片请求分组
    timeWindow: '1 minute',
    allowList: [],
    keyGenerator: (req) => {
      const path = (req.raw.url ?? '/').split('?')[0] ?? '/';
      // 缩略图/中等图请求按 code 分组避免相互影响
      if (path.includes('/thumb')) return `${req.ip}-thumb`;
      if (path.includes('/medium')) return `${req.ip}-medium`;
      if (path.includes('/original')) return `${req.ip}-original`;
      return `${req.ip}-${path}`;
    },
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
