import { z } from 'zod';
import {
  MIN_TTL_SECONDS,
  MAX_TTL_SECONDS,
  MIN_EXTEND_SECONDS,
  MAX_EXTEND_SECONDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants/limits.js';
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

/**
 * 实体 ID 校验：与 backend/common/id.ts 中 nanoid 字符集对齐（[a-zA-Z0-9]，长度 8~32）。
 * 用于 :shareId / :photoId / :userId 等路径参数，防止路径穿越或字符注入。
 */
export const entityIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{8,32}$/, 'ID 格式不正确');

export const uploadedAsSchema = z.enum(['original', 'compressed']);

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type ExtendShareInput = z.infer<typeof extendShareSchema>;
export type ShareListQuery = z.infer<typeof shareListQuerySchema>;
