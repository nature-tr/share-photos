/**
 * 单张图片保存：
 * - 移动端真机浏览器（iOS Safari / Android Chrome）：优先 Web Share API
 *   → 用户在系统面板点「存储图像」/「保存到相册」
 * - 其他场景：浏览器原生下载
 *
 * 批量场景一律走服务端 zip 流（`/api/v/:code/download`），由顶栏「下载 zip」按钮触发。
 * 真正"一键全部进相册"的需求请等 Flutter App 版本。
 */
import { canShareFiles } from '@/composables/useDevice';

/** 把远程图片下载下来 */
async function fetchAsBlob(
  url: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; mime: string }> {
  const resp = await fetch(url, { credentials: 'include', signal });
  if (!resp.ok) {
    throw new Error(`下载失败: HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  const mime = blob.type || resp.headers.get('content-type') || 'application/octet-stream';
  return { blob, mime };
}

/** 触发浏览器原生下载（PC/Android 进入 Downloads；iOS 进入文件 App） */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export interface SaveImageOptions {
  filename: string;
  preferShare?: boolean;
  title?: string;
}

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/** 单张保存：优先 Web Share，fallback 下载 */
export async function saveImage(url: string, opts: SaveImageOptions): Promise<SaveResult> {
  const { blob, mime } = await fetchAsBlob(url);

  if (opts.preferShare && canShareFiles()) {
    const file = new File([blob], opts.filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: opts.title ?? '相册图片' });
        return 'shared';
      } catch (err) {
        if ((err as Error).name === 'AbortError') return 'cancelled';
      }
    }
  }

  triggerBrowserDownload(blob, opts.filename);
  return 'downloaded';
}
