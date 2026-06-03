import type { CreateShareInput, ShareDetail, ShareSummary, ViewerAlbum } from '@photo/shared';
import { API_BASE_URL, request } from './client';

export const shareApi = {
  list(query: { page: number; pageSize: number }) {
    return request<{ items: ShareSummary[]; total: number }>('/api/shares', { query });
  },
  create(input: CreateShareInput) {
    return request<ShareDetail>('/api/shares', { method: 'POST', body: input });
  },
  extend(id: string, ttlSeconds: number) {
    return request<{ id: string; expiresAt: number }>(`/api/shares/${id}/extend`, {
      method: 'POST',
      body: { ttlSeconds },
    });
  },
  end(id: string) {
    return request<void>(`/api/shares/${id}/end`, { method: 'POST' });
  },
  getByCode(code: string) {
    return request<ViewerAlbum>(`/api/v/${code}`, { auth: false, autoRefresh: false });
  },
};

export const photoApi = {
  thumbUrl(code: string, photoId: string) {
    return `${API_BASE_URL}/api/v/${code}/photos/${photoId}/thumb`;
  },
  mediumUrl(code: string, photoId: string) {
    return `${API_BASE_URL}/api/v/${code}/photos/${photoId}/medium`;
  },
  originalUrl(code: string, photoId: string, download = false) {
    return `${API_BASE_URL}/api/v/${code}/photos/${photoId}/original${download ? '?download=1' : ''}`;
  },
  /** 上传图片（multipart）；shareId 已存在 */
  async upload(
    shareId: string,
    file: { uri: string; name: string; type: string },
    uploadedAs: 'original' | 'compressed',
  ) {
    const formData = new FormData();
    // RN 的 FormData append 文件用这个对象形式
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);
    formData.append('uploadedAs', uploadedAs);
    return request<{ id: string }>(`/api/shares/${shareId}/photos`, {
      method: 'POST',
      body: formData,
    });
  },
  zipDownloadUrl(code: string) {
    return `${API_BASE_URL}/api/v/${code}/download`;
  },
};
