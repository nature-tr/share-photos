import fs from 'node:fs/promises';
import { shareDirs } from './paths.js';

export async function ensureShareDirs(shareId: string): Promise<void> {
  const dirs = shareDirs(shareId);
  await Promise.all([
    fs.mkdir(dirs.originals, { recursive: true }),
    fs.mkdir(dirs.previews, { recursive: true }),
    fs.mkdir(dirs.mediums, { recursive: true }),
  ]);
}

export async function removeShareDirs(shareId: string): Promise<void> {
  const dirs = shareDirs(shareId);
  await Promise.all([
    fs.rm(dirs.originals, { recursive: true, force: true }),
    fs.rm(dirs.previews, { recursive: true, force: true }),
    fs.rm(dirs.mediums, { recursive: true, force: true }),
  ]);
}

export async function safeUnlink(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
