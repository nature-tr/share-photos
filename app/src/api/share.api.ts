import type { CreateShareInput, ShareDetail, ShareSummary, ViewerAlbum, ContributorInfo } from '@photo/shared';
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
  getByCode(code: string, page?: number, pageSize?: number) {
    const qs = page ? `?page=${page}&pageSize=${pageSize ?? 50}` : '';
    return request<ViewerAlbum>(`/api/v/${code}${qs}`, { auth: false, autoRefresh: false });
  },

  /** 安全检测 owner，失败不触发登出 */
  async tryGetOwner(code: string): Promise<boolean> {
    try {
      const res = await request<any>(`/api/v/${code}?page=1&pageSize=1`, { auth: true, autoRefresh: false });
      return res?.isOwner ?? false;
    } catch { return false; }
  },

  // ─── 贡献者 ───
  requestJoin(code: string) {
    return request<ContributorInfo>(`/api/v/${code}/join`, { method: 'POST' });
  },
  getViewerContributors(code: string) {
    return request<ContributorInfo[]>(`/api/v/${code}/contributors`, { auth: false, autoRefresh: false });
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
