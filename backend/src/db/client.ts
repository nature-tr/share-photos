import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config/index.js';
import * as schema from './schema.js';

// 确保 DB 目录存在
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const sqlite = new Database(config.dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// 自动创建缺失的表（供开发/升级用，不影响已有迁移）
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS contributors (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),
    role   TEXT NOT NULL DEFAULT 'contributor' CHECK(role IN ('contributor')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contributor_share_user ON contributors(share_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_contributor_status ON contributors(share_id, status);
`);

export const db = drizzle(sqlite, { schema });
export const rawDb = sqlite;
export { schema };
