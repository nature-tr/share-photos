/**
 * 通用 Hooks（小工具集）
 */

import { useEffect, useState } from 'react';

/**
 * 1Hz（默认）的"当前时间"，用于显示倒计时/剩余时长。
 * 用 hook 局部订阅，避免在多个页面重复写 setInterval/setNow。
 */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ─── chooseMedia ─── */

import Taro from '@tarojs/taro';

export interface PickedImage {
  /** 临时文件路径 */
  path: string;
  /** 文件大小（bytes） */
  size?: number;
}

export interface PickImagesOpts {
  /** 最多选几张 */
  count?: number;
  /** 是否在选完后立即把 path 转换成 fileName（默认 true） */
  withName?: boolean;
}

/** 选图结果 */
export interface PickImagesResult {
  items: PickedImage[];
  /** 失败原因（空数组时要看这个区分"取消"还是"没有权限"） */
  reason?: string;
}

/**
 * 弹出 actionSheet 让用户选择「原图 / 压缩」，再调用 chooseMedia。
 * 始终 resolve，通过 reason 区分是用户取消还是权限被拒绝。
 */
export function pickImagesFromAlbum(opts: PickImagesOpts = {}): Promise<PickImagesResult> {
  const { count = 9 } = opts;
  return new Promise((resolve) => {
    Taro.showActionSheet({
      itemList: ['原图', '压缩'],
      success: (sheet) => {
        const compressed = sheet.tapIndex === 1;
        Taro.chooseMedia({
          count,
          mediaType: ['image'],
          sizeType: compressed ? ['compressed'] : ['original'],
          success: (res) => {
            resolve({ items: res.tempFiles.map((f) => ({ path: f.tempFilePath, size: f.size })) });
          },
          fail: (err: any) => {
            const msg: string = err?.errMsg ?? '';
            if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0 || msg.indexOf('authorize') >= 0 || msg.indexOf('permission') >= 0 || msg.indexOf('privacy') >= 0 || msg.indexOf('scope') >= 0) {
              resolve({ items: [], reason: 'denied' });
            } else {
              resolve({ items: [], reason: 'cancel' });
            }
          },
        });
      },
      fail: () => resolve({ items: [], reason: 'cancel' }),
    });
  });
}
