import path from 'node:path';

/**
 * 基准目录：
 * - 显式优先：APP_BASE_DIR 环境变量
 * - 否则使用进程当前工作目录（process.cwd()）
 *   • 开发：从仓库根 `pnpm -F backend dev` 时 cwd = backend/
 *   • 生产：pm2 / node 在 release 目录启动时 cwd = release/
 *   data/、storage/ 都会落在该基准目录下，可移植、可打包。
 */
const baseDir = process.env.APP_BASE_DIR
  ? path.resolve(process.env.APP_BASE_DIR)
  : process.cwd();

/** .env 里的相对路径相对 baseDir 解析 */
function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(baseDir, p);
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
  },

  dbPath: resolvePath(process.env.DB_PATH ?? './data/app.db'),
  storageDir: resolvePath(process.env.STORAGE_DIR ?? './storage'),

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  cookieSecure: process.env.COOKIE_SECURE === '1',

  baseDir,
} as const;
