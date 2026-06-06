import { create } from 'zustand';

export interface UploadTask {
  shareId: string;
  total: number;
  done: number;
  failed: number;
  status: 'uploading' | 'done' | 'cancelled';
  /** 新建分享页表单状态，用于恢复页面 */
  formTitle?: string;
  formTtl?: number;
  formItemCount?: number;
  formTotalBytes?: number;
}

export interface DownloadTask {
  shareCode: string;
  total: number;
  done: number;
  status: 'downloading' | 'done' | 'cancelled';
}

interface TaskState {
  uploads: Record<string, UploadTask>;
  downloads: Record<string, DownloadTask>;

  startUpload: (shareId: string, total: number) => void;
  updateUpload: (shareId: string, done: number, failed: number) => void;
  finishUpload: (shareId: string) => void;
  cancelUpload: (shareId: string) => void;

  startDownload: (shareCode: string, total: number) => void;
  updateDownload: (shareCode: string, done: number) => void;
  finishDownload: (shareCode: string) => void;
  cancelDownload: (shareCode: string) => void;

  /** 保存表单状态到已有的上传任务 */
  saveFormState: (shareId: string, title: string, ttl: number, itemCount: number, totalBytes: number) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  uploads: {},
  downloads: {},

  startUpload: (shareId, total) =>
    set((s) => ({
      uploads: { ...s.uploads, [shareId]: { shareId, total, done: 0, failed: 0, status: 'uploading' } },
    })),

  updateUpload: (shareId, done, failed) =>
    set((s) => {
      const existing = s.uploads[shareId];
      if (!existing) return s;
      return { uploads: { ...s.uploads, [shareId]: { ...existing, done, failed } } };
    }),

  finishUpload: (shareId) =>
    set((s) => {
      const existing = s.uploads[shareId];
      if (!existing) return s;
      return { uploads: { ...s.uploads, [shareId]: { ...existing, status: 'done' as const } } };
    }),

  cancelUpload: (shareId) =>
    set((s) => {
      const existing = s.uploads[shareId];
      if (!existing) return s;
      return { uploads: { ...s.uploads, [shareId]: { ...existing, status: 'cancelled' as const } } };
    }),

  startDownload: (shareCode, total) =>
    set((s) => ({
      downloads: { ...s.downloads, [shareCode]: { shareCode, total, done: 0, status: 'downloading' } },
    })),

  updateDownload: (shareCode, done) =>
    set((s) => {
      const existing = s.downloads[shareCode];
      if (!existing) return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...existing, done } } };
    }),

  finishDownload: (shareCode) =>
    set((s) => {
      const existing = s.downloads[shareCode];
      if (!existing) return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...existing, status: 'done' as const } } };
    }),

  cancelDownload: (shareCode) =>
    set((s) => {
      const existing = s.downloads[shareCode];
      if (!existing) return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...existing, status: 'cancelled' as const } } };
    }),

  saveFormState: (shareId, title, ttl, itemCount, totalBytes) =>
    set((s) => {
      const existing = s.uploads[shareId];
      if (!existing) return s;
      return {
        uploads: {
          ...s.uploads,
          [shareId]: { ...existing, formTitle: title, formTtl: ttl, formItemCount: itemCount, formTotalBytes: totalBytes },
        },
      };
    }),
}));
