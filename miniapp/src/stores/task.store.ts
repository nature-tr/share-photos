import { create } from 'zustand';

export interface UploadTask {
  shareId: string;
  total: number;
  done: number;
  failed: number;
  status: 'uploading' | 'done' | 'cancelled';
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

  // upload
  startUpload: (shareId: string, total: number) => void;
  updateUpload: (shareId: string, done: number, failed: number) => void;
  finishUpload: (shareId: string) => void;
  cancelUpload: (shareId: string) => void;

  // download
  startDownload: (shareCode: string, total: number) => void;
  updateDownload: (shareCode: string, done: number) => void;
  finishDownload: (shareCode: string) => void;
  cancelDownload: (shareCode: string) => void;
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
      return {
        uploads: { ...s.uploads, [shareId]: { ...existing, done, failed } },
      };
    }),

  finishUpload: (shareId) =>
    set((s) => {
      const existing = s.uploads[shareId];
      if (!existing) return s;
      return {
        uploads: { ...s.uploads, [shareId]: { ...existing, status: 'done' as const } },
      };
    }),

  cancelUpload: (shareId) =>
    set((s) => {
      const existing = s.uploads[shareId];
      if (!existing) return s;
      return {
        uploads: { ...s.uploads, [shareId]: { ...existing, status: 'cancelled' as const } },
      };
    }),

  startDownload: (shareCode, total) =>
    set((s) => ({
      downloads: { ...s.downloads, [shareCode]: { shareCode, total, done: 0, status: 'downloading' } },
    })),

  updateDownload: (shareCode, done) =>
    set((s) => {
      const existing = s.downloads[shareCode];
      if (!existing) return s;
      return {
        downloads: { ...s.downloads, [shareCode]: { ...existing, done } },
      };
    }),

  finishDownload: (shareCode) =>
    set((s) => {
      const existing = s.downloads[shareCode];
      if (!existing) return s;
      return {
        downloads: { ...s.downloads, [shareCode]: { ...existing, status: 'done' as const } },
      };
    }),

  cancelDownload: (shareCode) =>
    set((s) => {
      const existing = s.downloads[shareCode];
      if (!existing) return s;
      return {
        downloads: { ...s.downloads, [shareCode]: { ...existing, status: 'cancelled' as const } },
      };
    }),
}));
