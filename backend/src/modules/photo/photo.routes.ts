import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { uploadedAsSchema } from '@photo/shared';
import { photoService } from './photo.service.js';
import { Errors } from '../../common/errors.js';

const paramsSchema = z.object({
  shareId: z.string().min(1),
});
const photoParamsSchema = z.object({
  shareId: z.string().min(1),
  photoId: z.string().min(1),
});

export async function photoRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  // 上传单张图片
  app.post('/:shareId/photos', async (req, reply) => {
    const { shareId } = paramsSchema.parse(req.params);
    const userId = req.currentUser!.sub;

    const data = await req.file();
    if (!data) throw Errors.validation('缺少文件字段');

    // 从 fields 里读取 uploadedAs（multipart 的 field 类型已被 file() 同步消费）
    const uploadedAsField = (data.fields['uploadedAs'] as { value?: unknown } | undefined)?.value;
    const uploadedAs = uploadedAsSchema.parse(uploadedAsField ?? 'original');

    const result = await photoService.upload(shareId, userId, data, uploadedAs);
    reply.code(201).send({ data: result });
  });

  // 删除单张
  app.delete('/:shareId/photos/:photoId', async (req, reply) => {
    const { shareId, photoId } = photoParamsSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    await photoService.delete(shareId, photoId, userId);
    reply.code(204).send();
  });

  // 批量删除
  app.post('/:shareId/photos/batch-delete', async (req, reply) => {
    const { shareId } = paramsSchema.parse(req.params);
    const body = z.object({ photoIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const userId = req.currentUser!.sub;
    await photoService.deleteBatch(shareId, body.photoIds, userId);
    reply.code(204).send();
  });
}
