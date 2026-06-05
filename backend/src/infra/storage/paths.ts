import path from 'node:path';
import { config } from '../../config/index.js';

const ORIGINALS = 'originals';
const PREVIEWS = 'previews';
const MEDIUMS = 'mediums';

export function shareDirs(shareId: string) {
  return {
    originals: path.join(config.storageDir, ORIGINALS, shareId),
    previews: path.join(config.storageDir, PREVIEWS, shareId),
    mediums: path.join(config.storageDir, MEDIUMS, shareId),
  };
}

export function originalPath(shareId: string, photoId: string, ext: string): string {
  return path.join(config.storageDir, ORIGINALS, shareId, `${photoId}.${ext}`);
}

export function previewPath(shareId: string, photoId: string): string {
  return path.join(config.storageDir, PREVIEWS, shareId, `${photoId}.jpg`);
}

export function previewWebpPath(shareId: string, photoId: string): string {
  return path.join(config.storageDir, PREVIEWS, shareId, `${photoId}.webp`);
}

export function mediumPath(shareId: string, photoId: string): string {
  return path.join(config.storageDir, MEDIUMS, shareId, `${photoId}.jpg`);
}

export function mediumWebpPath(shareId: string, photoId: string): string {
  return path.join(config.storageDir, MEDIUMS, shareId, `${photoId}.webp`);
}
