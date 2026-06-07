# 格子橱窗 · 限时分享相册

> 轻量、自部署的在线图片分享应用：上传 → 限时分享码 → 凭码查看 → 一键存相册 → 到期自动清理。
>
> 三端覆盖：Web 前端 + App（React Native） + 微信小程序。

## 下载 📱

Android APK（v0.1.0，约 42 MB）：**[gezi-chuchuang-v0.1.0.apk](https://www.dolmo.top/gezi-chuchuang-v0.1.0.apk)**

Latest：**[gezi-chuchuang.apk](https://www.dolmo.top/gezi-chuchuang.apk)**

## 技术栈

| 端 | 技术 |
|---|---|
| **Web 前端** | Vite + Vue 3 + TypeScript + Pinia + TDesign Vue Next + UnoCSS + PhotoSwipe |
| **App（iOS / Android）** | Expo SDK 54 + React Native 0.81 + expo-router + Zustand |
| **微信小程序** | Taro 4 + React + Zustand + SCSS + 自建 SVG 图标库 |
| **后端** | Node.js 20 + Fastify 5 + TypeScript + better-sqlite3 + Drizzle ORM + Zod + JWT + sharp + argon2 |
| **工程** | pnpm workspace monorepo（`frontend/` + `app/` + `miniapp/` + `backend/` + `shared/`） |

详见 `docs/02-技术选型.md`、`docs/03-系统架构.md`。

## 目录结构

```
photo/
├── docs/          # 需求 / 选型 / 架构 / API / 移动端适配 / 待做清单
├── frontend/      # Vue 3 Web 前端
├── app/           # Expo + React Native App（iOS / Android）
├── miniapp/       # Taro 4 微信小程序
├── backend/       # Fastify 服务
├── shared/        # 前后端共享类型与常量
├── scripts/       # 部署 / 上传 / 修环境脚本
├── storage/       # 本地图片存储（运行时生成，已 gitignore）
└── data/          # SQLite 数据库（运行时生成，已 gitignore）
```

## 功能

### 核心流程
- 用户注册 / 登录（JWT 双 Token，登录态跨会话持久化）
- 创建分享：选图 → 标题 → 有效期 → 生成 8 位分享码 + 二维码
- 上传支持：原图 / 压缩两种模式，实时进度追踪
- sharp 自动生成缩略图 + 中等图 + 原图（JPEG + WebP 双格式，WebP 体积减少 25-35%）
- 凭码查看：网格预览 + PhotoSwipe 大图轮播
- 一键存全部到相册（后台异步，切换页面不中断）
- 单张保存 / 原图下载
- 分享管理：续期 / 结束 / 重命名 / 永久删除
- 到期自动清理（每分钟 cron 扫描，含文件清理）

### 进度与中断
- **全局上传 / 下载进度追踪**：悬浮大卡片实时展示任务进度，支持多任务分行
- **字节级中断**：暂停 / 取消时调用 `Taro.UploadTask.abort()` / `DownloadTask.abort()` 立即中断当前传输，不等待完整文件完成
- **拖拽自由**：大卡片和悬浮球可在屏幕上任意拖动位置，折叠态记忆跨会话保留
- **悬浮球模式**：大卡片可收起为右侧悬浮小球（带任务计数徽标），点击展开

### 协作功能
- 贡献者系统：申请加入 → 创建者审核 → 协作上传
- 补充上传：已有分享可追加新图片

### 浏览体验
- 最近浏览记录（自动清理过期、同步重命名、滚动位置恢复）
- 分页加载（50 张/页）
- Web 端支持移动端响应式布局

### 安全
- JWT access/refresh 双 token，refresh token 明文 + 哈希双重存储，支持重放检测
- 生产环境 JWT secret 强校验（缺失或过短拒绝启动）
- CORS 白名单 + 仅开发态放行 localhost/局域网
- 限流保护：login / register / refresh / viewer 各端点独立配置
- 路径穿越深度防御：thumb/medium 接入数据库存在性校验，ID 参数限制字符集
- refresh token hash 比较使用 `crypto.timingSafeEqual` 防时序攻击
- 4xx 错误消息白名单，避免库内部细节泄漏

## 开发

### 前置要求

- Node.js ≥ 20
- pnpm ≥ 9
- 微信开发者工具（小程序端）

### 安装与启动

```bash
# 安装依赖
npm_config_cache="$PWD/.npm-cache" pnpm install

# 准备后端环境变量
cp backend/.env.example backend/.env

# 初始化数据库
pnpm db:push

# 同时启动前后端
pnpm dev
```

- 前端默认运行在 http://localhost:5173
- 后端默认运行在 http://localhost:3000

### 单独启动

```bash
pnpm dev:backend
pnpm dev:frontend
```

### 小程序开发

```bash
pnpm --filter @photo/miniapp build:weapp
# 微信开发者工具打开 miniapp/dist
```

清缓存编译：开发者工具 → 清缓存 → 全部清除 → 普通编译。

### 环境变量

详见 `backend/.env.example`：

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 后端端口 | 3000 |
| `JWT_ACCESS_SECRET` | access token 秘钥（**生产必改**） | — |
| `JWT_REFRESH_SECRET` | refresh token 秘钥（**生产必改**） | — |
| `DB_PATH` | SQLite 文件路径 | `./data/app.db` |
| `STORAGE_DIR` | 图片存储目录 | `./storage` |
| `CORS_ORIGIN` | 允许的前端地址（逗号分隔） | http://localhost:5173 |
| `COOKIE_SECURE` | 是否仅 HTTPS Cookie | 0 |
| `TRUST_PROXY` | 是否信任反向代理（仅在有 nginx 等时开启） | 0 |

### 移动端 App 本地开发

```bash
cd app
pnpm -C ../shared build
pnpm start
```

### 移动端 App 本地打包

前置：JDK 17 + Android SDK build-tools 36。

```bash
cd app
pnpm -C ../shared build
npx expo prebuild --platform android --no-install
cd android && ./gradlew :app:assembleRelease --no-daemon --max-workers=2
```

上传到服务器：

```bash
bash scripts/upload-apk.sh
```

## 部署

### Web 前端

```bash
node scripts/build-frontend-release.mjs
bash scripts/deploy.sh frontend
```

### 后端

```bash
pnpm -F @photo/backend run build:release
bash scripts/deploy.sh backend
ssh root@www.dolmo.top 'pm2 reload photo-backend'
```

## 常见问题

### Q: 切换 Node 版本后启动报 `NODE_MODULE_VERSION` 不匹配

```bash
pnpm fix:native
```

或：

```bash
rm -rf node_modules backend/node_modules frontend/node_modules shared/node_modules
npm_config_cache="$PWD/.npm-cache" pnpm install
```

### Q: `pnpm install` 时 better-sqlite3 编译失败

```bash
npm_config_cache="$PWD/.npm-cache" pnpm install
```

### Q: 图片上传 400 `INVALID_IMAGE`

sharp 0.33.x API 变化所致。已修复 `backend/src/infra/image/processor.ts`。

### Q: 小程序重新进入不自动登录

检查微信开发者工具是否勾选了「清缓存 + 编译」。只点「编译」不会清 storage。真机预览无此问题。
