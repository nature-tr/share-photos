import { useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import { useTaskStore } from '@/stores/task.store';
import './index.scss';

export default function GlobalProgress() {
  const uploads = useTaskStore((s) => Object.values(s.uploads).filter((t) => t.status === 'uploading'));
  const downloads = useTaskStore((s) => Object.values(s.downloads).filter((t) => t.status === 'downloading'));
  const doneUploads = useTaskStore((s) => Object.values(s.uploads).filter((t) => t.status === 'done'));
  const doneDownloads = useTaskStore((s) => Object.values(s.downloads).filter((t) => t.status === 'done'));
  const dismissed = useRef(false);

  // 完成后 3 秒自动消失（仅触发一次）
  useEffect(() => {
    if (doneUploads.length > 0 || doneDownloads.length > 0) {
      if (dismissed.current) return;
      dismissed.current = true;
      const timer = setTimeout(() => {
        doneUploads.forEach((t) => useTaskStore.getState().cancelUpload(t.shareId));
        doneDownloads.forEach((t) => useTaskStore.getState().cancelDownload(t.shareCode));
        dismissed.current = false;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [doneUploads.length, doneDownloads.length]);

  const activeUploads = uploads.length;
  const activeDownloads = downloads.length;
  const completedUploads = doneUploads.length;
  const completedDownloads = doneDownloads.length;

  if (activeUploads === 0 && activeDownloads === 0 && completedUploads === 0 && completedDownloads === 0) return null;

  const uploadedDone = uploads.reduce((s, t) => s + t.done, 0);
  const uploadedTotal = uploads.reduce((s, t) => s + t.total, 0);
  const uploadPct = uploadedTotal > 0 ? Math.round((uploadedDone / uploadedTotal) * 100) : 0;

  const dlDone = downloads.reduce((s, t) => s + t.done, 0);
  const dlTotal = downloads.reduce((s, t) => s + t.total, 0);
  const dlPct = dlTotal > 0 ? Math.round((dlDone / dlTotal) * 100) : 0;

  return (
    <View className="global-progress">
      {activeUploads > 0 && (
        <View className="gp-item">
          <Text className="gp-label">上传中 {uploadedDone}/{uploadedTotal}</Text>
          <View className="gp-track">
            <View className="gp-fill gp-fill-upload" style={{ width: `${uploadPct}%` }} />
          </View>
        </View>
      )}
      {activeDownloads > 0 && (
        <View className="gp-item">
          <Text className="gp-label">保存中 {dlDone}/{dlTotal}</Text>
          <View className="gp-track">
            <View className="gp-fill gp-fill-download" style={{ width: `${dlPct}%` }} />
          </View>
        </View>
      )}
      {activeUploads === 0 && completedUploads > 0 && (
        <View className="gp-item gp-done">
          <Text className="gp-label gp-label-done">✓ 上传完成</Text>
        </View>
      )}
      {activeDownloads === 0 && completedDownloads > 0 && (
        <View className="gp-item gp-done">
          <Text className="gp-label gp-label-done">✓ 保存完成</Text>
        </View>
      )}
    </View>
  );
}
