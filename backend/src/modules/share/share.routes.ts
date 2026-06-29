import type { FastifyInstance } from 'fastify';
import {
  createShareSchema,
  extendShareSchema,
  shareListQuerySchema,
  entityIdSchema,
} from '@photo/shared';
import { z } from 'zod';
import { shareService } from './share.service.js';
import { contributorService } from './contributor.service.js';

const shareIdParamSchema = z.object({ shareId: entityIdSchema });
const reviewBodySchema = z.object({ action: z.enum(['accepted', 'rejected']) });

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

  // 重命名
  app.patch('/:shareId/rename', async (req, reply) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const { title } = z.object({ title: z.string().trim().max(50) }).parse(req.body);
    const userId = req.currentUser!.sub;
    await shareService.rename(shareId, userId, title);
    reply.code(204).send();
  });

  // 续期
  app.patch('/:shareId/extend', async (req) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const body = extendShareSchema.parse(req.body);
    const userId = req.currentUser!.sub;
    const result = await shareService.extend(shareId, userId, body.extendSeconds);
    return { data: result };
  });

  // 提前结束（软删除）
  app.delete('/:shareId', async (req, reply) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    await shareService.end(shareId, userId);
    reply.code(204).send();
  });

  // 永久删除（硬删除，仅 ended/cleaned 状态可操作）
  app.post('/:shareId/destroy', async (req, reply) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    await shareService.destroy(shareId, userId);
    reply.code(204).send();
  });

  // ─── 批量操作 ───

  // 批量结束分享
  app.post('/batch-end', async (req, reply) => {
    const { shareIds } = z.object({ shareIds: z.array(entityIdSchema).min(1).max(100) }).parse(req.body);
    const userId = req.currentUser!.sub;
    await shareService.batchEnd(userId, shareIds);
    reply.code(204).send();
  });

  // 批量永久删除分享
  app.post('/batch-destroy', async (req, reply) => {
    const { shareIds } = z.object({ shareIds: z.array(entityIdSchema).min(1).max(100) }).parse(req.body);
    const userId = req.currentUser!.sub;
    await shareService.batchDestroy(userId, shareIds);
    reply.code(204).send();
  });

  // ─── 贡献者管理 ───

  // 列出所有贡献者（含 pending）
  app.get('/:shareId/contributors', async (req) => {
    const { shareId } = shareIdParamSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    await shareService.assertOwner(shareId, userId);
    const list = await contributorService.listAll(shareId);
    return { data: list };
  });

  // 审核申请
  app.patch('/:shareId/contributors/:userId', async (req) => {
    const { shareId, userId: targetUserId } = z
      .object({ shareId: entityIdSchema, userId: entityIdSchema })
      .parse(req.params);
    const { action } = reviewBodySchema.parse(req.body);
    const ownerId = req.currentUser!.sub;
    const result = await contributorService.review(shareId, targetUserId, ownerId, action);
    return { data: result };
  });
}
