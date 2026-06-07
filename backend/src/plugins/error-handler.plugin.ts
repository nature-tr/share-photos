import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { ErrorCode } from '@photo/shared';
import { BizError } from '../common/errors.js';

/** 安全的客户端错误消息白名单 —— 避免把库内部细节回写给客户端 */
const SAFE_4XX_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '未登录或登录已过期',
  403: '没有权限',
  404: '资源不存在',
  405: '方法不被允许',
  408: '请求超时',
  409: '资源冲突',
  413: '请求体过大',
  415: '不支持的媒体类型',
  422: '请求参数无法处理',
  429: '请求过于频繁，请稍后再试',
};

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    // BizError —— 业务错误，message 是我们自己写的，安全
    if (err instanceof BizError) {
      reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }

    // Zod 校验错误（@fastify/type-provider-zod 会包装）
    if (err instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: '参数校验失败',
          details: err.flatten(),
        },
      });
      return;
    }

    // Fastify 校验错误
    if (err.validation) {
      reply.status(400).send({
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: '参数校验失败',
          details: err.validation,
        },
      });
      return;
    }

    // 限流
    if (err.statusCode === 429) {
      reply.status(429).send({
        error: { code: ErrorCode.RATE_LIMITED, message: '请求过于频繁，请稍后再试' },
      });
      return;
    }

    // 文件过大
    if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      reply.status(413).send({
        error: { code: ErrorCode.FILE_TOO_LARGE, message: '文件过大' },
      });
      return;
    }

    // 4xx —— 用白名单消息回写，避免库内部细节泄漏（如错误堆栈、SQL、文件路径）
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      // 仍然记录原始错误，便于排查
      req.log.warn({ err }, 'Client error');
      reply.status(err.statusCode).send({
        error: {
          code: 'CLIENT_ERROR',
          message: SAFE_4XX_MESSAGES[err.statusCode] ?? '请求错误',
        },
      });
      return;
    }

    // 兜底 500
    req.log.error({ err }, 'Unhandled error');
    reply.status(500).send({
      error: { code: ErrorCode.INTERNAL_ERROR, message: '服务器内部错误' },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      error: { code: ErrorCode.NOT_FOUND, message: 'Not Found' },
    });
  });
});
