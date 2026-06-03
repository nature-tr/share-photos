import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ViewerAlbum } from '@photo/shared';
import { ApiException } from '@/api/client';
import { photoApi, shareApi } from '@/api/share.api';
import {
  PermissionDeniedError,
  saveImagesToAlbum,
  saveSingleImage,
  type SaveProgress,
} from '@/utils/saveToAlbum';
import { toast, toastLong } from '@/utils/toast';
import { formatBytes, formatRemaining } from '@/utils/format';
import { colors, radius, space } from '@/theme';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

export default function ViewerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [album, setAlbum] = useState<ViewerAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);

  const codeUpper = (code ?? '').toString().toUpperCase();

  useEffect(() => {
    let mounted = true;
    if (!codeUpper) {
      setError('分享码无效');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await shareApi.getByCode(codeUpper);
        if (mounted) setAlbum(data);
      } catch (err) {
        if (mounted)
          setError(err instanceof ApiException ? err.message : '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [codeUpper]);

  // 倒计时刷新
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalBytes = useMemo(
    () => album?.photos.reduce((s, p) => s + p.sizeBytes, 0) ?? 0,
    [album],
  );

  async function handleSaveAll() {
    if (!album || album.photos.length === 0) return;
    Alert.alert(
      '保存全部到相册？',
      `共 ${album.photos.length} 张 · ${formatBytes(totalBytes)}\n下载并写入手机相册，请稍候`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始保存',
          onPress: async () => {
            setSaving(true);
            setSaveProgress({
              phase: 'downloading',
              done: 0,
              total: album.photos.length,
              failed: 0,
            });
            try {
              const items = album.photos.map((p) => ({
                url: photoApi.originalUrl(codeUpper, p.id, true),
                filename: p.originalName,
              }));
              const r = await saveImagesToAlbum(items, (pr) => setSaveProgress(pr));
              if (r.failed === 0) {
                toastLong(`已保存 ${r.done}/${r.total} 张到相册`);
              } else {
                toastLong(`完成 ${r.done}/${r.total}，失败 ${r.failed} 张`);
              }
            } catch (err) {
              if (err instanceof PermissionDeniedError) {
                Alert.alert(
                  '需要相册权限',
                  '请在 设置 → Dolmo Photo → 照片 中允许访问，否则无法保存图片到相册。',
                );
              } else {
                Alert.alert('保存失败', (err as Error).message);
              }
            } finally {
              setSaving(false);
              setSaveProgress(null);
            }
          },
        },
      ],
    );
  }

  async function handleSaveOne(photoId: string, filename: string) {
    try {
      await saveSingleImage(photoApi.originalUrl(codeUpper, photoId, true), filename);
      toast('已保存到相册');
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        Alert.alert('需要相册权限', '请在系统设置中允许访问相册');
      } else {
        Alert.alert('保存失败', (err as Error).message);
      }
    }
  }

  // ============ render ============

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !album) {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>{error ?? '加载失败'}</Text>
        <Text style={s.errorDesc}>请确认分享码是否正确，或该分享是否已过期</Text>
        <Pressable style={s.btn} onPress={() => router.replace('/')}>
          <Text style={s.btnText}>返回首页</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = formatRemaining(album.expiresAt - now);
  const photos = album.photos;
  const numColumns = 3;
  const tileSize = (WIN_W - space.sm * 2 - 4 * (numColumns - 1)) / numColumns;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: album.title || '相册',
          headerRight: () => null,
        }}
      />
      {/* meta 条 */}
      <View style={s.metaBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.metaCode}>{album.code}</Text>
          <Text style={s.metaSub}>
            {photos.length} 张 · {formatBytes(totalBytes)} · 剩余 {remaining}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [s.saveAllBtn, pressed && { opacity: 0.85 }]}
          disabled={saving || photos.length === 0}
          onPress={handleSaveAll}
        >
          <Text style={s.saveAllText}>
            {saving ? '保存中…' : '一键存到相册'}
          </Text>
        </Pressable>
      </View>

      {/* 网格 */}
      {photos.length === 0 ? (
        <View style={s.center}>
          <Text style={s.errorDesc}>该分享尚未上传图片</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          numColumns={numColumns}
          contentContainerStyle={{ padding: space.sm, paddingBottom: 80 }}
          columnWrapperStyle={{ gap: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          renderItem={({ item, index }) => (
            <Pressable
              style={[s.tile, { width: tileSize, height: tileSize }]}
              onPress={() => setPreviewIdx(index)}
            >
              <Image
                source={{ uri: photoApi.thumbUrl(codeUpper, item.id) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          )}
        />
      )}

      {/* 进度条 */}
      {saving && saveProgress && (
        <View style={s.progressBar}>
          <Text style={s.progressText}>
            {saveProgress.phase === 'downloading' ? '下载中' : '保存到相册中'} ·{' '}
            {saveProgress.done}/{saveProgress.total}
            {saveProgress.failed > 0 ? `（失败 ${saveProgress.failed}）` : ''}
          </Text>
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                {
                  width: `${
                    saveProgress.total
                      ? Math.round((saveProgress.done / saveProgress.total) * 100)
                      : 0
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* 大图预览 */}
      {previewIdx !== null && (
        <PreviewModal
          album={album}
          codeUpper={codeUpper}
          startIdx={previewIdx}
          onClose={() => setPreviewIdx(null)}
          onSave={handleSaveOne}
        />
      )}
    </SafeAreaView>
  );
}

// ============ 大图预览 ============

interface PreviewModalProps {
  album: ViewerAlbum;
  codeUpper: string;
  startIdx: number;
  onClose: () => void;
  onSave: (photoId: string, filename: string) => void;
}

function PreviewModal({ album, codeUpper, startIdx, onClose, onSave }: PreviewModalProps) {
  const [idx, setIdx] = useState(startIdx);
  const photo = album.photos[idx];
  if (!photo) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={pmS.root} edges={['top', 'bottom']}>
        <View style={pmS.header}>
          <Pressable onPress={onClose} style={pmS.headerBtn}>
            <Text style={pmS.headerBtnText}>关闭</Text>
          </Pressable>
          <Text style={pmS.headerTitle}>
            {idx + 1} / {album.photos.length}
          </Text>
          <Pressable
            onPress={() => onSave(photo.id, photo.originalName)}
            style={pmS.headerBtn}
          >
            <Text style={[pmS.headerBtnText, { color: colors.primary }]}>保存到相册</Text>
          </Pressable>
        </View>

        <FlatList
          data={album.photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIdx}
          getItemLayout={(_, i) => ({ length: WIN_W, offset: WIN_W * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / WIN_W);
            setIdx(i);
          }}
          renderItem={({ item }) => (
            <View style={[pmS.page, { width: WIN_W }]}>
              <Image
                source={{ uri: photoApi.mediumUrl(codeUpper, item.id) }}
                style={{ width: WIN_W, height: WIN_H - 120 }}
                contentFit="contain"
                transition={200}
              />
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.text1 },
  errorDesc: { fontSize: 14, color: colors.text3, textAlign: 'center' },
  btn: {
    paddingHorizontal: space.xl,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: space.lg,
  },
  btnText: { color: '#fff', fontWeight: '600' },

  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  metaCode: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  metaSub: { fontSize: 12, color: colors.text3, marginTop: 2 },
  saveAllBtn: {
    paddingHorizontal: space.lg,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAllText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  tile: {
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },

  progressBar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  progressText: { fontSize: 12, color: colors.text2, marginBottom: 6 },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceHover,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
});

const pmS = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: '#000',
  },
  headerBtn: { paddingHorizontal: space.md, paddingVertical: 6 },
  headerBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  headerTitle: { flex: 1, color: '#fff', textAlign: 'center', fontSize: 14 },
  page: { alignItems: 'center', justifyContent: 'center' },
});
