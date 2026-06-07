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

const isProduction = process.env.NODE_ENV === 'production';

/* ─────────── JWT 密钥校验 ─────────── */
/**
 * 生产环境：必须显式提供 JWT_ACCESS_SECRET / JWT_REFRESH_SECRET，且长度 ≥ 32；
 * 开发环境：缺失时使用本地默认值（**仅供开发**）。
 */
function requireSecret(name: string, devDefault: string): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    if (isProduction) {
      // 生产强退出，避免用弱密钥签发 token
      // eslint-disable-next-line no-console
      console.error(
        `[config] FATAL: ${name} 必须在生产环境中设置且长度 ≥ 32 字符`,
      );
      process.exit(1);
    }
    return devDefault;
  }
  return v;
}

/* ─────────── 受信代理 IP 解析 ─────────── */
/**
 * 仅在 TRUSTED_PROXY_IPS 显式配置时启用 trustProxy（白名单形式）。
 * 多个 IP/CIDR 用逗号分隔；缺省（包括开发态）一律 false，避免 X-Forwarded-For 伪造。
 */
function parseTrustProxy(): boolean | string[] {
  const raw = process.env.TRUSTED_PROXY_IPS?.trim();
  if (!raw) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ─────────── CORS 白名单 ─────────── */
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,

  jwt: {
    accessSecret: requireSecret(
      'JWT_ACCESS_SECRET',
      'dev-access-secret-please-change-me-in-production-32chars',
    ),
    refreshSecret: requireSecret(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret-please-change-me-in-production-32chars',
    ),
  },

  dbPath: resolvePath(process.env.DB_PATH ?? './data/app.db'),
  storageDir: resolvePath(process.env.STORAGE_DIR ?? './storage'),

  /** CORS 允许的 origin 列表（不接受通配符 true） */
  corsOrigins: parseCorsOrigins(),
  /** 受信代理白名单，false 表示不信任任何代理头 */
  trustProxy: parseTrustProxy(),

  cookieSecure: process.env.COOKIE_SECURE === '1',

  baseDir,
} as const;
