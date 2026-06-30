# Changelog

所有值得记录的项目变更都会写入此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [1.0.0] - 2026-06-30

> 这是格子橱窗小程序第一个功能完整的里程碑版本。在 0.0.2 的扫码修复基础上，完成了大量功能补齐、性能优化、UX 打磨和代码质量提升。

### 新增功能 (Added)

- **图片双指缩放预览**：查看页点击图片调用 `Taro.previewImage`，原生支持双指缩放、滑动浏览。
- **批量管理分享**：小程序和 Web 端"我的分享"页面支持选择模式，可批量结束、批量永久删除。
  - 批量删除前自动对处于生效中的分享先执行结束再删除，避免 403。
  - 管理模式下自动隐藏 FAB 按钮，避免遮挡批量操作条。
- **Web 端功能同步**：
  - 分享重命名（点击标题输入新名称）。
  - 已结束/已清理分享的永久删除按钮。
- **权限问题深度复盘文档**：`docs/权限问题深度复盘.md`，包含 errno:112 死锁全链路分析和微任务边界问题。
- **CHANGELOG.md**：从此版本开始维护变更日志。

### 性能优化 (Performance)

- **后端上传异步化**：图片变体生成（thumb/medium 四图）不再阻塞上传响应，改为 `setImmediate` 后台异步执行。
- **viewer 缩略图降级兜底**：变体未生成时自动降级到原图，避免 404。
- **后端 N+1 查询优化**：
  - `shareService.list()` 批量查询 pending 贡献者数 + 首图 ID，从 N×2 次查询降为 2 次。
  - `shareService.getById()` 批量查询用户信息替代逐条循环。
- **useNow Hook 优化**：用 ref 追踪秒级时间戳，仅真实变化时才 setState，减少无效渲染。
- **GlobalProgress `useActiveTasks`**：加 `useMemo` 缓存，避免每次渲染创建新数组。

### Bug 修复 (Fixed)

- **上传完成刷新 Bug**：`lastUpStatusRef` 初始 `undefined` 导致 `prev &&` 短路，首次上传完成后 album 不刷新。
- **并发上传进度倒退**：多个 worker 先后完成时，局部 `done`/`failed` 变量可能被旧值覆盖。改为使用共享引用 `ctx.done`/`ctx.failed`。
- **pause/resume 后进度丢失**：`updateUpload`/`updateDownload` 在 status 非 uploading/downloading 时跳过写入。修复后 store 不再检查 status。
- **悬浮窗页面跳转去重逻辑**：旧逻辑仅按路由名字判断（只要在 new/index 就跳过所有任务）。修复为按 `shareId`/`shareCode` 精确匹配。
- **IndexPage `useDidShow` 内存泄漏**：异步历史校验返回时页面可能已卸载，加 `showSeq` ref 序列号校验。
- **GlobalProgress 切面消失**：Taro App 层 fixed 元素会被 Page native view 遮挡，改回在各页面内渲染，位置初始化统一在 `app.tsx` `useLaunch` 中执行一次。
- **批量 API 静默失败**：`batchEndShares`/`batchDeleteShares` 未检查 `api()` 返回的 `error` 字段，失败也弹成功 toast。

### 代码质量 (Refactored)

- **miniapp API 错误处理统一**：提取 `assertOk()` 辅助函数，4 个 mutation API 统一使用。
- **viewer 页面类型安全**：消除全部 13 处 `as any` 断言，`getViewerShare` 泛型修正为 `ViewerAlbum`。
- **移除冗余功能**：上传/下载页的"最小化"按钮和 `enableAlertBeforeUnload` 全部移除，简化页面栈管理。
- **login/register `setTimeout` 泄漏修复**：`useEffect` 返回 cleanup，组件卸载时清除 redirect timer。
- **IndexPage render 副作用消除**：`setStorageUser` 从 render 移至 `useEffect`。
- **handleLoadMore 错误处理**：`await` 替代 `.then()`，加 `try/catch` + toast 错误提示。
- **saveAll 分页拉取错误处理**：加 `try/catch` + loading 提示 + 降级处理。
- **useLoad 类型安全**：`(options?.code as string)` → `String(options?.code ?? '')` + 空值判断。

---

## [0.0.2] - 2026-06-29

### Bug 修复 (Fixed)

