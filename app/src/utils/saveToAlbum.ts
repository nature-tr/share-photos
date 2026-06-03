/**
 * 把远程图片批量下载并写入系统相册的工具。
 * - iOS：写入 Photos
 * - Android：写入 MediaStore
 *
 * 流程：
 *   1. 请求相册写入权限
 *   2. 下载到 cache 目录
 *   3. MediaLibrary.createAssetAsync(localUri) 写入相册
 *   4. 删除 cache 临时文件
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export interface SaveItem {
  url: string;
  filename: string;
}

export interface SaveProgress {
  done: number;
  total: number;
  failed: number;
  /** 当前阶段：downloading（下载中）/ saving（写入相册中） */
  phase: 'downloading' | 'saving';
}

export class PermissionDeniedError extends Error {
  constructor() {
    super('未授权写入相册');
    this.name = 'PermissionDeniedError';
  }
}

/**
 * 确保相册写入权限已授予，未授权则申请；用户拒绝抛 PermissionDeniedError。
 */
export async function ensureMediaPermission(): Promise<void> {
  const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync(true);
  if (status === 'granted') return;
  if (!canAskAgain) {
    throw new PermissionDeniedError();
  }
  const { status: next } = await MediaLibrary.requestPermissionsAsync(true);
  if (next !== 'granted') {
    throw new PermissionDeniedError();
  }
}

/** 下载单个文件到 cache 并返回本地 uri。失败抛错。 */
async function downloadToCache(url: string, filename: string): Promise<string> {
  // 文件名做兜底（去掉特殊字符避免某些设备失败）
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const localUri = `${FileSystem.cacheDirectory ?? ''}dl_${Date.now()}_${safe}`;
  const result = await FileSystem.downloadAsync(url, localUri);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`下载失败 HTTP ${result.status}`);
  }
  return result.uri;
}

/**
 * 批量保存图片到系统相册。
 * @returns { done, total, failed }
 */
export async function saveImagesToAlbum(
  items: SaveItem[],
  onProgress?: (p: SaveProgress) => void,
  signal?: AbortSignal,
): Promise<{ done: number; total: number; failed: number }> {
  await ensureMediaPermission();

  let done = 0;
  let failed = 0;
  const total = items.length;

  for (const it of items) {
    if (signal?.aborted) break;
    let localUri: string | null = null;
    try {
      onProgress?.({ phase: 'downloading', done, total, failed });
      localUri = await downloadToCache(it.url, it.filename);
      onProgress?.({ phase: 'saving', done, total, failed });
      await MediaLibrary.createAssetAsync(localUri);
      done++;
    } catch (err) {
      failed++;
      console.warn('[save]', it.filename, err);
    } finally {
      // 清缓存
      if (localUri) {
        FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
      }
    }
    onProgress?.({ phase: 'saving', done, total, failed });
  }

  return { done, total, failed };
}

/** 单张保存（用于大图查看时的"保存到相册"按钮） */
export async function saveSingleImage(url: string, filename: string): Promise<void> {
  await ensureMediaPermission();
  let localUri: string | null = null;
  try {
    localUri = await downloadToCache(url, filename);
    await MediaLibrary.createAssetAsync(localUri);
  } finally {
    if (localUri) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    }
  }
}
