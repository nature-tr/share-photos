import cron from 'node-cron';
import { eq, and, lte, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { shares, photos } from '../../db/schema.js';
import { removeShareDirs } from '../../infra/storage/local.js';
import { now } from '../../common/time.js';

const BATCH_SIZE = 50;

/**
 * 清理：
 * - status='ended'
 * - status='active' 且 expires_at <= now
 * 处理顺序：先删文件 → 再删 photos 行 → UPDATE shares.status='cleaned'
 */
export async function runCleanupOnce(log: FastifyInstance['log']): Promise<number> {
  const ts = now();
  const candidates = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(
        isNull(shares.cleanedAt),
        or(
          eq(shares.status, 'ended'),
          and(eq(shares.status, 'active'), lte(shares.expiresAt, ts)),
        ),
      ),
    )
    .limit(BATCH_SIZE)
    .all();

  if (candidates.length === 0) return 0;

  let cleaned = 0;
  for (const { id } of candidates) {
    try {
      await removeShareDirs(id);
      await db.delete(photos).where(eq(photos.shareId, id)).run();
      await db
        .update(shares)
        .set({
          status: 'cleaned',
          cleanedAt: now(),
          photoCount: 0,
          totalBytes: 0,
        })
        .where(eq(shares.id, id))
        .run();
      cleaned++;
    } catch (err) {
      log.error({ err, shareId: id }, '清理分享失败，下一轮重试');
    }
  }

  if (cleaned > 0) {
    log.info({ cleaned, scanned: candidates.length }, '清理完成');
  }
  return cleaned;
}

let started = false;

export function startCleanupCron(app: FastifyInstance): void {
  if (started) return;
  started = true;

  // 每分钟执行一次
  cron.schedule('* * * * *', () => {
    void runCleanupOnce(app.log).catch((err) => {
      app.log.error({ err }, 'cleanup cron task error');
    });
  });

  app.log.info('过期清理 cron 已启动');
  // 启动时立即跑一次
  void runCleanupOnce(app.log).catch((err) => app.log.error({ err }, 'initial cleanup error'));
}

// 简单的 sql ref（drizzle 有时需要）
export { sql };
