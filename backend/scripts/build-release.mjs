#!/usr/bin/env node
/**
 * 把 backend 打成生产可部署产物。
 *
 * 产物目录：<repo>/dist-release/backend/
 *   ├── server.js          # esbuild bundle（业务代码 + 纯 JS 依赖）
 *   ├── package.json       # 仅含 native / 动态加载类依赖，由服务器 npm install
 *   ├── migrations/        # drizzle SQL 迁移
 *   ├── .env.example
 *   └── README.md
 *
 * 服务器侧：
 *   cd dist-release/backend && cp .env.example .env
 *   npm install --omit=dev
 *   pm2 start server.js --name photo-backend
 */
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');
const sharedDir = path.join(repoRoot, 'shared');
const outDir = path.join(repoRoot, 'dist-release', 'backend');

/**
 * 必须 external 的依赖：含 native binding、动态 require、worker thread 加载。
 * 这些会写入 release/package.json，由服务器侧 npm install 安装对应平台版本。
 */
const externalDeps = {
  // native binding
  'better-sqlite3': '11.5.0',
  sharp: '^0.33.5',
  argon2: '^0.41.1',
  // 动态 require / worker thread
  fastify: '^5.1.0',
  '@fastify/cors': '^10.0.1',
  '@fastify/cookie': '^11.0.1',
  '@fastify/jwt': '^9.0.1',
  '@fastify/multipart': '^9.0.1',
  '@fastify/rate-limit': '^10.1.1',
  '@fastify/static': '^8.0.2',
  'fastify-plugin': '^5.0.1',
  pino: '^9.5.0',
  // archiver 内部 lazy require 子模块
  archiver: '^7.0.1',
  // node-cron CJS 模块内部使用 __dirname 加载 daemon worker，bundle 后失效
  'node-cron': '^3.0.3',
};

async function clean() {
  // 只清打包产物，保留 node_modules / data / storage / .env 等运行时状态
  await fs.mkdir(outDir, { recursive: true });
  const preserved = new Set(['node_modules', 'data', 'storage', '.env', '.npm-cache']);
  const entries = await fs.readdir(outDir);
  await Promise.all(
    entries
      .filter((name) => !preserved.has(name))
      .map((name) => fs.rm(path.join(outDir, name), { recursive: true, force: true }))
  );
}

