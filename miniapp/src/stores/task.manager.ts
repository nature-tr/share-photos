/**
 * 任务管理器（单例）
 * ─────────────────────────────────────────
 * 负责真正执行上传 / 下载，并持有 Taro.UploadTask / DownloadTask 句柄。
 * 暂停 / 取消时调用句柄 .abort()，可在字节级别立即中断当前正在传输的请求。
 *
 * 设计要点：
 *  - 与页面解耦：页面销毁后任务仍在运行，可后台继续。
 *  - 与 store 解耦：store 只放快照状态供 UI 订阅；manager 持有运行时上下文。
 *  - 暂停语义：当前正在传的那张图回滚为 pending，恢复时从这一张重传。
 *  - 取消语义：abort 当前请求 + 状态置 cancelled + 清理上下文与本地缓存。
 */

import Taro from '@tarojs/taro';
import { useTaskStore } from './task.store';
import { useAuth, API_BASE } from './auth.store';

/* ────────────────── 公共类型 ────────────────── */

export interface UploadItem {
  id: string;
  path: string;
  name: string;
  size?: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export interface UploadMeta {
  title: string;
  ttl: number;
  totalBytes?: number;
}

export interface DownloadPhoto {
  id: string;
}

/* ────────────────── 内部上下文 ────────────────── */

interface UploadCtx {
  shareId: string;
  items: UploadItem[];
  meta: UploadMeta;
  done: number;
  failed: number;
  /** 当前正在执行的 wx 任务句柄，用于 abort */
  wxTask: Taro.UploadTask | null;
  /** 是否有 runner 在跑（防止并发重启） */
  running: boolean;
  /** 订阅者：每当 items / 计数发生变化时触发 */
  listeners: Set<() => void>;
}

interface DownloadCtx {
  code: string;
  photos: DownloadPhoto[];
  cursor: number;
  done: number;
  failed: number;
  wxTask: Taro.DownloadTask | null;
  running: boolean;
  listeners: Set<() => void>;
}

const uploads = new Map<string, UploadCtx>();
const downloads = new Map<string, DownloadCtx>();

const UPLOAD_STORAGE_KEY = (id: string) => `upload_items_${id}`;

/* ────────────────── 工具 ────────────────── */

function persistUpload(ctx: UploadCtx) {
  try {
    Taro.setStorageSync(UPLOAD_STORAGE_KEY(ctx.shareId), JSON.stringify(ctx.items));
  } catch {
    /* ignore */
  }
}

function notifyUpload(ctx: UploadCtx) {
  ctx.listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function notifyDownload(ctx: DownloadCtx) {
  ctx.listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function isAbortError(errMsg?: string) {
  if (!errMsg) return false;
  return errMsg.indexOf('abort') >= 0;
}

/* ────────────────── 上传执行 ────────────────── */

function uploadOne(ctx: UploadCtx, item: UploadItem): Promise<{ ok: boolean; aborted: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    const token = await useAuth.getState().getAccessToken();
    let settled = false;
    const wx = Taro.uploadFile({
      url: `${API_BASE}/api/shares/${ctx.shareId}/photos`,
      filePath: item.path,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (settled) return;
        settled = true;
        const ok = res.statusCode === 200 || res.statusCode === 201;
        resolve({ ok, aborted: false, error: ok ? undefined : `HTTP ${res.statusCode}` });
      },
      fail: (err: any) => {
        if (settled) return;
        settled = true;
        const aborted = isAbortError(err?.errMsg);
        resolve({ ok: false, aborted, error: aborted ? 'aborted' : (err?.errMsg || '上传失败') });
      },
    }) as unknown as Taro.UploadTask;
    ctx.wxTask = wx;
  }).then((r) => {
    ctx.wxTask = null;
    return r;
  });
}

