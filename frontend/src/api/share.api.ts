import { request, uploadWithProgress } from './client';
import type {
  ShareSummary,
  ShareDetail,
  ShareListResponse,
  ViewerAlbum,
  UploadPhotoResponse,
  UploadedAs,
  ContributorInfo,
} from '@photo/shared';

export const shareApi = {
  create(input: { ttlSeconds: number; title?: string }) {
    return request<ShareSummary>('/api/shares', { method: 'POST', body: input });
  },
  list(query: { page?: number; pageSize?: number; status?: string } = {}) {
    return request<ShareListResponse>('/api/shares', { query });
  },
  getById(shareId: string) {
    return request<ShareDetail>(`/api/shares/${shareId}`);
  },
  extend(shareId: string, extendSeconds: number) {
    return request<{ id: string; expiresAt: number }>(`/api/shares/${shareId}/extend`, {
      method: 'PATCH',
      body: { extendSeconds },
    });
  },
  end(shareId: string) {
    return request<void>(`/api/shares/${shareId}`, { method: 'DELETE' });
  },
  rename(shareId: string, title: string) {
    return request<void>(`/api/shares/${shareId}/rename`, { method: 'PATCH', body: { title } });
  },
  destroy(shareId: string) {
    return request<void>(`/api/shares/${shareId}/destroy`, { method: 'POST' });
  },
  batchEnd(shareIds: string[]) {
    return request<void>('/api/shares/batch-end', { method: 'POST', body: { shareIds } });
  },
  batchDestroy(shareIds: string[]) {
    return request<void>('/api/shares/batch-destroy', { method: 'POST', body: { shareIds } });
  },

  // 凭码访问（公开，带可选认证获取 isOwner）
  getByCode(code: string, page?: number, pageSize?: number) {
    const params = page ? `?page=${page}&pageSize=${pageSize ?? 50}` : '';
    return request<ViewerAlbum>(`/api/v/${encodeURIComponent(code)}${params}`, { auth: true, autoRefresh: false });
  },

  // ─── 贡献者 ───
  requestJoin(code: string) {
    return request<ContributorInfo>(`/api/v/${encodeURIComponent(code)}/join`, { method: 'POST' });
  },
  getViewerContributors(code: string) {
    return request<ContributorInfo[]>(`/api/v/${encodeURIComponent(code)}/contributors`, { auth: false });
  },
  getShareContributors(shareId: string) {
    return request<ContributorInfo[]>(`/api/shares/${shareId}/contributors`);
  },
  reviewContributor(shareId: string, userId: string, action: 'accepted' | 'rejected') {
    return request<ContributorInfo>(`/api/shares/${shareId}/contributors/${userId}`, {
      method: 'PATCH',
      body: { action },
    });
  },
};

export const photoApi = {
  upload(
    shareId: string,
    file: File,
    uploadedAs: UploadedAs,
    onProgress?: (p: number) => void,
    signal?: AbortSignal,
  ) {
    const fd = new FormData();
    fd.append('uploadedAs', uploadedAs);
    fd.append('file', file, file.name);
    return uploadWithProgress<UploadPhotoResponse>(
      `/api/shares/${shareId}/photos`,
      fd,
      onProgress,
      signal,
    );
  },
  delete(shareId: string, photoId: string) {
    return request<void>(`/api/shares/${shareId}/photos/${photoId}`, { method: 'DELETE' });
  },
  deleteBatch(shareId: string, photoIds: string[]) {
    return request<void>(`/api/shares/${shareId}/photos/batch-delete`, { method: 'POST', body: { photoIds } });
  },

  // 凭码访问图片 URL（用作 <img> src）
  thumbUrl(code: string, photoId: string) {
    return `/api/v/${encodeURIComponent(code)}/photos/${photoId}/thumb`;
  },
  mediumUrl(code: string, photoId: string) {
    return `/api/v/${encodeURIComponent(code)}/photos/${photoId}/medium`;
  },
  originalUrl(code: string, photoId: string, download = false) {
    return `/api/v/${encodeURIComponent(code)}/photos/${photoId}/original${download ? '?download=1' : ''}`;
  },
  zipDownloadUrl(code: string) {
    return `/api/v/${encodeURIComponent(code)}/download`;
  },
};
