/**
 * 任务进度状态（仅快照）
 *
 * 这个 store 只存"用 UI 渲染需要的进度数据"，不承担任何业务/上下文：
 *   - 业务上下文（items / meta / wxTask 句柄等）由 task.manager 持有
 *   - UI 仅订阅 done/failed/status 三个标量来更新进度条
 *
 * 这样订阅 selector 返回的对象引用稳定，避免 GlobalProgress 在每张图片
 * 上传完后整体重渲。
 */

import { create } from 'zustand';

export interface UploadTask {
  shareId: string;
  total: number;
  done: number;
  failed: number;
  status: 'uploading' | 'paused' | 'done' | 'cancelled';
}

export interface DownloadTask {
  shareCode: string;
  total: number;
  done: number;
  failed: number;
  status: 'downloading' | 'paused' | 'done' | 'cancelled';
}

interface TaskState {
  uploads: Record<string, UploadTask>;
  downloads: Record<string, DownloadTask>;

  /** GlobalProgress 全局状态（跨页面共享，避免每个页面实例孤立） */
  gpCollapsed: boolean;
  gpY: number;
  gpBallX: number;
  gpShield: boolean;
  setGpCollapsed: (v: boolean) => void;
  setGpY: (v: number) => void;
  setGpBallX: (v: number) => void;
  setGpShield: (v: boolean) => void;
  /** 批量设置位置参数，跳过无变化 */
  setGpPos: (y: number, ballX: number, collapsed: boolean, fn?: (y: number, bx: number, c: boolean) => void) => void;

  startUpload: (shareId: string, total: number) => void;
  updateUpload: (shareId: string, done: number, failed: number) => void;
  pauseUpload: (shareId: string) => void;
  finishUpload: (shareId: string) => void;
  cancelUpload: (shareId: string) => void;
  /** 由 manager 在 runUpload 内部调用：把状态置为 uploading（恢复时） */
  setUploadStatus: (shareId: string, status: UploadTask['status']) => void;

  startDownload: (shareCode: string, total: number) => void;
  updateDownload: (shareCode: string, done: number, failed: number) => void;
  pauseDownload: (shareCode: string) => void;
  finishDownload: (shareCode: string) => void;
  cancelDownload: (shareCode: string) => void;
  setDownloadStatus: (shareCode: string, status: DownloadTask['status']) => void;
}

/** 上传记录的浅 patch（保持引用稳定，无变化时返回原 state） */
function patchUpload<S extends TaskState>(s: S, id: string, patch: Partial<UploadTask>): S {
  const e = s.uploads[id];
  if (!e) return s;
  // 跳过无效变化
  let dirty = false;
  for (const k of Object.keys(patch) as (keyof UploadTask)[]) {
    if (patch[k] !== e[k]) { dirty = true; break; }
  }
  if (!dirty) return s;
  return { ...s, uploads: { ...s.uploads, [id]: { ...e, ...patch } } };
}

function patchDownload<S extends TaskState>(s: S, id: string, patch: Partial<DownloadTask>): S {
  const e = s.downloads[id];
  if (!e) return s;
  let dirty = false;
  for (const k of Object.keys(patch) as (keyof DownloadTask)[]) {
    if (patch[k] !== e[k]) { dirty = true; break; }
  }
  if (!dirty) return s;
  return { ...s, downloads: { ...s.downloads, [id]: { ...e, ...patch } } };
}

export const useTaskStore = create<TaskState>((set) => ({
  uploads: {},
  downloads: {},

  gpCollapsed: false,
  gpY: 0,
  gpBallX: 0,
  gpShield: false,
  setGpCollapsed: (v) => set((s) => (s.gpCollapsed === v ? s : { ...s, gpCollapsed: v })),
  setGpY: (v) => set((s) => (s.gpY === v ? s : { ...s, gpY: v })),
  setGpBallX: (v) => set((s) => (s.gpBallX === v ? s : { ...s, gpBallX: v })),
  setGpShield: (v) => set((s) => (s.gpShield === v ? s : { ...s, gpShield: v })),
  setGpPos: (y, bx, c, persist) =>
    set((s) => {
      if (s.gpY === y && s.gpBallX === bx && s.gpCollapsed === c) return s;
      if (persist) persist(y, bx, c);
      return { ...s, gpY: y, gpBallX: bx, gpCollapsed: c };
    }),

  startUpload: (shareId, total) =>
    set((s) => ({
      uploads: {
        ...s.uploads,
        [shareId]: { shareId, total, done: 0, failed: 0, status: 'uploading' },
      },
    })),

  updateUpload: (shareId, done, failed) =>
    set((s) => {
      const e = s.uploads[shareId];
      // 不检查 status：manager 控制流程，store 只管记录数据。
      // 如果检查 status !== 'uploading'，暂停/恢复时会丢失已完成的进度更新。
      if (!e) return s;
      return patchUpload(s, shareId, { done, failed });
    }),

  pauseUpload: (shareId) =>
    set((s) => {
      const e = s.uploads[shareId];
      if (!e || e.status !== 'uploading') return s;
      return patchUpload(s, shareId, { status: 'paused' });
    }),

  finishUpload: (shareId) => set((s) => patchUpload(s, shareId, { status: 'done' })),

  cancelUpload: (shareId) => set((s) => patchUpload(s, shareId, { status: 'cancelled' })),

  setUploadStatus: (shareId, status) => set((s) => patchUpload(s, shareId, { status })),

  startDownload: (shareCode, total) =>
    set((s) => ({
      downloads: {
        ...s.downloads,
        [shareCode]: { shareCode, total, done: 0, failed: 0, status: 'downloading' },
      },
    })),

  updateDownload: (shareCode, done, failed) =>
    set((s) => {
      const e = s.downloads[shareCode];
      // 不检查 status，同上
      if (!e) return s;
      return patchDownload(s, shareCode, { done, failed });
    }),

  pauseDownload: (shareCode) =>
    set((s) => {
      const e = s.downloads[shareCode];
      if (!e || e.status !== 'downloading') return s;
      return patchDownload(s, shareCode, { status: 'paused' });
    }),

  finishDownload: (shareCode) => set((s) => patchDownload(s, shareCode, { status: 'done' })),

  cancelDownload: (shareCode) => set((s) => patchDownload(s, shareCode, { status: 'cancelled' })),

  setDownloadStatus: (shareCode, status) =>
    set((s) => patchDownload(s, shareCode, { status })),
}));