- **扫码无法识别 Web 二维码**：之前扫码拿到完整 URL `https://www.dolmo.top/v/CODE` 后直接当分享码传给 viewer，导致 404。
  - 新增 `extractCode()` 函数，用纯字符串解析（`lastIndexOf('/')`）+ 官方 `SHARE_CODE_REGEX` 提取分享码。
  - 不再依赖 `new URL()`（小程序环境不支持）。
  - 支持三种输入格式：纯分享码、完整 URL、含分享码的文本。
- **后端上传阻塞**：sharp 四图处理在响应前同步执行，小程序上传等待时间过长。改为 `setImmediate` 异步处理，viewer 访问时若变体未就绪自动降级到原图。

### 新增功能 (Added)

- **Web 端重命名分享**：API `PATCH /api/shares/{id}/rename` + 点击标题弹输入框。
- **Web 端永久删除分享**：API `POST /api/shares/{id}/destroy` + 已结束/已清理卡片删除按钮。

---

## [0.0.1] - 2026-06-28

### 新增功能 (Added)

- **微信隐私合规**：`__usePrivacyCheck__` + `PrivacyConsent` 全局弹窗 + `AgreementCheckbox` 勾选框 + 内建隐私政策/用户协议页面。
- **字节级上传/下载任务管理器** (`task.manager.ts`)：全局单例持有 `Taro.UploadTask`/`DownloadTask` 句柄，支持暂停/恢复/取消，暂停调用 `.abort()` 即时中断。
- **GlobalProgress 悬浮进度窗**：可拖动大卡片 + 可折叠悬浮球，全页面共享。经历 6+ 次迭代后最终采用 `disableScroll: true` + `ScrollView` 方案解决拖动穿透问题。
- **后台上传/下载**：上传/下载进行中底部显示"最小化"按钮，`navigateTo` 首页保住页面不销毁。
- **`enableAlertBeforeUnload` 返回拦截**：上传/下载中误按返回键弹出警告。
- **相册写入权限引导** (`requestWriteAlbumPermission`)：`wx.authorize` → 被拒后 `Modal` 引导去 `openSetting`。

### Bug 修复 (Fixed)

- **chooseMedia errno:112 死锁**：微信客户端缓存"已删除"的隐私授权状态与服务端声明不同步，`onNeedPrivacyAuthorization` 无法打破死锁。最终方案：注释 `__usePrivacyCheck__: true`，隐私合规通过管理后台声明保证。
- **chooseMedia 微任务边界问题**：`showActionSheet` 的 success 回调在嵌套微任务中，`onNeedPrivacyAuthorization→resolve→重试` 无法穿透。修复：`chooseMedia` 必须在 async 函数顶层调用。
- **上传完成页横向挤压**：去掉 max-width 约束，加 `flex-shrink: 0` + `overflow-y: auto`。
- **上传超时失败**：默认 60s 不够大图用，改为 300s。大图（>5MB）先 `Taro.compressImage` 压缩再上传。
- **上传串行慢**：从 `for` 循环改为 3 并发 worker。

### 代码质量 (Refactored)

- 后端安全加固：JWT secret 强制检查、CORS 白名单、rate limiting 分级、`timingSafeEqual` token 比较。
- 前端类型安全：Web 端移除 `as any`，miniapp 加 `useShallow`/`useNow`。
- 任务状态管理分离：`task.store`（UI 快照）+ `task.manager`（执行上下文），解耦页面生命周期。

---

## [0.0.0] - 2026-06-27 及之前

### 新增功能 (Added)

- **项目基础架构**：pnpm monorepo（shared / backend / frontend / app / miniapp）。
- **后端 API**：Fastify + Drizzle ORM (SQLite)，JWT 认证，multipart 文件上传，sharp 图片处理。
- **小程序核心功能**：
  - 邮箱注册/登录 + JWT token 自动刷新。
  - 创建限时分享相册（可选有效期）。
  - 选择图片上传到指定分享。
  - 凭分享码加入查看相册（网格视图 + 照片元数据）。
  - 一键批量保存到手机相册。
  - 首页分享码输入 + 扫码入口 + 最近浏览记录。
- **Web 前端**：Vue 3 + TDesign，完整分享管理、照片上传（带进度条）、查看器。
- **React Native App**：Expo 构建，与 Web 共享 API 层。
- **通用 shared 包**：DTO 类型、Zod schema 校验、常量（分享码格式、文件大小限制、有效期预设）。
