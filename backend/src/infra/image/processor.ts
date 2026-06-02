import sharp from 'sharp';
import fs from 'node:fs/promises';
import { Errors } from '../../common/errors.js';
import { previewPath, mediumPath } from '../storage/paths.js';

export interface ProcessedImage {
  width: number;
  height: number;
  format: string;
}

/**
 * 读取已落盘的原图，生成缩略图(短边400 q80)与中等图(长边1600 q85)。
 * 返回原图的尺寸与格式。
 */
export async function processImage(
  shareId: string,
  photoId: string,
  originalPath: string,
): Promise<ProcessedImage> {
  let metadata: sharp.Metadata;
  try {
    // autoOrient 处理 EXIF 旋转，再读取尺寸
    metadata = await sharp(originalPath).metadata();
  } catch {
    throw Errors.invalidImage();
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw Errors.invalidImage();
  }

  // 缩略图：短边 ~400
  const thumbSize = 400;
  const shortSide = Math.min(width, height);
  const thumbResize =
    shortSide <= thumbSize
      ? null
      : width <= height
        ? { width: thumbSize }
        : { height: thumbSize };

  // 中等图：长边 ~1600
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

  // 处理后的尺寸是按原图算（PhotoSwipe 等需要的实际比例）
  // 因为 rotate() 后 metadata 的 width/height 可能与文件 EXIF 反了，重读一次更准
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
