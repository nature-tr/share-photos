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

/** 更新最后浏览位置（页面离开时调用，记录已加载照片数 + 滚动高度） */
export function updateLastPosition(code: string, photoCount: number, scrollTop: number) {
  const list = getHistory();
  const item = list.find((h) => h.code === code);
  if (item) {
    item.lastPhotoIndex = photoCount;
    (item as any).scrollTop = scrollTop;
    Taro.setStorageSync('browse_history', JSON.stringify(list));
  }
}

/** 获取某个分享上次的浏览位置信息 */
export function getLastPosition(code: string): { photoCount: number; scrollTop: number } {
  const item = getHistory().find((h) => h.code === code);
  return {
    photoCount: item?.lastPhotoIndex ?? 0,
    scrollTop: (item as any)?.scrollTop ?? 0,
  };
}

/** 清除指定分享的浏览记录 */
export function removeHistory(code: string) {
  const list = getHistory().filter((h) => h.code !== code);
  Taro.setStorageSync('browse_history', JSON.stringify(list));
}

/** 替换全部历史记录 */
export function saveHistoryList(list: HistoryItem[]) {
  Taro.setStorageSync('browse_history', JSON.stringify(list));
}
