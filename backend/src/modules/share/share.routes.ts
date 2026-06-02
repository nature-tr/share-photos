import type { FastifyInstance } from 'fastify';
import {
  createShareSchema,
  extendShareSchema,
  shareListQuerySchema,
} from '@photo/shared';
import { z } from 'zod';
import { shareService } from './share.service.js';

const shareIdParamSchema = z.object({ shareId: z.string().min(1) });

export async function shareRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  // 创建分享
  app.post('/', async (req, reply) => {
    const body = createShareSchema.parse(req.body);
    const userId = req.currentUser!.sub;
    const share = await shareService.create(userId, body.ttlSeconds, body.title);
    reply.code(201).send({ data: share });
  });

  // 我的分享列表
  app.get('/', async (req) => {
    const userId = req.currentUser!.sub;
    const query = shareListQuerySchema.parse(req.query);
    const result = await shareService.list(userId, query.page, query.pageSize, query.status);
    return { data: result };
  });

  // 分享详情
  app.get('/:shareId', async (req) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    const detail = await shareService.getById(shareId, userId);
    return { data: detail };
  });

  // 续期
  app.patch('/:shareId/extend', async (req) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const body = extendShareSchema.parse(req.body);
    const userId = req.currentUser!.sub;
    const result = await shareService.extend(shareId, userId, body.extendSeconds);
    return { data: result };
  });

  // 提前结束
  app.delete('/:shareId', async (req, reply) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    await shareService.end(shareId, userId);
    reply.code(204).send();
  });
}
