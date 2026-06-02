import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('邮箱格式不正确')
  .max(100, '邮箱过长');

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(64, '密码过长')
  .regex(/[A-Za-z]/, '密码需包含字母')
  .regex(/[0-9]/, '密码需包含数字');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(30).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(64),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
