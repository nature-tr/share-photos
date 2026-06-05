import Taro from '@tarojs/taro';

interface HistoryItem {
  code: string;
  title: string;
  lastViewedAt: number;
  photoCount: number;
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
  saveHistory({ code, title, lastViewedAt: Date.now(), photoCount });
}
