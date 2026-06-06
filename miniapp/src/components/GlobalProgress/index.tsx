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

  const uploadedDone = activeUploads.reduce((s, t) => s + t.done, 0);
  const uploadedTotal = activeUploads.reduce((s, t) => s + t.total, 0);
  const dlDone = activeDownloads.reduce((s, t) => s + t.done, 0);
  const dlTotal = activeDownloads.reduce((s, t) => s + t.total, 0);

  return (
    <View className="global-progress">
      {activeUploads.length > 0 && (
        <View className="gp-item">
          <Text className="gp-label">上传中 {uploadedDone}/{uploadedTotal}</Text>
          <View className="gp-track">
            <View className="gp-fill gp-fill-upload" style={{ width: `${uploadedTotal > 0 ? Math.round((uploadedDone / uploadedTotal) * 100) : 0}%` }} />
          </View>
        </View>
      )}
      {activeDownloads.length > 0 && (
        <View className="gp-item">
          <Text className="gp-label">保存中 {dlDone}/{dlTotal}</Text>
          <View className="gp-track">
            <View className="gp-fill gp-fill-download" style={{ width: `${dlTotal > 0 ? Math.round((dlDone / dlTotal) * 100) : 0}%` }} />
          </View>
        </View>
      )}
      {activeUploads.length === 0 && doneUploads.length > 0 && (
        <View className="gp-item gp-done" onClick={() => doneUploads.forEach((t) => useTaskStore.getState().cancelUpload(t.shareId))}>
          <Text className="gp-label gp-label-done">✓ 上传完成 · 点击关闭</Text>
        </View>
      )}
      {activeDownloads.length === 0 && doneDownloads.length > 0 && (
        <View className="gp-item gp-done" onClick={() => doneDownloads.forEach((t) => useTaskStore.getState().cancelDownload(t.shareCode))}>
          <Text className="gp-label gp-label-done">✓ 保存完成 · 点击关闭</Text>
        </View>
      )}
    </View>
  );
}
