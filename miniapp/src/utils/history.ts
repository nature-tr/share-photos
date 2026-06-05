import Taro from '@tarojs/taro';

interface HistoryItem {
  code: string;
  title: string;
  lastViewedAt: number;
  photoCount: number;
  /** 上次看到的照片索引（用于恢复位置） */
  lastPhotoIndex?: number;
}

export function getHistory(): HistoryItem[] {
  try {
    const raw = Taro.getStorageSync('browse_history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(item: HistoryItem) {
  const list = getHistory().filter((h) => h.code !== item.code);
  list.unshift(item);
  if (list.length > 20) list.length = 20;
  Taro.setStorageSync('browse_history', JSON.stringify(list));
}

export function addBrowsingHistory(code: string, title: string, photoCount: number) {
  const existing = getHistory().find((h) => h.code === code);
  saveHistory({
    code,
    title,
    lastViewedAt: Date.now(),
    photoCount,
    lastPhotoIndex: existing?.lastPhotoIndex ?? 0,
  });
}

/** 更新最后看到的照片位置（页面离开时调用） */
export function updateLastPosition(code: string, photoIndex: number) {
  const list = getHistory();
  const item = list.find((h) => h.code === code);
  if (item) {
    item.lastPhotoIndex = photoIndex;
    Taro.setStorageSync('browse_history', JSON.stringify(list));
  }
}

/** 获取某个分享上次看到的照片位置 */
export function getLastPosition(code: string): number {
  const item = getHistory().find((h) => h.code === code);
  return item?.lastPhotoIndex ?? 0;
}
