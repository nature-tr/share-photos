/** 单文件最大字节数：50MB */
export declare const MAX_FILE_SIZE: number;
/** 单分享照片数量上限 */
export declare const MAX_PHOTOS_PER_SHARE = 500;
/** 分享有效期范围 */
export declare const MIN_TTL_SECONDS: number;
export declare const MAX_TTL_SECONDS: number;
/** 续期范围 */
export declare const MIN_EXTEND_SECONDS = 60;
export declare const MAX_EXTEND_SECONDS: number;
/** 分页 */
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
/** 受支持的 MIME 类型 */
export declare const SUPPORTED_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
/** TTL 预设（秒） */
export declare const TTL_PRESETS: readonly [{
    readonly label: "1 小时";
    readonly seconds: 3600;
}, {
    readonly label: "6 小时";
    readonly seconds: number;
}, {
    readonly label: "1 天";
    readonly seconds: number;
}, {
    readonly label: "3 天";
    readonly seconds: number;
}, {
    readonly label: "7 天";
    readonly seconds: number;
}, {
    readonly label: "30 天";
    readonly seconds: number;
}];
/** 上传并发数（前端） */
export declare const UPLOAD_CONCURRENCY = 3;
/** Token 有效期（毫秒） */
export declare const ACCESS_TOKEN_TTL_MS: number;
export declare const REFRESH_TOKEN_TTL_MS: number;
