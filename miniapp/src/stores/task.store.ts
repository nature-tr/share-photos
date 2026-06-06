import { create } from 'zustand';

export interface UploadTask {
  shareId: string;
  total: number;
  done: number;
  failed: number;
  status: 'uploading' | 'paused' | 'done' | 'cancelled';
  formTitle?: string;
  formTtl?: number;
  formItemCount?: number;
  formTotalBytes?: number;
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

  startUpload: (shareId: string, total: number) => void;
  updateUpload: (shareId: string, done: number, failed: number) => void;
  pauseUpload: (shareId: string) => void;
  finishUpload: (shareId: string) => void;
  cancelUpload: (shareId: string) => void;

  startDownload: (shareCode: string, total: number) => void;
  updateDownload: (shareCode: string, done: number, failed: number) => void;
  pauseDownload: (shareCode: string) => void;
  finishDownload: (shareCode: string) => void;
  cancelDownload: (shareCode: string) => void;

  saveFormState: (shareId: string, title: string, ttl: number, itemCount: number, totalBytes: number) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  uploads: {},
  downloads: {},

  startUpload: (shareId, total) =>
    set((s) => ({ uploads: { ...s.uploads, [shareId]: { shareId, total, done: 0, failed: 0, status: 'uploading' } } })),

  updateUpload: (shareId, done, failed) =>
    set((s) => {
      const e = s.uploads[shareId];
      if (!e || e.status !== 'uploading') return s;
      return { uploads: { ...s.uploads, [shareId]: { ...e, done, failed } } };
    }),

  pauseUpload: (shareId) =>
    set((s) => {
      const e = s.uploads[shareId];
      if (!e || e.status !== 'uploading') return s;
      return { uploads: { ...s.uploads, [shareId]: { ...e, status: 'paused' } } };
    }),

  finishUpload: (shareId) =>
    set((s) => {
      const e = s.uploads[shareId];
      if (!e) return s;
      return { uploads: { ...s.uploads, [shareId]: { ...e, status: 'done' as const } } };
    }),

  cancelUpload: (shareId) =>
    set((s) => {
      const e = s.uploads[shareId];
      if (!e) return s;
      return { uploads: { ...s.uploads, [shareId]: { ...e, status: 'cancelled' as const } } };
    }),

  startDownload: (shareCode, total) =>
    set((s) => ({ downloads: { ...s.downloads, [shareCode]: { shareCode, total, done: 0, failed: 0, status: 'downloading' } } })),

  updateDownload: (shareCode, done, failed) =>
    set((s) => {
      const e = s.downloads[shareCode];
      if (!e || e.status !== 'downloading') return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...e, done, failed } } };
    }),

  pauseDownload: (shareCode) =>
    set((s) => {
      const e = s.downloads[shareCode];
      if (!e || e.status !== 'downloading') return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...e, status: 'paused' } } };
    }),

  finishDownload: (shareCode) =>
    set((s) => {
      const e = s.downloads[shareCode];
      if (!e) return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...e, status: 'done' as const } } };
    }),

  cancelDownload: (shareCode) =>
    set((s) => {
      const e = s.downloads[shareCode];
      if (!e) return s;
      return { downloads: { ...s.downloads, [shareCode]: { ...e, status: 'cancelled' as const } } };
    }),

  saveFormState: (shareId, title, ttl, itemCount, totalBytes) =>
    set((s) => {
      const e = s.uploads[shareId];
      if (!e) return s;
      return { uploads: { ...s.uploads, [shareId]: { ...e, formTitle: title, formTtl: ttl, formItemCount: itemCount, formTotalBytes: totalBytes } } };
    }),
}));
