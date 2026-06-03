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
export declare const uploadedAsSchema: z.ZodEnum<["original", "compressed"]>;
export type CreateShareInput = z.infer<typeof createShareSchema>;
export type ExtendShareInput = z.infer<typeof extendShareSchema>;
export type ShareListQuery = z.infer<typeof shareListQuerySchema>;
