/**
 * 将剩余毫秒数格式化为人类友好的字符串。
 * 如：1d 3h、5h 12m、3m 20s、已过期
 */
export declare function formatRemaining(ms: number): string;
export declare function formatBytes(bytes: number): string;
export declare function formatDateTime(ts: number): string;
