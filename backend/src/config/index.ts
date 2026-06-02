import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// backend/src/config → backend
const backendDir = path.resolve(__dirname, '../..');
// backend → 项目根
const projectRoot = path.resolve(backendDir, '..');

/** .env 里的相对路径相对 backend/ 解析（与运行 cwd 无关） */
function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(backendDir, p);
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

  dbPath: resolvePath(process.env.DB_PATH ?? '../data/app.db'),
  storageDir: resolvePath(process.env.STORAGE_DIR ?? '../storage'),

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  cookieSecure: process.env.COOKIE_SECURE === '1',

  projectRoot,
  backendDir,
} as const;
