import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { useTaskStore } from '@/stores/task.store';
import './index.scss';

export default function GlobalProgress() {
  const allUploads = useTaskStore((s) => s.uploads);
  const allDownloads = useTaskStore((s) => s.downloads);

  const uploadList = Object.values(allUploads);
  const downloadList = Object.values(allDownloads);

  const activeUploads = uploadList.filter((t) => t.status === 'uploading');
  const doneUploads = uploadList.filter((t) => t.status === 'done');
  const activeDownloads = downloadList.filter((t) => t.status === 'downloading');
  const doneDownloads = downloadList.filter((t) => t.status === 'done');

  if (activeUploads.length === 0 && activeDownloads.length === 0 && doneUploads.length === 0 && doneDownloads.length === 0) return null;

  return (
    <View className="global-progress">
      {activeUploads.map((t) => {
        const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
        return (
          <View key={t.shareId} className="gp-item" onClick={() => Taro.navigateTo({ url: '/pages/me/new/index' })}>
            <Text className="gp-label">上传中 {t.done}/{t.total}{t.formTitle ? ` · ${t.formTitle}` : ''}</Text>
            <View className="gp-track">
              <View className="gp-fill gp-fill-upload" style={{ width: `${pct}%` }} />
            </View>
          </View>
        );
      })}
      {activeDownloads.map((t) => {
        const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
        return (
          <View key={t.shareCode} className="gp-item">
            <Text className="gp-label">保存中 {t.done}/{t.total}</Text>
            <View className="gp-track">
              <View className="gp-fill gp-fill-download" style={{ width: `${pct}%` }} />
            </View>
          </View>
        );
      })}
      {doneUploads.map((t) => (
        <View key={t.shareId} className="gp-item gp-done" onClick={() => useTaskStore.getState().cancelUpload(t.shareId)}>
          <Text className="gp-label gp-label-done">✓ 上传完成 · 点击关闭</Text>
        </View>
      ))}
      {doneDownloads.map((t) => (
        <View key={t.shareCode} className="gp-item gp-done" onClick={() => useTaskStore.getState().cancelDownload(t.shareCode)}>
          <Text className="gp-label gp-label-done">✓ 保存完成 · 点击关闭</Text>
        </View>
      ))}
    </View>
  );
}
