import { z } from 'zod';
import { MIN_TTL_SECONDS, MAX_TTL_SECONDS, MIN_EXTEND_SECONDS, MAX_EXTEND_SECONDS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, } from '../constants/limits.js';
import { SHARE_CODE_REGEX } from '../constants/share-code.js';
export const createShareSchema = z.object({
    ttlSeconds: z
        .number()
        .int()
        .min(MIN_TTL_SECONDS, `有效期最少 ${MIN_TTL_SECONDS} 秒`)
        .max(MAX_TTL_SECONDS, `有效期最长 ${MAX_TTL_SECONDS} 秒`),
    title: z.string().trim().max(50).optional(),
});
export const extendShareSchema = z.object({
    extendSeconds: z
        .number()
        .int()
        .min(MIN_EXTEND_SECONDS)
        .max(MAX_EXTEND_SECONDS),
});
export const shareListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    status: z.enum(['active', 'ended', 'cleaned']).optional(),
});
export const shareCodeSchema = z.string().regex(SHARE_CODE_REGEX, '分享码格式不正确');
export const uploadedAsSchema = z.enum(['original', 'compressed']);
