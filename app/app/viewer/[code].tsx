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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { colors, font, radius, shadow, space } from '@/theme';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

export default function ViewerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        if (mounted) setError(err instanceof ApiException ? err.message : '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [codeUpper]);

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

  // 自定义顶栏：把"返回 + 标题 + 分享码 + 一键保存"集成到一条，避免与 native header 重复
  const NavBar = (
    <View style={[s.navBar, { paddingTop: insets.top + 6 }]}>
      <Pressable style={s.navBack} onPress={() => router.back()} hitSlop={10}>
        <Text style={s.navBackText}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.navTitle} numberOfLines={1}>
          {album?.title || '相册'}
        </Text>
        {album && (
          <Text style={s.navSub} numberOfLines={1}>
            <Text style={s.navCode}>{album.code}</Text>
            <Text>  ·  {album.photos.length} 张  ·  剩余 {formatRemaining(album.expiresAt - now)}</Text>
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        {NavBar}
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !album) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        {NavBar}
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🚫</Text>
          <Text style={s.errorTitle}>{error ?? '加载失败'}</Text>
          <Text style={s.errorDesc}>请确认分享码是否正确，或该分享是否已过期</Text>
          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
            onPress={() => router.replace('/')}
          >
            <Text style={s.btnText}>返回首页</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const photos = album.photos;
  const numColumns = 3;
  const tileSize = (WIN_W - space.sm * 2 - 4 * (numColumns - 1)) / numColumns;
  const expired = album.expiresAt - now <= 0;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {NavBar}

      {/* 行动条：一键保存到相册 */}
      <View style={s.actionBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.actionInfo}>
            {photos.length} 张 · {formatBytes(totalBytes)}
          </Text>
          <Text style={s.actionInfoSub}>原图已加密传输</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            s.saveAllBtn,
            pressed && { opacity: 0.85 },
            (saving || photos.length === 0) && { opacity: 0.5 },
          ]}
          disabled={saving || photos.length === 0}
          onPress={handleSaveAll}
        >
          <Text style={s.saveAllIcon}>↓</Text>
          <Text style={s.saveAllText}>{saving ? '保存中…' : '一键存到相册'}</Text>
        </Pressable>
      </View>

      {/* 网格 */}
      {photos.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🖼️</Text>
          <Text style={s.errorTitle}>暂无图片</Text>
          <Text style={s.errorDesc}>该分享尚未上传任何图片</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          numColumns={numColumns}
          contentContainerStyle={{ padding: space.sm, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [
                s.tile,
                { width: tileSize, height: tileSize },
                pressed && { opacity: 0.85 },
              ]}
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

      {/* 过期红条 */}
      {expired && (
        <View style={s.expiredBar}>
          <Text style={s.expiredText}>该分享已过期，图片已不可下载</Text>
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

interface PreviewModalProps {
  album: ViewerAlbum;
  codeUpper: string;
  startIdx: number;
  onClose: () => void;
  onSave: (photoId: string, filename: string) => void;
}

function PreviewModal({ album, codeUpper, startIdx, onClose, onSave }: PreviewModalProps) {
  const [idx, setIdx] = useState(startIdx);
  const insets = useSafeAreaInsets();
  const photo = album.photos[idx];
  if (!photo) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={pmS.root}>
        <View style={[pmS.header, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={onClose} style={pmS.headerBtn} hitSlop={10}>
            <Text style={pmS.headerBtnText}>关闭</Text>
          </Pressable>
          <Text style={pmS.headerTitle}>
            {idx + 1} / {album.photos.length}
          </Text>
          <Pressable
            onPress={() => onSave(photo.id, photo.originalName)}
            style={pmS.headerBtn}
            hitSlop={10}
          >
            <Text style={[pmS.headerBtnText, { color: '#60a5fa', fontWeight: '600' }]}>
              保存
            </Text>
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
                style={{ width: WIN_W, height: WIN_H - 140 - insets.top - insets.bottom }}
                contentFit="contain"
                transition={200}
              />
            </View>
          )}
        />
      </View>
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
    gap: space.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: space.sm },
  errorTitle: { ...font.h2, color: colors.text1 },
  errorDesc: { ...font.small, color: colors.text3, textAlign: 'center', marginBottom: space.md },
  btn: {
    paddingHorizontal: space.xl,
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  btnText: { ...font.bodyStrong, color: '#fff' },

  /* 自定义顶栏 */
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: 10,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  navBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  navBackText: { fontSize: 26, color: colors.text1, lineHeight: 28, fontWeight: '300', marginLeft: -2 },
  navTitle: { ...font.h3, color: colors.text1 },
  navSub: { ...font.caption, color: colors.text3, marginTop: 1 },
  navCode: { color: colors.primary, fontWeight: '700', letterSpacing: 1 },

  /* 行动条 */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  actionInfo: { ...font.bodyStrong, color: colors.text1 },
  actionInfoSub: { ...font.caption, color: colors.text3, marginTop: 2 },
  saveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    ...shadow.sm,
  },
  saveAllIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveAllText: { ...font.smallStrong, color: '#fff' },

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
    ...shadow.lg,
  },
  progressText: { ...font.caption, color: colors.text2, marginBottom: 6 },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceHover,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },

  expiredBar: {
    backgroundColor: colors.dangerSoft,
    paddingVertical: 8,
    alignItems: 'center',
  },
  expiredText: { ...font.caption, color: colors.danger, fontWeight: '600' },
});

const pmS = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: '#000',
  },
  headerBtn: { paddingHorizontal: space.md, paddingVertical: 8 },
  headerBtnText: { color: '#fff', fontSize: 14 },
  headerTitle: { flex: 1, color: '#fff', textAlign: 'center', fontSize: 14, fontWeight: '500' },
  page: { alignItems: 'center', justifyContent: 'center' },
});
