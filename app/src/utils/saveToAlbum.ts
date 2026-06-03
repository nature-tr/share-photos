/**
 * 把远程图片批量下载并写入系统相册的工具。
 * - iOS：写入 Photos
 * - Android：写入 MediaStore（DCIM/Camera）
 *
 * 流程：
 *   1. 请求相册写入权限（writeOnly 即可）
 *   2. 下载到 cache 目录
 *   3. MediaLibrary.saveToLibraryAsync(localUri) 写入相册
 *   4. 删除 cache 临时文件
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

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
 * 只请求 writeOnly 权限（参数 true）：
 *  - iOS 17+：弹"添加照片"权限，比读写权限更轻量、用户更愿意授予
 *  - Android：需要 WRITE_EXTERNAL_STORAGE / MediaStore 写入权限
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

/** 从 url 或 filename 推断文件扩展名（iOS Photos 强依赖扩展名识别图片类型） */
function pickExt(url: string, filename: string): string {
  const tryFrom = (s: string): string | null => {
    const m = /\.(jpe?g|png|gif|heic|heif|webp|bmp|tiff?)(?:\?|#|$)/i.exec(s);
    return m ? m[1].toLowerCase() : null;
  };
  return tryFrom(filename) ?? tryFrom(url) ?? 'jpg';
}

/** 下载单个文件到 cache 并返回本地 uri。失败抛错。 */
async function downloadToCache(url: string, filename: string): Promise<string> {
  const ext = pickExt(url, filename);
  // 文件名只保留 ASCII 字母数字+点+下划线，并强制带正确扩展名
  // iOS PHPhotoLibrary 在文件名含中文/特殊字符或扩展名错误时会返回 unspecified error
  const base = filename.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const safeName = `${base || 'image'}_${Date.now()}.${ext}`;
  const localUri = `${FileSystem.cacheDirectory ?? ''}${safeName}`;
  const result = await FileSystem.downloadAsync(url, localUri);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`下载失败 HTTP ${result.status}`);
  }
  return result.uri;
}

/**
 * 写入系统相册，返回成功状态。
 * 优先用 saveToLibraryAsync（writeOnly 权限即可，不读相册，最稳）。
 */
async function writeToLibrary(localUri: string): Promise<void> {
  // saveToLibraryAsync 在 iOS 上必须传 file:// 开头
  // expo-file-system/legacy 的 cacheDirectory 在 iOS 已自带 file://，安全保险一下
  let uri = localUri;
  if (Platform.OS === 'ios' && !uri.startsWith('file://')) {
    uri = 'file://' + uri;
  }
  await MediaLibrary.saveToLibraryAsync(uri);
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
      await writeToLibrary(localUri);
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
    await writeToLibrary(localUri);
  } finally {
    if (localUri) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    }
  }
}
