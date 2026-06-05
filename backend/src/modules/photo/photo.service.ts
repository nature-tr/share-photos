import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { eq, sql, and } from 'drizzle-orm';
import type { MultipartFile } from '@fastify/multipart';
import { db } from '../../db/client.js';
import { photos, shares } from '../../db/schema.js';
import { Errors } from '../../common/errors.js';
import { newId } from '../../common/id.js';
import { now } from '../../common/time.js';
import { ensureShareDirs, safeUnlink } from '../../infra/storage/local.js';
import { originalPath, previewPath, previewWebpPath, mediumPath, mediumWebpPath } from '../../infra/storage/paths.js';
import { processImage, getFileSize } from '../../infra/image/processor.js';
import {
  MAX_FILE_SIZE,
  MAX_PHOTOS_PER_SHARE,
  SUPPORTED_MIME_TYPES,
  type UploadedAs,
  type UploadPhotoResponse,
} from '@photo/shared';
import { shareService } from '../share/share.service.js';
import { contributorService } from '../share/contributor.service.js';

const SUPPORTED = new Set<string>(SUPPORTED_MIME_TYPES);

function extFromMime(mime: string, fallback: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    default: return fallback || 'bin';
  }
}

export const photoService = {
  async upload(
    shareId: string,
    userId: string,
    file: MultipartFile,
    uploadedAs: UploadedAs,
  ): Promise<UploadPhotoResponse> {
    // 检查权限：owner 或 accepted 贡献者
    const share = await shareService.assertOwnerOrContributor(shareId, userId);

    if (share.photoCount >= MAX_PHOTOS_PER_SHARE) {
      throw Errors.photoLimitExceeded();
    }

    const mime = file.mimetype.toLowerCase();
    if (!SUPPORTED.has(mime)) {
      throw Errors.unsupportedMediaType(mime);
    }

    await ensureShareDirs(shareId);
    const photoId = newId();
    const ext = extFromMime(mime, file.filename.split('.').pop()?.toLowerCase() ?? '');
    const dest = originalPath(shareId, photoId, ext);

    // 流式落盘；@fastify/multipart 已根据全局 limits.fileSize 做了截断
    let truncated = false;
    try {
      await pipeline(file.file, createWriteStream(dest));
      truncated = file.file.truncated;
    } catch (err) {
      await safeUnlink(dest);
      throw err;
    }

    if (truncated) {
      await safeUnlink(dest);
      throw Errors.fileTooLarge();
    }

    let processed;
    try {
      processed = await processImage(shareId, photoId, dest);
    } catch (err) {
      await safeUnlink(dest);
      throw err;
    }

    const sizeBytes = await getFileSize(dest);
    const ts = now();

    await db
      .insert(photos)
      .values({
        id: photoId,
        shareId,
        uploadedBy: userId,
        originalName: file.filename,
        mimeType: mime,
        ext,
        sizeBytes,
        width: processed.width,
        height: processed.height,
        uploadedAs,
        sortIndex: ts,
        createdAt: ts,
      })
      .run();

    await db
      .update(shares)
      .set({
        photoCount: sql`${shares.photoCount} + 1`,
        totalBytes: sql`${shares.totalBytes} + ${sizeBytes}`,
      })
      .where(eq(shares.id, shareId))
      .run();

    return {
      id: photoId,
      originalName: file.filename,
      width: processed.width,
      height: processed.height,
      sizeBytes,
      uploadedAs,
      createdAt: ts,
    };
  },

  async delete(shareId: string, photoId: string, userId: string): Promise<void> {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();

    const photo = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.shareId, shareId)))
      .get();
    if (!photo) throw Errors.photoNotFound();

    if (share.ownerId !== userId && photo.uploadedBy !== userId) throw Errors.forbidden();

    await Promise.all([
      safeUnlink(originalPath(shareId, photoId, photo.ext)),
      safeUnlink(previewPath(shareId, photoId)),
      safeUnlink(previewWebpPath(shareId, photoId)),
      safeUnlink(mediumPath(shareId, photoId)),
      safeUnlink(mediumWebpPath(shareId, photoId)),
    ]);

    await db.delete(photos).where(eq(photos.id, photoId)).run();
    await db
      .update(shares)
      .set({
        photoCount: sql`${shares.photoCount} - 1`,
        totalBytes: sql`${shares.totalBytes} - ${photo.sizeBytes}`,
      })
      .where(eq(shares.id, shareId))
      .run();
  },

  async deleteBatch(shareId: string, photoIds: string[], userId: string): Promise<void> {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();

    for (const pid of photoIds) {
      const photo = await db.select().from(photos).where(and(eq(photos.id, pid), eq(photos.shareId, shareId))).get();
      if (!photo) continue;
      if (share.ownerId !== userId && photo.uploadedBy !== userId) continue;

      await Promise.all([
        safeUnlink(originalPath(shareId, pid, photo.ext)),
        safeUnlink(previewPath(shareId, pid)),
        safeUnlink(previewWebpPath(shareId, pid)),
        safeUnlink(mediumPath(shareId, pid)),
        safeUnlink(mediumWebpPath(shareId, pid)),
      ]);
      await db.delete(photos).where(eq(photos.id, pid)).run();
      await db.update(shares).set({
        photoCount: sql`${shares.photoCount} - 1`,
        totalBytes: sql`${shares.totalBytes} - ${photo.sizeBytes}`,
      }).where(eq(shares.id, shareId)).run();
    }
  },

  async listByShare(shareId: string) {
    return db
      .select()
      .from(photos)
      .where(eq(photos.shareId, shareId))
      .orderBy(photos.sortIndex)
      .all();
  },

  async getOne(shareId: string, photoId: string) {
    const photo = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.shareId, shareId)))
      .get();
    if (!photo) throw Errors.photoNotFound();
    return photo;
  },
};
