import { useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import { useTaskStore } from '@/stores/task.store';
import './index.scss';

export default function GlobalProgress() {
  // 使用 useMemo 避免 filter 每次生成新引用导致无限重渲染
  const allUploads = useTaskStore((s) => s.uploads);
  const allDownloads = useTaskStore((s) => s.downloads);

  const uploads = useMemo(() => Object.values(allUploads).filter((t) => t.status === 'uploading'), [allUploads]);
  const downloads = useMemo(() => Object.values(allDownloads).filter((t) => t.status === 'downloading'), [allDownloads]);
  const doneUploads = useMemo(() => Object.values(allUploads).filter((t) => t.status === 'done'), [allUploads]);
  const doneDownloads = useMemo(() => Object.values(allDownloads).filter((t) => t.status === 'done'), [allDownloads]);

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
        <View className="gp-item gp-done" onClick={() => doneUploads.forEach((t) => useTaskStore.getState().cancelUpload(t.shareId))}>
          <Text className="gp-label gp-label-done">✓ 上传完成 · 点击关闭</Text>
        </View>
      )}
      {activeDownloads === 0 && completedDownloads > 0 && (
        <View className="gp-item gp-done" onClick={() => doneDownloads.forEach((t) => useTaskStore.getState().cancelDownload(t.shareCode))}>
          <Text className="gp-label gp-label-done">✓ 保存完成 · 点击关闭</Text>
        </View>
      )}
    </View>
  );
}
