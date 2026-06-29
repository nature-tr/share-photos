import Taro from '@tarojs/taro';
import { api } from './client';
import { useAuth, API_BASE } from '@/stores/auth.store';
import type { ShareSummary, ShareDetail, ContributorInfo } from '@photo/shared/dto';

/** 缩略图 URL（网格用，400px 短边 JPEG） */
export function getThumbUrl(code: string, photoId: string) {
  return `${API_BASE}/api/v/${code}/photos/${photoId}/thumb`;
}

/** 中等尺寸 URL（预览大图用，1600px 长边 JPEG） */
export function getMediumUrl(code: string, photoId: string) {
  return `${API_BASE}/api/v/${code}/photos/${photoId}/medium`;
}

/** 原图 URL（下载保存用） */
export function getOriginalUrl(code: string, photoId: string) {
  return `${API_BASE}/api/v/${code}/photos/${photoId}/original`;
}

/** 凭码访问相册（支持分页） */
export async function getViewerShare(code: string, page = 1, pageSize = 50) {
  return api<ShareDetail>(`/api/v/${code}?page=${page}&pageSize=${pageSize}`);
}

/** 我的分享列表 */
export async function getMyShares() {
  return api<{ items: ShareSummary[]; total: number }>('/api/shares');
}

/** 创建分享 */
export async function createShare(ttlSeconds: number, title?: string) {
  return api<ShareDetail>('/api/shares', {
    method: 'POST',
    body: { ttlSeconds, title: title || undefined },
  });
}

/** 上传照片到指定分享 */
export async function uploadPhoto(shareId: string, filePath: string) {
  const token = await useAuth.getState().getAccessToken();
  return Taro.uploadFile({
    url: `${API_BASE}/api/shares/${shareId}/photos`,
    filePath,
    name: 'file',
    header: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** 重命名 */
export async function renameShare(shareId: string, title: string) {
  return api(`/api/shares/${shareId}/rename`, {
    method: 'PATCH',
    body: { title },
  });
}

/** 续期 */
export async function extendShare(shareId: string, extendSeconds: number) {
  return api(`/api/shares/${shareId}/extend`, {
    method: 'PATCH',
    body: { extendSeconds },
  });
}

/** 结束分享 */
export async function endShare(shareId: string) {
  const res = await api(`/api/shares/${shareId}`, { method: 'DELETE' });
  if (res.error) {
    console.error('[endShare] failed', res.error);
    throw new Error(res.error.message || '结束分享失败');
  }
}

/** 永久删除分享 */
export async function deleteShare(shareId: string) {
  const res = await api(`/api/shares/${shareId}/destroy`, { method: 'POST' });
  if (res.error) {
    throw new Error(res.error.message || '删除失败');
  }
}

/** 批量结束分享 */
export async function batchEndShares(shareIds: string[]) {
  return api<void>('/api/shares/batch-end', { method: 'POST', body: { shareIds } });
}

/** 批量永久删除分享 */
export async function batchDeleteShares(shareIds: string[]) {
  return api<void>('/api/shares/batch-destroy', { method: 'POST', body: { shareIds } });
}

/* ─── 贡献者 ─── */

/** 凭分享码申请加入 */
export async function requestJoin(code: string) {
  return api<ContributorInfo>(`/api/v/${code}/join`, { method: 'POST' });
}

/** 凭码获取已接受的贡献者列表 */
export async function getViewerContributors(code: string) {
  return api<ContributorInfo[]>(`/api/v/${code}/contributors`);
}

/** 获取分享的所有贡献者（含 pending，owner 专用） */
export async function getShareContributors(shareId: string) {
  return api<ContributorInfo[]>(`/api/shares/${shareId}/contributors`);
}

/** 审核贡献者申请 */
export async function reviewContributor(shareId: string, userId: string, action: 'accepted' | 'rejected') {
  return api<ContributorInfo>(`/api/shares/${shareId}/contributors/${userId}`, {
    method: 'PATCH',
    body: { action },
  });
}

/** 删除照片 */
export async function deletePhoto(shareId: string, photoId: string) {
  return api<void>(`/api/shares/${shareId}/photos/${photoId}`, { method: 'DELETE' });
}

/** 批量删除照片 */
export async function deletePhotos(shareId: string, photoIds: string[]) {
  return api<void>(`/api/shares/${shareId}/photos/batch-delete`, {
    method: 'POST',
    body: { photoIds },
  });
}
