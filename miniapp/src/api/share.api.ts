import Taro from '@tarojs/taro';
import { api } from './client';
import { useAuth, API_BASE } from '@/stores/auth.store';
import type { ShareSummary, ShareDetail } from '@photo/shared/dto';

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

/** 凭码访问相册 */
export async function getViewerShare(code: string) {
  return api<ShareDetail>(`/api/v/${code}`);
}

/** 我的分享列表 */
export async function getMyShares() {
  return api<{ items: ShareSummary[]; total: number }>('/api/shares');
}

/** 创建分享 */
export async function createShare(ttlSeconds: number) {
  return api<ShareDetail>('/api/shares', {
    method: 'POST',
    body: { ttlSeconds },
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