async function runUpload(ctx: UploadCtx) {
  if (ctx.running) return;
  ctx.running = true;

  // 状态置 uploading（如不是已经 uploading）
  const cur = useTaskStore.getState().uploads[ctx.shareId];
  if (!cur || cur.status === 'cancelled' || cur.status === 'done') {
    ctx.running = false;
    return;
  }
  if (cur.status !== 'uploading') {
    useTaskStore.setState((s) => ({
      uploads: { ...s.uploads, [ctx.shareId]: { ...s.uploads[ctx.shareId]!, status: 'uploading' } },
    }));
  }

  try {
    for (let i = 0; i < ctx.items.length; i++) {
      const it = ctx.items[i]!;
      if (it.status === 'done') continue;

      // 检查暂停 / 取消
      const t = useTaskStore.getState().uploads[ctx.shareId];
      if (!t || t.status !== 'uploading') return;

      // 标记 uploading
      ctx.items[i] = { ...it, status: 'uploading', error: undefined };
      persistUpload(ctx);
      notifyUpload(ctx);

      const r = await uploadOne(ctx, it);

      // 中断后再确认状态
      const t2 = useTaskStore.getState().uploads[ctx.shareId];
      if (!t2) return;

      if (r.aborted || t2.status === 'cancelled' || t2.status === 'paused') {
        // 当前 item 回滚为 pending，下次恢复时从这张图重传
        ctx.items[i] = { ...it, status: 'pending' };
        persistUpload(ctx);
        notifyUpload(ctx);
        return;
      }

      if (r.ok) {
        ctx.items[i] = { ...ctx.items[i]!, status: 'done' };
        ctx.done++;
      } else {
        ctx.items[i] = { ...ctx.items[i]!, status: 'error', error: r.error };
        ctx.failed++;
      }
      persistUpload(ctx);
      notifyUpload(ctx);
      useTaskStore.getState().updateUpload(ctx.shareId, ctx.done, ctx.failed);
    }

    // 完成
    const final = useTaskStore.getState().uploads[ctx.shareId];
    if (final && final.status === 'uploading') {
      useTaskStore.getState().finishUpload(ctx.shareId);
      Taro.removeStorageSync(UPLOAD_STORAGE_KEY(ctx.shareId));
      notifyUpload(ctx);
      Taro.showToast({
        title: `完成 ${ctx.done}${ctx.failed ? `，失败 ${ctx.failed}` : ''}`,
        icon: 'success',
      });
    }
  } finally {
    ctx.running = false;
  }
}

/* ────────────────── 下载执行 ────────────────── */

function downloadOne(ctx: DownloadCtx, photoId: string): Promise<{ ok: boolean; aborted: boolean; tempPath?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const wx = Taro.downloadFile({
      url: `${API_BASE}/api/v/${ctx.code}/photos/${photoId}/original`,
      success: (res) => {
        if (settled) return;
        settled = true;
        if (res.statusCode === 200) resolve({ ok: true, aborted: false, tempPath: res.tempFilePath });
        else resolve({ ok: false, aborted: false });
      },
      fail: (err: any) => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, aborted: isAbortError(err?.errMsg) });
      },
    }) as unknown as Taro.DownloadTask;
    ctx.wxTask = wx;
  }).then((r) => {
    ctx.wxTask = null;
    return r;
  });
}

async function runDownload(ctx: DownloadCtx) {
  if (ctx.running) return;
  ctx.running = true;

  const cur = useTaskStore.getState().downloads[ctx.code];
  if (!cur || cur.status === 'cancelled' || cur.status === 'done') {
    ctx.running = false;
    return;
  }
  if (cur.status !== 'downloading') {
    useTaskStore.setState((s) => ({
      downloads: { ...s.downloads, [ctx.code]: { ...s.downloads[ctx.code]!, status: 'downloading' } },
    }));
  }

  try {
    while (ctx.cursor < ctx.photos.length) {
      const t = useTaskStore.getState().downloads[ctx.code];
      if (!t || t.status !== 'downloading') return;

      const p = ctx.photos[ctx.cursor]!;
      const r = await downloadOne(ctx, p.id);

      const t2 = useTaskStore.getState().downloads[ctx.code];
      if (!t2) return;

      if (r.aborted || t2.status === 'cancelled' || t2.status === 'paused') return;

      if (r.ok && r.tempPath) {
        try {
          await Taro.saveImageToPhotosAlbum({ filePath: r.tempPath });
          ctx.done++;
        } catch {
          ctx.failed++;
        }
      } else {
        ctx.failed++;
      }
      ctx.cursor++;
      useTaskStore.getState().updateDownload(ctx.code, ctx.done + ctx.failed, ctx.failed);
      notifyDownload(ctx);
    }

    const final = useTaskStore.getState().downloads[ctx.code];
    if (final && final.status === 'downloading') {
      useTaskStore.getState().finishDownload(ctx.code);
      notifyDownload(ctx);
      if (ctx.failed === 0) Taro.showToast({ title: `已保存 ${ctx.done} 张`, icon: 'success' });
      else Taro.showToast({ title: `完成 ${ctx.done}，失败 ${ctx.failed}`, icon: 'none' });
    }
  } finally {
    ctx.running = false;
  }
}

