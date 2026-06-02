import archiver from 'archiver';
import fs from 'node:fs';
import type { Readable } from 'node:stream';

/**
 * 创建一个 zip 流（store 模式不二次压缩），调用方负责 append 文件并 finalize。
 */
export function createZipStream(): archiver.Archiver {
  const archive = archiver('zip', {
    store: true, // 不再压缩，节省 CPU
  });
  return archive;
}

export interface ZipFileInput {
  path: string;
  name: string; // 在 zip 内的文件名
}

export function appendFile(archive: archiver.Archiver, file: ZipFileInput): void {
  const stream = fs.createReadStream(file.path);
  archive.append(stream as Readable, { name: file.name });
}
