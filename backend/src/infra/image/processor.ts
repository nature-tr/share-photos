import sharp from 'sharp';
import fs from 'node:fs/promises';
import { Errors } from '../../common/errors.js';
import { previewPath, mediumPath, previewWebpPath, mediumWebpPath } from '../storage/paths.js';

export interface ProcessedImage {
  width: number;
  height: number;
  format: string;
}

const MAX_PIXELS = 268435456; // 268MP 像素上限

/**
 * 读取已落盘的原图，生成缩略图(短边400)与中等图(长边1600)的 JPEG + WebP。
 * 复用同一个 sharp 实例，clone() 派生，避免重复打开文件。
 */
export async function processImage(
  shareId: string,
  photoId: string,
  origPath: string,
): Promise<ProcessedImage> {
  let base: sharp.Sharp;
  try {
    base = sharp(origPath).rotate();
  } catch {
    throw Errors.invalidImage();
  }

  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw Errors.invalidImage();

  // 像素上限检查（sharp 0.33 移除了 limitInputPixels 链式方法）
  if (width * height > MAX_PIXELS) throw Errors.invalidImage();

  // -- 缩略图尺寸计算 --
  const thumbSize = 400;
  const shortSide = Math.min(width, height);
  const thumbResize =
    shortSide <= thumbSize
      ? undefined
      : width <= height
        ? { width: thumbSize }
        : { height: thumbSize };

  // -- 中等图尺寸计算 --
  const mediumSize = 1600;
  const longSide = Math.max(width, height);
  const mediumResize =
    longSide <= mediumSize
      ? undefined
      : width >= height
        ? { width: mediumSize }
        : { height: mediumSize };

  // 并行生成所有变体（clone 共享原图数据避免重复解码）
  await Promise.all([
    (async () => {
      const p = base.clone();
      if (thumbResize) p.resize(thumbResize);
      await p.jpeg({ quality: 70, mozjpeg: true }).toFile(previewPath(shareId, photoId));
    })(),
    (async () => {
      const p = base.clone();
      if (thumbResize) p.resize(thumbResize);
      await p.webp({ quality: 65 }).toFile(previewWebpPath(shareId, photoId));
    })(),
    (async () => {
      const p = base.clone();
      if (mediumResize) p.resize(mediumResize);
      await p.jpeg({ quality: 80, mozjpeg: true }).toFile(mediumPath(shareId, photoId));
    })(),
    (async () => {
      const p = base.clone();
      if (mediumResize) p.resize(mediumResize);
      await p.webp({ quality: 75 }).toFile(mediumWebpPath(shareId, photoId));
    })(),
  ]);

  return {
    width: meta.width ?? width,
    height: meta.height ?? height,
    format: meta.format ?? 'unknown',
  };
}

export async function getFileSize(p: string): Promise<number> {
  const stat = await fs.stat(p);
  return stat.size;
}
