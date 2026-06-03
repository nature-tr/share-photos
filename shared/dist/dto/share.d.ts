export type ShareStatus = 'active' | 'ended' | 'cleaned';
export type UploadedAs = 'original' | 'compressed';
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
}
export interface ShareDetail extends ShareSummary {
    photos: PhotoMeta[];
}
/** 查看者侧凭码访问的相册（不包含 owner 信息） */
export interface ViewerAlbum {
    code: string;
    title: string | null;
    expiresAt: number;
    photos: PhotoMeta[];
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
