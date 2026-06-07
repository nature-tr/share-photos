/** 单文件最大字节数：50MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
/** 单分享照片数量上限 */
export const MAX_PHOTOS_PER_SHARE = 500;
/** 分享有效期范围 */
export const MIN_TTL_SECONDS = 5 * 60; // 5 分钟
export const MAX_TTL_SECONDS = 30 * 24 * 3600; // 30 天
/** 续期范围 */
export const MIN_EXTEND_SECONDS = 60;
export const MAX_EXTEND_SECONDS = 30 * 24 * 3600;
/** 分页 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** 受支持的 MIME 类型 */
export const SUPPORTED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
];
/** TTL 预设（秒） */
export const TTL_PRESETS = [
    { label: '1 小时', seconds: 3600 },
    { label: '6 小时', seconds: 6 * 3600 },
    { label: '1 天', seconds: 24 * 3600 },
    { label: '3 天', seconds: 3 * 24 * 3600 },
    { label: '7 天', seconds: 7 * 24 * 3600 },
    { label: '30 天', seconds: 30 * 24 * 3600 },
];
/** 上传并发数（前端） */
export const UPLOAD_CONCURRENCY = 3;
/** Token 有效期（毫秒） */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
