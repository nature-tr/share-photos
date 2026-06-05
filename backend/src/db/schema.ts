import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    issuedAt: integer('issued_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
    replacedBy: text('replaced_by'),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => ({
    userIdx: index('idx_refresh_user').on(t.userId, t.expiresAt),
    hashIdx: index('idx_refresh_hash').on(t.tokenHash),
  }),
);

export const shares = sqliteTable(
  'shares',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    status: text('status', { enum: ['active', 'ended', 'cleaned'] }).notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    endedAt: integer('ended_at'),
    cleanedAt: integer('cleaned_at'),
    photoCount: integer('photo_count').notNull().default(0),
    totalBytes: integer('total_bytes').notNull().default(0),
  },
  (t) => ({
    ownerIdx: index('idx_share_owner').on(t.ownerId, t.createdAt),
    statusIdx: index('idx_share_status').on(t.status, t.expiresAt),
  }),
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    shareId: text('share_id')
      .notNull()
      .references(() => shares.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by').references(() => users.id),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    ext: text('ext').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    uploadedAs: text('uploaded_as', { enum: ['original', 'compressed'] }).notNull(),
    sortIndex: integer('sort_index').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    shareIdx: index('idx_photo_share').on(t.shareId, t.sortIndex),
  }),
);

export const contributors = sqliteTable(
  'contributors',
  {
    id: text('id').primaryKey(),
    shareId: text('share_id')
      .notNull()
      .references(() => shares.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull(),
    role: text('role', { enum: ['contributor'] }).notNull().default('contributor'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    shareUserIdx: index('idx_contributor_share_user').on(t.shareId, t.userId),
    statusIdx: index('idx_contributor_status').on(t.shareId, t.status),
  }),
);

export type User = typeof users.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Contributor = typeof contributors.$inferSelect;
