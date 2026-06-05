import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { shareCodeSchema } from '@photo/shared';
import { shareService } from '../share/share.service.js';
import { photoService } from '../photo/photo.service.js';
import { contributorService } from '../share/contributor.service.js';
import {
  originalPath,
  previewPath,
  mediumPath,
} from '../../infra/storage/paths.js';
import { createZipStream, appendFile } from '../../infra/archive/zip.js';
import { Errors } from '../../common/errors.js';
import type { ViewerAlbum } from '@photo/shared';

const codeParamSchema = z.object({ code: shareCodeSchema });
const codePhotoParamSchema = z.object({
  code: shareCodeSchema,
  photoId: z.string().min(1),
});

function streamFile(reply: import('fastify').FastifyReply, filePath: string, contentType: string) {
  if (!fs.existsSync(filePath)) throw Errors.photoNotFound();
  reply.header('Content-Type', contentType);
  reply.header('Cache-Control', 'private, max-age=3600');
  return reply.send(fs.createReadStream(filePath));
}

export async function viewerRoutes(app: FastifyInstance): Promise<void> {
  // 凭码获取相册元数据（含已接受的贡献者列表）
  app.get('/:code', async (req) => {
    const { code } = codeParamSchema.parse(req.params);
    const share = await shareService.getByCodeForViewer(code);
    const photoList = await photoService.listByShare(share.id);
    const contributorList = await contributorService.listAccepted(share.id);
    const album: ViewerAlbum = {
      code: share.code,
      title: share.title,
      expiresAt: share.expiresAt,
      photos: photoList.map((p) => ({
        id: p.id,
        originalName: p.originalName,
        mimeType: p.mimeType,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        uploadedAs: p.uploadedAs,
        createdAt: p.createdAt,
      })),
      contributors: contributorList,
    };
    return { data: album };
  });

  // 缩略图
  app.get('/:code/photos/:photoId/thumb', async (req, reply) => {
    const { code, photoId } = codePhotoParamSchema.parse(req.params);
    const share = await shareService.getByCodeForViewer(code);
    await photoService.getOne(share.id, photoId);
    return streamFile(reply, previewPath(share.id, photoId), 'image/jpeg');
  });

  // 中等图
  app.get('/:code/photos/:photoId/medium', async (req, reply) => {
    const { code, photoId } = codePhotoParamSchema.parse(req.params);
    const share = await shareService.getByCodeForViewer(code);
    await photoService.getOne(share.id, photoId);
    return streamFile(reply, mediumPath(share.id, photoId), 'image/jpeg');
  });

  // 原图（支持 ?download=1 强制下载）
  app.get('/:code/photos/:photoId/original', async (req, reply) => {
    const { code, photoId } = codePhotoParamSchema.parse(req.params);
    const share = await shareService.getByCodeForViewer(code);
    const photo = await photoService.getOne(share.id, photoId);
    const filePath = originalPath(share.id, photoId, photo.ext);
    if (!fs.existsSync(filePath)) throw Errors.photoNotFound();

    const query = req.query as { download?: string };
    if (query.download === '1') {
      const safeName = encodeURIComponent(photo.originalName);
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
    }
    reply.header('Content-Type', photo.mimeType);
    reply.header('Content-Length', photo.sizeBytes);
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(fs.createReadStream(filePath));
  });

  // ─── 贡献者 ───

  // 凭码查看已接受的贡献者列表
  app.get('/:code/contributors', async (req) => {
    const { code } = codeParamSchema.parse(req.params);
    const share = await shareService.getByCodeForViewer(code);
    const list = await contributorService.listAccepted(share.id);
    return { data: list };
  });

  // 凭码申请加入（需登录）
  app.post('/:code/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { code } = codeParamSchema.parse(req.params);
    const userId = req.currentUser!.sub;
    const share = await shareService.getByCodeForViewer(code);
    const result = await contributorService.requestJoin(share.id, userId);
    reply.code(200).send({ data: result });
  });

  // 全量 zip 下载
  app.get('/:code/download', async (req, reply) => {
    const { code } = codeParamSchema.parse(req.params);
    const share = await shareService.getByCodeForViewer(code);
    const photoList = await photoService.listByShare(share.id);

    reply.header('Content-Type', 'application/zip');
    const zipName = `album-${share.code}.zip`;
    reply.header(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    );

    const archive = createZipStream();
    archive.on('warning', (err) => {
      req.log.warn({ err }, 'archiver warning');
    });
    archive.on('error', (err) => {
      req.log.error({ err }, 'archiver error');
    });

    // 用 reply.raw 直接写入，避免 fastify 的内置序列化
    archive.pipe(reply.raw);

    const usedNames = new Set<string>();
    for (const photo of photoList) {
      const filePath = originalPath(share.id, photo.id, photo.ext);
      if (!fs.existsSync(filePath)) continue;
      let name = photo.originalName;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const extPart = dot > 0 ? name.slice(dot) : '';
        name = `${base}-${photo.id.slice(0, 6)}${extPart}`;
      }
      usedNames.add(name);
      appendFile(archive, { path: filePath, name });
    }

    await archive.finalize();
    // 已直接写入 raw，需返回 reply 防止 fastify 二次发送
    return reply;
  });
}
