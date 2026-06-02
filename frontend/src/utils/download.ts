import { canShareFiles } from '@/composables/useDevice';

/** 把远程图片下载下来 */
async function fetchAsBlob(
  url: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; mime: string }> {
  const resp = await fetch(url, { credentials: 'include', signal });
  if (!resp.ok) {
    throw new Error(`下载失败: HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  const mime = blob.type || resp.headers.get('content-type') || 'application/octet-stream';
  return { blob, mime };
}

/** 触发浏览器原生下载（PC/Android 进入 Downloads；iOS 进入文件 App） */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export interface SaveImageOptions {
  filename: string;
  preferShare?: boolean;
  title?: string;
}

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/** 单张保存：优先 Web Share，fallback 下载 */
export async function saveImage(url: string, opts: SaveImageOptions): Promise<SaveResult> {
  const { blob, mime } = await fetchAsBlob(url);

  if (opts.preferShare && canShareFiles()) {
    const file = new File([blob], opts.filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: opts.title ?? '相册图片' });
        return 'shared';
      } catch (err) {
        if ((err as Error).name === 'AbortError') return 'cancelled';
      }
    }
  }

  triggerBrowserDownload(blob, opts.filename);
  return 'downloaded';
}

// ============================================================
// 批量保存
// ============================================================

export interface BatchItem {
  url: string;
  filename: string;
  /** 原图字节数（可选，用于估算总大小） */
  sizeBytes?: number;
}

export interface BatchProgress {
  /** 阶段：'downloading' 下载阶段 / 'sharing' 分享/写入阶段 */
  phase: 'downloading' | 'sharing' | 'writing';
  /** 当前批次索引（从 1 开始） */
  batch?: number;
  totalBatches?: number;
  /** 已完成的张数 */
  done: number;
  /** 总张数 */
  total: number;
}

export interface BatchResult {
  done: number;
  total: number;
  cancelled: boolean;
  failed: number;
}

/** 单次 Web Share 推荐的最大累计字节数（保守值，避免 iOS / Android 拒绝） */
const SAFE_BATCH_BYTES = 200 * 1024 * 1024; // 200MB
/** 当条目缺失 sizeBytes 时按这个估算（保守 4MB/张） */
const ESTIMATED_PHOTO_BYTES = 4 * 1024 * 1024;

function estimateBytes(item: BatchItem): number {
  return item.sizeBytes ?? ESTIMATED_PHOTO_BYTES;
}

/** 把列表按累计字节数切成多批，每批 ≤ SAFE_BATCH_BYTES */
export function splitIntoBatches(items: BatchItem[]): BatchItem[][] {
  const batches: BatchItem[][] = [];
  let current: BatchItem[] = [];
  let currentBytes = 0;
  for (const item of items) {
    const sz = estimateBytes(item);
    // 单张超大：自成一批
    if (sz > SAFE_BATCH_BYTES && current.length > 0) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    if (currentBytes + sz > SAFE_BATCH_BYTES && current.length > 0) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += sz;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * 一次性把多张图打包到 navigator.share()，让用户点一次"存储图像"全部进相册。
 * 总大小过大时会自动拆成多批。
 *
 * 流程：
 *   1. 下载所有图（progress: phase='downloading'）
 *   2. 调用 navigator.share({ files })（progress: phase='sharing'）
 *   3. 用户在系统面板选择目标（如"存储图像"），系统一次性保存到相册
 */
export async function saveImagesViaShare(
  items: BatchItem[],
  opts: {
    title?: string;
    onProgress?: (p: BatchProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<BatchResult> {
  if (!canShareFiles()) {
    throw new Error('当前浏览器不支持 Web Share API');
  }
  const total = items.length;
  if (total === 0) return { done: 0, total: 0, cancelled: false, failed: 0 };

  const batches = splitIntoBatches(items);
  let doneCount = 0;
  let failed = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;

    // 1) 下载该批
    const files: File[] = [];
    for (const item of batch) {
      try {
        const { blob, mime } = await fetchAsBlob(item.url, opts.signal);
        files.push(new File([blob], item.filename, { type: mime }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return { done: doneCount, total, cancelled: true, failed };
        }
        failed++;
        // 跳过失败的图，继续后续
      }
      opts.onProgress?.({
        phase: 'downloading',
        batch: bi + 1,
        totalBatches: batches.length,
        done: doneCount + files.length,
        total,
      });
    }

    if (files.length === 0) continue;

    // 2) 校验是否真的能 share 这一批
    if (!navigator.canShare({ files })) {
      throw new Error('浏览器拒绝分享该批文件（可能太大）');
    }

    // 3) 调用 navigator.share
    opts.onProgress?.({
      phase: 'sharing',
      batch: bi + 1,
      totalBatches: batches.length,
      done: doneCount,
      total,
    });

    try {
      await navigator.share({ files, title: opts.title ?? '相册图片' });
      doneCount += files.length;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { done: doneCount, total, cancelled: true, failed };
      }
      throw err;
    }
  }

  return { done: doneCount, total, cancelled: false, failed };
}

/** 串行：每张单独 share。Web Share 不可用 / 一次性失败时降级使用 */
export async function saveImagesSequentially(
  items: BatchItem[],
  opts: {
    preferShare?: boolean;
    title?: string;
    onProgress?: (p: BatchProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<BatchResult> {
  let done = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const result = await saveImage(item.url, {
        filename: item.filename,
        preferShare: opts.preferShare,
        title: opts.title,
      });
      if (result === 'cancelled') {
        return { done, total: items.length, cancelled: true, failed };
      }
      done++;
    } catch {
      failed++;
    }
    opts.onProgress?.({
      phase: 'writing',
      done,
      total: items.length,
    });
  }
  return { done, total: items.length, cancelled: false, failed };
}

// ============================================================
// 桌面：File System Access API（让用户选文件夹一次性写入）
// ============================================================

/** 当前浏览器是否支持 File System Access API（showDirectoryPicker） */
export function canPickDirectory(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

interface FSDirHandle {
  getFileHandle: (name: string, opts: { create: boolean }) => Promise<FSFileHandle>;
}
interface FSFileHandle {
  createWritable: () => Promise<FSWritable>;
}
interface FSWritable {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * 让用户选一个本地文件夹，把所有图原文件名写进去（一次性，不走浏览器下载逻辑）。
 * 仅 Chrome/Edge 支持。Safari/Firefox 调用会抛错。
 */
export async function saveImagesToDirectory(
  items: BatchItem[],
  opts: {
    onProgress?: (p: BatchProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<BatchResult> {
  if (!canPickDirectory()) {
    throw new Error('当前浏览器不支持选择文件夹（请用 Chrome / Edge）');
  }
  const win = window as unknown as { showDirectoryPicker: () => Promise<FSDirHandle> };
  let dir: FSDirHandle;
  try {
    dir = await win.showDirectoryPicker();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { done: 0, total: items.length, cancelled: true, failed: 0 };
    }
    throw err;
  }

  let done = 0;
  let failed = 0;
  const usedNames = new Set<string>();

  for (const item of items) {
    try {
      const { blob } = await fetchAsBlob(item.url, opts.signal);
      let name = item.filename;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let i = 1;
        while (usedNames.has(`${base}-${i}${ext}`)) i++;
        name = `${base}-${i}${ext}`;
      }
      usedNames.add(name);
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      done++;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { done, total: items.length, cancelled: true, failed };
      }
      failed++;
    }
    opts.onProgress?.({
      phase: 'writing',
      done,
      total: items.length,
    });
  }

  return { done, total: items.length, cancelled: false, failed };
}
