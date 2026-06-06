import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import { useTaskStore } from '@/stores/task.store';
import { iconPause, iconUpload, iconDownload, iconXMark } from '@/assets/icons';
import './index.scss';

export default function GlobalProgress() {
  const allUploads = useTaskStore((s) => s.uploads);
  const allDownloads = useTaskStore((s) => s.downloads);

  const tasks = [
    ...Object.values(allUploads).map((t) => ({ ...t, kind: 'upload' as const })),
    ...Object.values(allDownloads).map((t) => ({ ...t, kind: 'download' as const })),
  ].filter((t) => t.status !== 'cancelled');

  if (tasks.length === 0) return null;

  const pages = Taro.getCurrentPages();

  return (
    <View className="global-progress">
      <View className="gp-card">
        {tasks.map((t) => {
          const isUpload = t.kind === 'upload';
          const isActive = t.status === 'uploading' || t.status === 'downloading';
          const isPaused = t.status === 'paused';
          const total = t.total;
          const pct = total > 0 ? Math.round((t.done / total) * 100) : 0;

          const onRowClick = () => {
            const current = pages[pages.length - 1];
            if (isUpload) {
              if (current?.route === 'pages/me/new/index') return;
              Taro.navigateTo({ url: `/pages/me/new/index?restoreShareId=${t.shareId}` });
            } else {
              if (current?.route === 'pages/viewer/detail/index' && (current?.options as any)?.code === t.shareCode) return;
              Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${t.shareCode}` });
            }
          };

          return (
            <View key={isUpload ? t.shareId : t.shareCode} className="gp-row" onClick={onRowClick}>
              <View className="gp-row-left">
                <Text className="gp-row-label">
                  {isUpload ? '↑' : '↓'}
                  {' '}{isUpload ? `上传 ${t.done}/${total}` : `保存 ${t.done}/${total}`}
                  {t.formTitle ? ` · ${t.formTitle}` : ''}
                  {isPaused ? ' 已暂停' : ''}
                  {t.failed > 0 ? ` (失败${t.failed})` : ''}
                </Text>
                {(isActive || isPaused) && (
                  <View className="gp-row-track">
                    <View className="gp-row-fill" style={{ width: `${pct}%`, background: isPaused ? '#94a3b8' : undefined }} />
                  </View>
                )}
              </View>
              <View className="gp-row-actions" onClick={(e: any) => e.stopPropagation()}>
                {isActive && (
                  <View className="gp-row-btn" onClick={() => isUpload ? useTaskStore.getState().pauseUpload(t.shareId) : useTaskStore.getState().pauseDownload(t.shareCode)}>
                    <Image src={iconPause('#475569')} className="gp-row-btn-icon" />
                  </View>
                )}
                {isPaused && (
                  <View className="gp-row-btn" onClick={() => {
                    if (isUpload) {
                      useTaskStore.setState((s) => ({
                        uploads: { ...s.uploads, [t.shareId]: { ...s.uploads[t.shareId]!, status: 'uploading' } },
                      }));
                    } else {
                      useTaskStore.setState((s) => ({
                        downloads: { ...s.downloads, [t.shareCode]: { ...s.downloads[t.shareCode]!, status: 'downloading' } },
                      }));
                    }
                  }}>
                    <Image src={isUpload ? iconUpload('#3b82f6') : iconDownload('#3b82f6')} className="gp-row-btn-icon" />
                  </View>
                )}
                <View className="gp-row-btn" onClick={() => isUpload ? useTaskStore.getState().cancelUpload(t.shareId) : useTaskStore.getState().cancelDownload(t.shareCode)}>
                  <Image src={iconXMark('#94a3b8')} className="gp-row-btn-icon" />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
