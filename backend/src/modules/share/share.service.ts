import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { shares, photos, contributors } from '../../db/schema.js';
import { Errors } from '../../common/errors.js';
import { newId, newShareCode } from '../../common/id.js';
import { now } from '../../common/time.js';
import { ensureShareDirs } from '../../infra/storage/local.js';
import type {
  ShareSummary,
  ShareDetail,
  ShareListResponse,
  PhotoMeta,
} from '@photo/shared';

const SHARE_CODE_MAX_RETRY = 5;

function toSummary(s: typeof shares.$inferSelect): ShareSummary {
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    status: s.status,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    endedAt: s.endedAt,
    photoCount: s.photoCount,
    totalBytes: s.totalBytes,
  };
}

function toPhotoMeta(p: typeof photos.$inferSelect): PhotoMeta {
  return {
    id: p.id,
    originalName: p.originalName,
    mimeType: p.mimeType,
    width: p.width,
    height: p.height,
    sizeBytes: p.sizeBytes,
    uploadedAs: p.uploadedAs,
    uploadedBy: p.uploadedBy,
    exif: p.exif ? (() => { try { return JSON.parse(p.exif); } catch { return null; } })() : null,
    createdAt: p.createdAt,
  };
}

export const shareService = {
  async create(ownerId: string, ttlSeconds: number, title?: string): Promise<ShareSummary> {
    const id = newId();
    const ts = now();

    let code = '';
    for (let i = 0; i < SHARE_CODE_MAX_RETRY; i++) {
      code = newShareCode();
      const dup = await db
        .select({ id: shares.id })
        .from(shares)
        .where(eq(shares.code, code))
        .get();
      if (!dup) break;
      if (i === SHARE_CODE_MAX_RETRY - 1) throw Errors.internal('生成分享码失败');
    }

    const record = {
      id,
      code,
      ownerId,
      title: title ?? null,
      status: 'active' as const,
      createdAt: ts,
      expiresAt: ts + ttlSeconds * 1000,
      endedAt: null,
      cleanedAt: null,
      photoCount: 0,
      totalBytes: 0,
    };

    await db.insert(shares).values(record).run();
    await ensureShareDirs(id);
    return toSummary(record as typeof shares.$inferSelect);
  },

  async list(ownerId: string, page: number, pageSize: number, status?: string): Promise<ShareListResponse> {
    const offset = (page - 1) * pageSize;
    const where = status
      ? and(eq(shares.ownerId, ownerId), eq(shares.status, status as 'active' | 'ended' | 'cleaned'))
      : eq(shares.ownerId, ownerId);

    const items = await db
      .select()
      .from(shares)
      .where(where)
      .orderBy(desc(shares.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(shares)
      .where(where)
      .get();

    // 批量查 pending 贡献者数 + 首图ID
    const extras: Record<string, { pending: number; firstPhotoId: string | null }> = {};
    for (const s of items) {
      const [pRow, fRow] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(contributors).where(and(eq(contributors.shareId, s.id), eq(contributors.status, 'pending'))).get(),
        db.select({ id: photos.id }).from(photos).where(eq(photos.shareId, s.id)).orderBy(photos.sortIndex).limit(1).get(),
      ]);
      extras[s.id] = { pending: Number(pRow?.count ?? 0), firstPhotoId: fRow?.id ?? null };
    }

    return {
      items: items.map((s) => ({ ...toSummary(s), pendingContributorCount: extras[s.id]?.pending ?? 0, firstPhotoId: extras[s.id]?.firstPhotoId ?? null })),
      total: Number(totalRow?.count ?? 0),
      page,
      pageSize,
    };
  },

  async getById(shareId: string, ownerId: string): Promise<ShareDetail> {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.ownerId !== ownerId) throw Errors.forbidden();

    const photoList = await db
      .select()
      .from(photos)
      .where(eq(photos.shareId, shareId))
      .orderBy(photos.sortIndex)
      .all();

    // 查贡献者列表
    const contributorList = await db
      .select()
      .from(contributors)
      .where(eq(contributors.shareId, shareId))
      .orderBy(contributors.createdAt)
      .all();

    return {
      ...toSummary(share),
      photos: photoList.map(toPhotoMeta),
      contributors: await Promise.all(
        contributorList.map(async (c) => {
          const { users } = await import('../../db/schema.js');
          const user = await db.select().from(users).where(eq(users.id, c.userId)).get();
          return {
            id: c.id,
            shareId: c.shareId,
            userId: c.userId,
            displayName: user?.displayName ?? null,
            email: user?.email ?? '',
            status: c.status,
            role: c.role,
            createdAt: c.createdAt,
          };
        }),
      ),
    };
  },

  async getByCodeForViewer(code: string) {
    const share = await db.select().from(shares).where(eq(shares.code, code)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.status === 'ended') throw Errors.shareEnded();
    if (share.status === 'cleaned') throw Errors.shareCleaned();
    if (share.expiresAt <= now()) throw Errors.shareExpired();
    return share;
  },

  async extend(shareId: string, ownerId: string, extendSeconds: number): Promise<{ id: string; expiresAt: number }> {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.ownerId !== ownerId) throw Errors.forbidden();
    if (share.status === 'cleaned') throw Errors.shareCleaned();

    const base = Math.max(now(), share.expiresAt);
    const newExpiresAt = base + extendSeconds * 1000;

    await db
      .update(shares)
      .set({
        expiresAt: newExpiresAt,
        // 续期可以让 ended 复活吗？产品决策：不允许；只能续期 active 的
        ...(share.status === 'ended' ? { status: 'active', endedAt: null } : {}),
      })
      .where(eq(shares.id, shareId))
      .run();

    return { id: shareId, expiresAt: newExpiresAt };
  },

  async end(shareId: string, ownerId: string): Promise<void> {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.ownerId !== ownerId) throw Errors.forbidden();
    if (share.status === 'cleaned') return;
    if (share.status === 'ended') return;

    await db
      .update(shares)
      .set({ status: 'ended', endedAt: now() })
      .where(eq(shares.id, shareId))
      .run();
  },

  async assertOwner(shareId: string, ownerId: string) {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.ownerId !== ownerId) throw Errors.forbidden();
    if (share.status === 'ended') throw Errors.shareEnded();
    if (share.status === 'cleaned') throw Errors.shareCleaned();
    return share;
  },

  /** 上传权限：owner 或 accepted 贡献者 */
  async assertOwnerOrContributor(shareId: string, userId: string) {
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.status === 'ended') throw Errors.shareEnded();
    if (share.status === 'cleaned') throw Errors.shareCleaned();
    // owner 直接放行
    if (share.ownerId === userId) return share;
    // 检查是否为 accepted 贡献者
    const c = await db
      .select({ id: contributors.id })
      .from(contributors)
      .where(
        and(
          eq(contributors.shareId, shareId),
          eq(contributors.userId, userId),
          eq(contributors.status, 'accepted'),
        ),
      )
      .get();
    if (!c) throw Errors.notShareMember();
    return share;
  },
};
