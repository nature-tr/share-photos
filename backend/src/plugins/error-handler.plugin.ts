import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { ErrorCode } from '@photo/shared';
import { BizError } from '../common/errors.js';

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    // BizError
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
          message: err.message,
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

    // 4xx 直接透传
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      reply.status(err.statusCode).send({
        error: { code: 'CLIENT_ERROR', message: err.message },
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