async function bundleServer() {
  // 把 @photo/shared workspace alias 到源码，避免依赖 shared/dist
  const sharedEntry = path.join(sharedDir, 'src', 'index.ts');

  await build({
    entryPoints: [path.join(backendDir, 'src', 'server.ts')],
    outfile: path.join(outDir, 'server.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: 'linked',
    minify: false, // 体积换可读性，便于线上排错
    legalComments: 'none',
    logLevel: 'info',
    external: Object.keys(externalDeps),
    alias: {
      '@photo/shared': sharedEntry,
    },
    // ESM bundle 注入 require，兼容第三方包（drizzle-orm 等）内部的 require() 调用。
    // 不注入 __dirname/__filename：避免与 esbuild 把模块作用域变量提升到顶层后产生的同名 var 冲突，
    // 业务代码里需要的位置都已用 fileURLToPath(import.meta.url) 自行获取。
    banner: {
      js: [
        `import { createRequire as __photoCreateRequire } from 'module';`,
        `const require = __photoCreateRequire(import.meta.url);`,
      ].join('\n'),
    },
  });
}

async function copyMigrations() {
  const src = path.join(backendDir, 'src', 'db', 'migrations');
  const dst = path.join(outDir, 'migrations');
  await fs.cp(src, dst, { recursive: true });
}

async function writePackageJson() {
  const pkg = {
    name: 'photo-backend-release',
    version: '0.1.0',
    private: true,
    type: 'module',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
    },
    dependencies: externalDeps,
  };
  await fs.writeFile(
    path.join(outDir, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n',
    'utf8'
  );
}

async function writeEnvExample() {
  const content = `# ===== 在线共享相册 - 生产环境配置 =====

# 服务监听
PORT=3000
HOST=127.0.0.1            # 仅本机监听，外部走 nginx 反代
NODE_ENV=production

# JWT 秘钥（务必改成 64+ 位强随机串，可用：openssl rand -hex 48）
JWT_ACCESS_SECRET=please-change-me-to-a-long-random-string
JWT_REFRESH_SECRET=please-change-me-to-another-long-random-string

# 数据库与图片存储位置（相对 server.js 所在目录；首次启动自动创建）
DB_PATH=./data/app.db
STORAGE_DIR=./storage

# 允许的前端来源（逗号分隔），nginx 同域时填部署域名即可
CORS_ORIGIN=https://your-domain.example.com

# 启用 https 时置 1；http 调试时置 0
COOKIE_SECURE=1
`;
  await fs.writeFile(path.join(outDir, '.env.example'), content, 'utf8');
}

async function writeReadme() {
  const content = `# Photo Backend - Release Bundle

这是 \`backend\` 已打包的生产产物：单文件 \`server.js\` + 极简依赖 + drizzle 迁移。

## 服务器部署

需要：Node.js 20 LTS（推荐 20.x）。

\`\`\`bash
# 1) 进入产物目录
cd dist-release/backend

# 2) 配置环境变量
cp .env.example .env
vim .env                # 至少改 JWT_*、CORS_ORIGIN、COOKIE_SECURE

# 3) 安装运行时依赖（会自动拉对应平台的 better-sqlite3 / sharp / argon2 prebuild）
npm install --omit=dev

# 4) 用 pm2 守护
npm i -g pm2            # 已装可跳过
pm2 start server.js --name photo-backend --update-env
pm2 save                # 持久化进程列表
pm2 startup             # 按提示执行命令开机自启
\`\`\`

## 启动后会发生什么

- 自动在当前目录创建 \`data/app.db\`（SQLite，WAL 模式）
- 自动应用 \`migrations/\` 下的 SQL 建表
- 在当前目录创建 \`storage/{originals,previews,mediums}\`
- 监听 \`HOST:PORT\`（默认 \`127.0.0.1:3000\`）
- node-cron 每分钟扫描过期分享并清理

## Nginx 参考配置

\`\`\`nginx
server {
  listen 443 ssl http2;
  server_name your-domain.example.com;

  ssl_certificate     /etc/letsencrypt/live/your-domain.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.example.com/privkey.pem;

  # 前端静态产物
  root /opt/photo/frontend/dist;
  index index.html;

  client_max_body_size 200m;     # 图片上传

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \\$host;
    proxy_set_header X-Real-IP \\$remote_addr;
    proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\$scheme;
    proxy_read_timeout 300s;
    proxy_request_buffering off;  # 上传大文件流式
  }

  location / {
    try_files \\$uri \\$uri/ /index.html;
  }
}

server {
  listen 80;
  server_name your-domain.example.com;
  return 301 https://\\$host\\$request_uri;
}
\`\`\`

## 升级

后续重新打包后，覆盖 \`server.js\` / \`migrations/\` 即可（保留 \`data/\` 与 \`storage/\`）：

\`\`\`bash
pm2 reload photo-backend
\`\`\`

## 常见问题

- **better-sqlite3 报 NODE_MODULE_VERSION 不匹配**：服务器 Node 版本与 prebuild 不一致。请使用 Node 20 LTS，或在产物目录跑 \`npm rebuild better-sqlite3\`。
- **sharp 安装失败**：内网环境可设置 \`SHARP_IGNORE_GLOBAL_LIBVIPS=1\` 或镜像 \`npm config set sharp_binary_host=https://npmmirror.com/mirrors/sharp\`。
- **图片上传 413**：调大 nginx \`client_max_body_size\`。
- **登录后 cookie 不种**：确认 \`.env\` 里 \`COOKIE_SECURE=1\` 且站点是 HTTPS。
`;
  await fs.writeFile(path.join(outDir, 'README.md'), content, 'utf8');
}

async function main() {
  const t0 = Date.now();
  console.log('[release] cleaning', outDir);
  await clean();

  console.log('[release] bundling server.js ...');
  await bundleServer();

  console.log('[release] copying drizzle migrations ...');
  await copyMigrations();

  console.log('[release] writing package.json / .env.example / README.md ...');
  await writePackageJson();
  await writeEnvExample();
  await writeReadme();

  const stat = await fs.stat(path.join(outDir, 'server.js'));
  console.log(
    `[release] done in ${Date.now() - t0}ms, server.js = ${(stat.size / 1024).toFixed(1)} KB`
  );
  console.log(`[release] output: ${outDir}`);
}

main().catch((err) => {
  console.error('[release] FAILED:', err);
  process.exit(1);
});
