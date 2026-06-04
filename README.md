# 在线共享相册 (Photo Album)

一个轻量、自部署的在线图片分享网页：上传 → 限时分享码 → 凭码查看 → 单张/批量下载 → 到期自动清理。
同时提供原生 Android App（Expo + React Native），支持相机扫码、选图上传、保存到相册等原生能力。

## 下载 📱

Android APK（v0.1.0，约 42 MB）：**[dolmo-photo-v0.1.0.apk](https://www.dolmo.top/dolmo-photo-v0.1.0.apk)**
Latest：**[dolmo-photo.apk](https://www.dolmo.top/dolmo-photo.apk)**

## 技术栈

- **Web 前端**：Vite + Vue 3 + TypeScript + Pinia + Vue Router + TDesign Vue Next + UnoCSS + 原生 fetch + PhotoSwipe
- **移动端 App**：Expo SDK 54 + React Native 0.81 + expo-router + Zustand + expo-image + expo-camera
- **后端**：Node.js + Fastify + TypeScript + better-sqlite3 + Drizzle ORM + Zod + JWT + argon2 + sharp + node-cron + archiver
- **工程**：pnpm workspace monorepo（`frontend/` + `app/` + `backend/` + `shared/`）

详见 `docs/02-技术选型.md`、`docs/03-系统架构.md`。

## 目录结构

```
photo/
├── docs/          # 需求 / 选型 / 架构 / API 文档
├── frontend/      # Vue 3 Web 前端
├── app/           # Expo + React Native 原生移动端
├── backend/       # Fastify 服务
├── shared/        # 前后端共享类型与常量
├── scripts/       # 部署 / 上传 / 修环境脚本
├── storage/       # 本地图片存储（运行时生成，已 gitignore）
└── data/          # SQLite 数据库（运行时生成，已 gitignore）
```

## 开发

### 前置要求

- Node.js ≥ 20
- pnpm ≥ 9

### 安装与启动

```bash
# 安装依赖（首次安装如遇到 ~/.npm/_prebuilds 权限问题，可用项目级缓存）
npm_config_cache="$PWD/.npm-cache" pnpm install

# 准备后端环境变量
cp backend/.env.example backend/.env

# 初始化数据库（首次或表结构变更后运行）
pnpm db:push

# 同时启动前后端
pnpm dev
```

- 前端默认运行在 http://localhost:5173
- 后端默认运行在 http://localhost:3000（API 前缀 `/api`，前端 Vite 代理到后端）

### 单独启动

```bash
pnpm dev:backend
pnpm dev:frontend
```

### 数据库与存储

- SQLite 文件位于 `data/app.db`（首次启动自动应用迁移）
- 图片存储于 `storage/{originals,previews,mediums}/<shareId>/`
- 表结构变更时：修改 `backend/src/db/schema.ts` → 运行 `pnpm db:generate` 生成迁移 → 重启后端自动应用

### 环境变量

详见 `backend/.env.example`：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `PORT` | 后端端口 | 3000 |
| `JWT_ACCESS_SECRET` | access token 秘钥（**生产必改**） | dev-... |
| `JWT_REFRESH_SECRET` | refresh token 秘钥（**生产必改**） | dev-... |
| `DB_PATH` | SQLite 文件路径 | `../data/app.db` |
| `STORAGE_DIR` | 图片存储目录 | `../storage` |
| `CORS_ORIGIN` | 允许的前端地址 | http://localhost:5173 |
| `COOKIE_SECURE` | 是否仅 HTTPS Cookie（生产置 1） | 0 |

### 移动端 App 本地开发

```bash
cd app
pnpm -C ../shared build     # 编译 shared 包
pnpm start                  # 启动 Expo dev server
# 按 a → Android 模拟器，或扫码 Expo Go 运行
```

### 移动端 App 本地打包

详见 `docs/05-实现说明与启动指引.md` 第 8.4 节。

前置：JDK 17 + Android SDK build-tools 36。

```bash
cd app
pnpm -C ../shared build
npx expo prebuild --platform android --no-install
cd android && ./gradlew :app:assembleRelease --no-daemon --max-workers=2
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

上传到服务器：

```bash
bash scripts/upload-apk.sh
```

## 常见问题

### Q: 切换 Node 版本后启动报 `NODE_MODULE_VERSION` 不匹配

`better-sqlite3` / `sharp` / `argon2` 都是 native 模块，预编译二进制与具体 Node ABI 绑定。切 Node 版本后用：

```bash
pnpm fix:native
```

这个脚本会清掉旧的 build 产物，按当前 Node 版本重新拉 prebuild 或本地编译。

如果仍失败，使用核选项重装：

```bash
rm -rf node_modules backend/node_modules frontend/node_modules shared/node_modules
npm_config_cache="$PWD/.npm-cache" pnpm install
```

### Q: `pnpm install` 时 better-sqlite3 编译失败

通常是 `~/.npm/_prebuilds/` 被 root 占用，prebuild-install 写入失败回退到本机编译。
固定方案：使用项目级缓存

```bash
npm_config_cache="$PWD/.npm-cache" pnpm install
```

## 功能

### 已实现（MVP）

**Web 前端 + 后端**：
- 用户注册 / 登录（轻量账号）
- JWT 双 Token（access + refresh，rotate）
- 创建分享：选有效期 → 生成分享码 → 上传图片
- 上传支持：原图 / 前端压缩 两种模式
- 后端 sharp 自动生成缩略图与中等图
- 凭码查看：网格预览 + 大图浏览（PhotoSwipe）
- 下载：单张原图 / 全量 zip 流式打包
- 分享管理：续期 / 提前结束
- 到期自动清理（node-cron 每分钟扫描）

**原生移动端 App**（Android APK 已上线）：
- 注册/登录、凭码访问、创建分享、手机相册选图上传
- 相机扫码（expo-camera）
- 保存图片到手机相册（原生权限）
- 品牌化图标与启动屏

### 后续规划

- AI 筛图（剔除模糊/拍废）
- AI 选片（高光精选）
- HEIC 服务端转码
- 上传分片续传 / 秒传
- 对象存储 + CDN
- Docker 部署