/* ────────────────── 对外 API ────────────────── */

export const taskManager = {
  /* ─── 上传 ─── */

  /** 启动一个新的上传任务 */
  startUpload(shareId: string, items: UploadItem[], meta: UploadMeta) {
    const ctx: UploadCtx = {
      shareId,
      items: items.map((i) => ({ ...i })),
      meta,
      done: 0,
      failed: 0,
      wxTask: null,
      running: false,
      listeners: new Set(),
    };
    uploads.set(shareId, ctx);
    persistUpload(ctx);

    useTaskStore.getState().startUpload(shareId, items.length);
    useTaskStore
      .getState()
      .saveFormState(shareId, meta.title, meta.ttl, items.length, meta.totalBytes ?? 0);

    void runUpload(ctx);
    return ctx;
  },

  /** 暂停上传（abort 当前请求） */
  pauseUpload(shareId: string) {
    const ctx = uploads.get(shareId);
    useTaskStore.getState().pauseUpload(shareId);
    ctx?.wxTask?.abort();
  },

  /** 恢复上传（继续从未完成的那张图开始） */
  resumeUpload(shareId: string) {
    const ctx = uploads.get(shareId);
    if (!ctx) return;
    const t = useTaskStore.getState().uploads[shareId];
    if (!t || t.status === 'cancelled' || t.status === 'done') return;
    void runUpload(ctx);
  },

  /** 取消上传（abort + 清理） */
  cancelUpload(shareId: string) {
    const ctx = uploads.get(shareId);
    useTaskStore.getState().cancelUpload(shareId);
    ctx?.wxTask?.abort();
    if (ctx) {
      Taro.removeStorageSync(UPLOAD_STORAGE_KEY(shareId));
      notifyUpload(ctx);
      uploads.delete(shareId);
    }
  },

  /** 获取上下文（页面回来时读取当前进度） */
  getUploadCtx(shareId: string): UploadCtx | undefined {
    return uploads.get(shareId);
  },

  /** 订阅上传上下文变化 */
  subscribeUpload(shareId: string, fn: () => void): () => void {
    const ctx = uploads.get(shareId);
    if (!ctx) return () => {};
    ctx.listeners.add(fn);
    return () => { ctx.listeners.delete(fn); };
  },

  /* ─── 下载 ─── */

  /** 启动下载任务 */
  startDownload(code: string, photos: DownloadPhoto[]) {
    const ctx: DownloadCtx = {
      code,
      photos: photos.slice(),
      cursor: 0,
      done: 0,
      failed: 0,
      wxTask: null,
      running: false,
      listeners: new Set(),
    };
    downloads.set(code, ctx);
    useTaskStore.getState().startDownload(code, photos.length);
    void runDownload(ctx);
    return ctx;
  },

  /** 暂停下载 */
  pauseDownload(code: string) {
    const ctx = downloads.get(code);
    useTaskStore.getState().pauseDownload(code);
    ctx?.wxTask?.abort();
  },

  /** 恢复下载 */
  resumeDownload(code: string) {
    const ctx = downloads.get(code);
    if (!ctx) return;
    const t = useTaskStore.getState().downloads[code];
    if (!t || t.status === 'cancelled' || t.status === 'done') return;
    void runDownload(ctx);
  },

  /** 取消下载 */
  cancelDownload(code: string) {
    const ctx = downloads.get(code);
    useTaskStore.getState().cancelDownload(code);
    ctx?.wxTask?.abort();
    if (ctx) {
      notifyDownload(ctx);
      downloads.delete(code);
    }
  },

  /** 获取下载上下文 */
  getDownloadCtx(code: string): DownloadCtx | undefined {
    return downloads.get(code);
  },
};
