import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, rawDb } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 幂等的 schema 自愈：
 * - 处理那些 drizzle migration 没覆盖、但 schema.ts 已声明的字段/表（历史遗留）。
 * - 用 PRAGMA / sqlite_master 精确判断后再决定是否执行 DDL，避免 try/catch 吞错。
 *
 * 与 db/client.ts 中的"隐式 DDL"相比，这里的执行时机明确（迁移后），
 * 且每条变更都有显式注释，便于审计。
 */
function ensureLegacySchema(): void {
  // ── photos.uploaded_by（早期 0000 迁移没有此列）──
  if (!hasColumn('photos', 'uploaded_by')) {
    rawDb.exec(`ALTER TABLE photos ADD COLUMN uploaded_by TEXT REFERENCES users(id)`);
  }

  // ── photos.exif（早期 0000 迁移没有此列）──
  if (!hasColumn('photos', 'exif')) {
    rawDb.exec(`ALTER TABLE photos ADD COLUMN exif TEXT`);
  }

  // ── contributors 表（早期 0000 迁移没有此表）──
  if (!hasTable('contributors')) {
    rawDb.exec(`
      CREATE TABLE contributors (
        id TEXT PRIMARY KEY,
        share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
        user_id  TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),
        role   TEXT NOT NULL DEFAULT 'contributor' CHECK(role IN ('contributor')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_contributor_share_user ON contributors(share_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_contributor_status     ON contributors(share_id, status);
    `);
  }
}

function hasColumn(table: string, column: string): boolean {
  const rows = rawDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function hasTable(table: string): boolean {
  const row = rawDb
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  return !!row;
}

export function runMigrations(): void {
  const migrationsFolder = path.join(__dirname, 'migrations');
  migrate(db, { migrationsFolder });

  // 迁移完成后再做幂等自愈，避免与官方迁移流程冲突
  ensureLegacySchema();
}
