import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { contributors, users, shares } from '../../db/schema.js';
import { Errors } from '../../common/errors.js';
import { newId } from '../../common/id.js';
import { now } from '../../common/time.js';
import type { ContributorInfo } from '@photo/shared';

export const contributorService = {
  /** 申请加入某个分享 */
  async requestJoin(shareId: string, userId: string): Promise<ContributorInfo> {
    // 不能加入自己的分享
    const share = await db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!share) throw Errors.shareNotFound();
    if (share.ownerId === userId) throw Errors.forbidden('不能加入自己创建的分享');

    // 检查是否已有申请记录
    const existing = await db
      .select()
      .from(contributors)
      .where(and(eq(contributors.shareId, shareId), eq(contributors.userId, userId)))
      .get();

    if (existing) {
      if (existing.status === 'pending') throw Errors.contributorAlreadyExists();
      if (existing.status === 'accepted') {
        // 已被接受则直接返回
        return toInfo(existing);
      }
    }

    const id = newId();
    const ts = now();
    const record = {
      id,
      shareId,
      userId,
      status: 'pending' as const,
      role: 'contributor' as const,
      createdAt: ts,
      updatedAt: ts,
    };

    if (existing) {
      // 之前被拒绝的，更新为 pending
      await db
        .update(contributors)
        .set({ status: 'pending', updatedAt: ts })
        .where(eq(contributors.id, existing.id))
        .run();
    } else {
      await db.insert(contributors).values(record).run();
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    return {
      id: existing?.id ?? id,
      shareId,
      userId,
      displayName: user?.displayName ?? null,
      email: user?.email ?? '',
      status: 'pending',
      role: 'contributor',
      createdAt: ts,
    };
  },

  /** 创建者审核：接受/拒绝 申请 */
  async review(
    shareId: string,
    targetUserId: string,
    ownerId: string,
    action: 'accepted' | 'rejected',
  ): Promise<ContributorInfo> {
    // 确保操作者是分享的 owner
    const { shareService } = await import('./share.service.js');
    await shareService.assertOwner(shareId, ownerId);

    const entry = await db
      .select()
      .from(contributors)
      .where(and(eq(contributors.shareId, shareId), eq(contributors.userId, targetUserId)))
      .get();

    if (!entry) throw Errors.contributorNotFound();

    const ts = now();
    await db
      .update(contributors)
      .set({ status: action, updatedAt: ts })
      .where(eq(contributors.id, entry.id))
      .run();

    const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
    return {
      id: entry.id,
      shareId,
      userId: targetUserId,
      displayName: user?.displayName ?? null,
      email: user?.email ?? '',
      status: action,
      role: entry.role,
      createdAt: entry.createdAt,
    };
  },

  /** 获取某个分享的所有贡献者列表（创建者视角，含 pending） */
  async listAll(shareId: string): Promise<ContributorInfo[]> {
    const rows = await db
      .select()
      .from(contributors)
      .where(eq(contributors.shareId, shareId))
      .orderBy(contributors.createdAt)
      .all();

    // join user info
    const result: ContributorInfo[] = [];
    for (const r of rows) {
      const user = await db.select().from(users).where(eq(users.id, r.userId)).get();
      result.push({
        id: r.id,
        shareId: r.shareId,
        userId: r.userId,
        displayName: user?.displayName ?? null,
        email: user?.email ?? '',
        status: r.status,
        role: r.role,
        createdAt: r.createdAt,
      });
    }
    return result;
  },

  /** 获取已被接受的贡献者（公开视角） */
  async listAccepted(shareId: string): Promise<ContributorInfo[]> {
    const rows = await db
      .select()
      .from(contributors)
      .where(and(eq(contributors.shareId, shareId), eq(contributors.status, 'accepted')))
      .orderBy(contributors.createdAt)
      .all();

    const result: ContributorInfo[] = [];
    for (const r of rows) {
      const user = await db.select().from(users).where(eq(users.id, r.userId)).get();
      result.push({
        id: r.id,
        shareId: r.shareId,
        userId: r.userId,
        displayName: user?.displayName ?? null,
        email: user?.email ?? '',
        status: r.status,
        role: r.role,
        createdAt: r.createdAt,
      });
    }
    return result;
  },

  /** 检查用户是否是分享的贡献者（已接受状态） */
  async isContributor(shareId: string, userId: string): Promise<boolean> {
    const row = await db
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
    return !!row;
  },

  /** 统计 pending 数量 */
  async countPending(shareId: string): Promise<number> {
    const row = await db
      .select({ count: db.fn.count() })
      .from(contributors)
      .where(and(eq(contributors.shareId, shareId), eq(contributors.status, 'pending')))
      .get() as { count: number } | undefined;
    return Number(row?.count ?? 0);
  },
};

function toInfo(r: typeof contributors.$inferSelect): ContributorInfo {
  return {
    id: r.id,
    shareId: r.shareId,
    userId: r.userId,
    displayName: null,
    email: '',
    status: r.status,
    role: r.role,
    createdAt: r.createdAt,
  };
}
