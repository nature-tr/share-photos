import { z } from 'zod';
export declare const createShareSchema: z.ZodObject<{
    ttlSeconds: z.ZodNumber;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ttlSeconds: number;
    title?: string | undefined;
}, {
    ttlSeconds: number;
    title?: string | undefined;
}>;
export declare const extendShareSchema: z.ZodObject<{
    extendSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    extendSeconds: number;
}, {
    extendSeconds: number;
}>;
export declare const shareListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["active", "ended", "cleaned"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "active" | "ended" | "cleaned" | undefined;
}, {
    status?: "active" | "ended" | "cleaned" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const shareCodeSchema: z.ZodString;
/**
 * 实体 ID 校验：与 backend/common/id.ts 中 nanoid 字符集对齐（[a-zA-Z0-9]，长度 8~32）。
 * 用于 :shareId / :photoId / :userId 等路径参数，防止路径穿越或字符注入。
 */
export declare const entityIdSchema: z.ZodString;
export declare const uploadedAsSchema: z.ZodEnum<["original", "compressed"]>;
export type CreateShareInput = z.infer<typeof createShareSchema>;
export type ExtendShareInput = z.infer<typeof extendShareSchema>;
export type ShareListQuery = z.infer<typeof shareListQuerySchema>;
