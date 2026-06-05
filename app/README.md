# 格子橱窗 App

React Native + Expo 实现的移动 App。**核心功能**：扫二维码 / 粘贴分享码 → 看相册 → **一键全部保存到手机相册**（这是网页版做不到的）。

## 功能清单

- ✅ 邮箱注册 / 登录（refresh token 持久化到 SecureStore）
- ✅ 首页：粘贴分享码 / 扫码进入
- ✅ 扫一扫（expo-camera，识别二维码或链接里的 8 位码）
- ✅ 相册查看：缩略图网格 + 全屏滑动大图
- ✅ **一键保存所有图到系统相册**（expo-media-library，iOS Photos / Android MediaStore）
- ✅ 单张保存（大图查看时右上角"保存到相册"）
- ✅ 我的分享列表：状态、剩余时间、续期、提前结束
- ✅ 新建分享：选图（多选）+ 串行上传 + 进度条 + 成功页

## 本地开发

```bash
# 1) 在仓库根装依赖（pnpm workspace 会一起装 app）
pnpm install

# 2) 启动开发服务器
pnpm -F @photo/app start
# 或 cd app && pnpm start

# 3) 真机调试：手机商店装 "Expo Go" → 扫终端二维码即可
#    电脑模拟器：按 i (iOS Simulator) 或 a (Android Emulator)
```

## 配置 API 地址

App 的 API 基址来自 `app.json` 的 `extra.apiBaseUrl`，默认指向：
```
https://www.dolmo.top
```

如需指向其他后端（比如本地开发的局域网 IP），用环境变量临时覆盖：
```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000 pnpm -F @photo/app start
```

## 打包成 ipa / apk（无需本地 Xcode/Android Studio）

用 Expo 的 EAS Build（云端打包）：

```bash
# 1) 装 eas-cli（一次）
npm i -g eas-cli

# 2) 登录 Expo 账号（一次）
eas login

# 3) 配置 credentials（首次构建时会问，按 y 让 Expo 托管即可）
cd app

# 4) 构建预览版（iOS 出 .app for 模拟器，Android 出 .apk）
eas build --profile preview --platform android   # 或 ios
# 构建完成后会给一个下载链接

# 5) 构建生产版（用于 TestFlight / Google Play）
eas build --profile production --platform android
eas build --profile production --platform ios
```

构建配置在 `eas.json`：
- `development`：开发版（含 Expo Dev Client）
- `preview`：内测版（Android `.apk` / iOS Simulator `.app`，便于直接发给朋友安装）
- `production`：正式版（App Store / Google Play）

## 提交到商店

```bash
eas submit --platform ios       # 走 TestFlight
eas submit --platform android   # 走 Google Play
```

需要先在 `eas.json` 的 `submit.production` 里填 ASC API Key 等凭据，参考 https://docs.expo.dev/submit/introduction/

## 关键依赖说明

| 包 | 作用 |
|---|---|
| `expo-router` | 文件系统路由（类似 Next.js） |
| `expo-camera` | 扫码 |
| `expo-media-library` | **写入系统相册**（核心差异化能力） |
| `expo-file-system` | 下载图片到 cache |
| `expo-image-picker` | 选图上传 |
| `expo-image` | 高效图片渲染 + 缓存 |
| `expo-secure-store` | 加密存 refresh token |
| `zustand` | 全局状态（auth） |
| `@photo/shared` | 与网页端共享 zod schema / 常量 / DTO 类型 |

## 后端兼容

App 通过 `X-Refresh-Token` header（而非浏览器 cookie）携带 refresh token。后端 `/api/auth/refresh` 已兼容三种来源：
- `cookie.rt`（网页）
- `X-Refresh-Token` header（App）
- `body.refreshToken`（保留兼容）

## 目录结构

```
app/
├── app/                   # 路由（expo-router 文件路由）
│   ├── _layout.tsx        # Root layout + auth bootstrap
│   ├── index.tsx          # 首页：粘贴码 / 扫码 / 我的入口
│   ├── scan.tsx           # 扫一扫
│   ├── viewer/[code].tsx  # 相册查看 + 一键保存到相册
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (me)/
│       ├── _layout.tsx    # 守卫：未登录跳 login
│       ├── shares.tsx     # 我的分享列表
│       └── new.tsx        # 新建分享 + 上传
├── src/
│   ├── api/               # client / auth.api / share.api
│   ├── stores/            # zustand auth store
│   ├── utils/             # saveToAlbum / toast / format
│   └── theme.ts           # 设计 token
├── app.json               # Expo 配置 + 权限文案
├── eas.json               # 构建配置
├── babel.config.js
├── metro.config.js        # 处理 pnpm monorepo
└── tsconfig.json
```

## 常见问题

**Q: Expo Go 里能用全部功能吗？**

A: 99% 可以。但 `expo-media-library` 的写入相册在最新 Expo Go 上有时受限，建议跑预览版构建（`eas build --profile preview`）实测保存功能。

**Q: iOS 真机调试需要 Apple 开发者账号吗？**

A: 用 Expo Go 不需要。打包真机安装包需要 99 美元/年的开发者账号（或者用模拟器版本免费）。Android 完全不需要。

**Q: 局域网调试连不上后端？**

A: `app.json` 默认 `apiBaseUrl=https://www.dolmo.top`。本地连后端用 `EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000 pnpm start` 覆盖，且后端 `.env` 的 `CORS_ORIGIN` 加上 `*`（移动端不依赖 CORS，但避免警告）。
