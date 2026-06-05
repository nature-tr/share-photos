export type ShareStatus = 'active' | 'ended' | 'cleaned';
export type UploadedAs = 'original' | 'compressed';
export type ContributorStatus = 'pending' | 'accepted' | 'rejected';
export type ContributorRole = 'contributor';

export interface PhotoMeta {
  id: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  uploadedAs: UploadedAs;
  createdAt: number;
}

export interface ContributorInfo {
  id: string;
  shareId: string;
  userId: string;
  displayName: string | null;
  email: string;
  status: ContributorStatus;
  role: ContributorRole;
  createdAt: number;
}

export interface ShareSummary {
  id: string;
  code: string;
  title: string | null;
  status: ShareStatus;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  photoCount: number;
  totalBytes: number;
  pendingContributorCount?: number;
}

export interface ShareDetail extends ShareSummary {
  photos: PhotoMeta[];
  contributors?: ContributorInfo[];
}

/** 查看着侧凭码访问的相册（不包含 owner 信息） */
export interface ViewerAlbum {
  code: string;
  title: string | null;
  expiresAt: number;
  photos: PhotoMeta[];
  contributors: ContributorInfo[];
  totalPhotos?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  isOwner?: boolean;
}

export interface ShareListResponse {
  items: ShareSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadPhotoResponse {
  id: string;
  originalName: string;
  width: number;
  height: number;
  sizeBytes: number;
  uploadedAs: UploadedAs;
  createdAt: number;
}
