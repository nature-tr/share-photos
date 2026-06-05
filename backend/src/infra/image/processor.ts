import sharp from 'sharp';
import fs from 'node:fs/promises';
import { Errors } from '../../common/errors.js';
import { previewPath, mediumPath } from '../storage/paths.js';

export interface ProcessedImage {
  width: number;
  height: number;
  format: string;
}

export async function processImage(
  shareId: string,
  photoId: string,
  originalPath: string,
): Promise<ProcessedImage> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(originalPath).metadata();
  } catch {
    throw Errors.invalidImage();
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw Errors.invalidImage();
  }

  const thumbSize = 400;
  const shortSide = Math.min(width, height);
  const thumbResize =
    shortSide <= thumbSize
      ? null
      : width <= height
        ? { width: thumbSize }
        : { height: thumbSize };

  const mediumSize = 1600;
  const longSide = Math.max(width, height);
  const mediumResize =
    longSide <= mediumSize
      ? null
      : width >= height
        ? { width: mediumSize }
        : { height: mediumSize };

  const thumbDest = previewPath(shareId, photoId);
  const mediumDest = mediumPath(shareId, photoId);

  const thumbPipeline = sharp(originalPath).rotate();
  if (thumbResize) thumbPipeline.resize(thumbResize);
  await thumbPipeline.jpeg({ quality: 80, mozjpeg: true }).toFile(thumbDest);

  const mediumPipeline = sharp(originalPath).rotate();
  if (mediumResize) mediumPipeline.resize(mediumResize);
  await mediumPipeline.jpeg({ quality: 85, mozjpeg: true }).toFile(mediumDest);

  const finalMeta = await sharp(originalPath).rotate().metadata();
  return {
    width: finalMeta.width ?? width,
    height: finalMeta.height ?? height,
    format: metadata.format ?? 'unknown',
  };
}

export async function getFileSize(p: string): Promise<number> {
  const stat = await fs.stat(p);
  return stat.size;
}
