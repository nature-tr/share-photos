import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  MAX_FILE_SIZE,
  MAX_PHOTOS_PER_SHARE,
  TTL_PRESETS,
} from '@photo/shared';
import { ApiException } from '@/api/client';
import { photoApi, shareApi } from '@/api/share.api';
import { toast, toastLong } from '@/utils/toast';
import { formatBytes } from '@/utils/format';
import { colors, font, radius, shadow, space } from '@/theme';

interface PickedItem {
  id: string;
  uri: string;
  name: string;
  type: string;
  size?: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

function genId() {
  return Math.random().toString(36).slice(2);
}

export default function NewShareScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [ttl, setTtl] = useState<number>(TTL_PRESETS[2]!.seconds);
  const [items, setItems] = useState<PickedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === 'done').length;
    const error = items.filter((i) => i.status === 'error').length;
    const totalBytes = items.reduce((s, i) => s + (i.size ?? 0), 0);
    return { total, done, error, totalBytes };
  }, [items]);

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast('需要相册权限');
      return;
    }
    const remaining = MAX_PHOTOS_PER_SHARE - items.length;
    if (remaining <= 0) {
      toast(`最多 ${MAX_PHOTOS_PER_SHARE} 张`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: remaining,
      exif: false,
    });
    if (result.canceled) return;
    const newItems: PickedItem[] = result.assets.map((a) => {
      const name = a.fileName || `photo-${Date.now()}.jpg`;
      const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = a.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');
      return {
        id: genId(),
        uri: a.uri,
        name,
        type: mime,
        size: a.fileSize,
        status: 'pending',
      };
    });
    setItems((arr) => [...arr, ...newItems]);
  }

  function removeItem(id: string) {
    setItems((arr) => arr.filter((i) => i.id !== id));
  }

  async function start() {
    if (items.length === 0) {
      toast('请先选择图片');
      return;
    }
    setSubmitting(true);
    try {
      const share = await shareApi.create({ ttlSeconds: ttl, title: title.trim() || undefined });
      setCreated({ id: share.id, code: share.code });

      for (const it of items) {
        if (it.status === 'done') continue;
        setItems((arr) =>
          arr.map((x) => (x.id === it.id ? { ...x, status: 'uploading', error: undefined } : x)),
        );
        try {
          if (it.size && it.size > MAX_FILE_SIZE) {
            throw new Error(`文件过大（${formatBytes(it.size)}），单文件需 ≤ ${formatBytes(MAX_FILE_SIZE)}`);
          }
          await photoApi.upload(
            share.id,
            { uri: it.uri, name: it.name, type: it.type },
            'original',
          );
          setItems((arr) =>
            arr.map((x) => (x.id === it.id ? { ...x, status: 'done' } : x)),
          );
        } catch (err) {
          const msg = err instanceof ApiException ? err.message : (err as Error).message;
          setItems((arr) =>
            arr.map((x) => (x.id === it.id ? { ...x, status: 'error', error: msg } : x)),
          );
        }
      }
      toastLong('上传完成');
    } catch (err) {
      toast(err instanceof ApiException ? err.message : '创建分享失败');
    } finally {
      setSubmitting(false);
    }
  }

  // 创建成功页
  if (created && stats.done === stats.total && stats.error === 0) {
    return (
      <View style={s.successWrap}>
        <Stack.Screen options={{ title: '分享已创建' }} />
        <View style={s.successIconBox}>
          <Text style={s.successIcon}>✓</Text>
        </View>
        <Text style={s.successTitle}>上传完成！</Text>
        <Text style={s.successDesc}>把分享码或链接发给朋友</Text>
        <View style={s.codeBox}>
          <Text style={s.codeBoxLabel}>分享码</Text>
          <Text style={s.codeBig}>{created.code}</Text>
          <Text style={s.codeMeta}>
            {stats.done} 张 · {formatBytes(stats.totalBytes)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.md, alignSelf: 'stretch' }}>
          <Pressable
            style={({ pressed }) => [s.btnOutline, { flex: 1 }, pressed && { opacity: 0.7 }]}
            onPress={() => router.replace('/(me)/shares')}
          >
            <Text style={s.btnOutlineText}>我的分享</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.btn, { flex: 1 }, pressed && { opacity: 0.85 }]}
            onPress={() =>
              router.replace({ pathname: '/viewer/[code]', params: { code: created.code } })
            }
          >
            <Text style={s.btnText}>查看相册</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: '新建分享' }} />

      {/* 表单卡片 */}
      <View style={s.card}>
        <Text style={s.label}>相册标题</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="例如：周末聚会（可选）"
          placeholderTextColor={colors.text4}
          style={s.input}
          editable={!submitting}
        />

        <Text style={[s.label, { marginTop: space.lg }]}>有效期</Text>
        <View style={s.ttlRow}>
          {TTL_PRESETS.map((p) => (
            <Pressable
              key={p.seconds}
              style={[s.ttlChip, ttl === p.seconds && s.ttlChipActive]}
              disabled={submitting}
              onPress={() => setTtl(p.seconds)}
            >
              <Text
                style={[
                  s.ttlChipText,
                  ttl === p.seconds && { color: '#fff', fontWeight: '700' },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 图片选择 */}
      <View style={[s.card, { flex: 1 }]}>
        <View style={s.imgHeader}>
          <Text style={s.label}>
            图片 <Text style={s.labelHint}>{items.length}/{MAX_PHOTOS_PER_SHARE}</Text>
          </Text>
          <View style={{ flex: 1 }} />
          {items.length > 0 && !submitting && (
            <Pressable onPress={() => setItems([])} hitSlop={10}>
              <Text style={{ color: colors.danger, ...font.small }}>清空</Text>
            </Pressable>
          )}
        </View>

        {items.length === 0 ? (
          <Pressable style={s.dz} onPress={pickImages} disabled={submitting}>
            <Text style={s.dzIcon}>＋</Text>
            <Text style={s.dzTitle}>从相册选择图片</Text>
            <Text style={s.dzHint}>
              JPEG / PNG / WebP / HEIC · 单张 ≤ {formatBytes(MAX_FILE_SIZE)}
            </Text>
          </Pressable>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            numColumns={3}
            columnWrapperStyle={{ gap: 6 }}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListFooterComponent={
              !submitting && items.length < MAX_PHOTOS_PER_SHARE ? (
                <Pressable style={s.addThumb} onPress={pickImages}>
                  <Text style={{ fontSize: 28, color: colors.text3, fontWeight: '300' }}>＋</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={s.thumb}>
                <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {item.status === 'uploading' && (
                  <View style={s.thumbOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                {item.status === 'done' && (
                  <View style={[s.thumbOverlay, { backgroundColor: 'rgba(16,185,129,0.7)' }]}>
                    <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
                {item.status === 'error' && (
                  <View style={[s.thumbOverlay, { backgroundColor: 'rgba(239,68,68,0.75)' }]}>
                    <Text style={{ color: '#fff', fontSize: 11, textAlign: 'center', padding: 4 }} numberOfLines={3}>
                      {item.error || '失败'}
                    </Text>
                  </View>
                )}
                {item.status === 'pending' && !submitting && (
                  <Pressable
                    onPress={() => removeItem(item.id)}
                    style={s.thumbClose}
                    hitSlop={6}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>×</Text>
                  </Pressable>
                )}
              </View>
            )}
          />
        )}
      </View>

      {/* 底部行动条 */}
      <View style={s.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.bbInfo}>
            {submitting
              ? `上传中 · ${stats.done}/${stats.total}${stats.error ? ` · 失败 ${stats.error}` : ''}`
              : `${items.length} 张 · ${formatBytes(stats.totalBytes)}`}
          </Text>
          {submitting && stats.total > 0 && (
            <View style={s.bbProgressTrack}>
              <View
                style={[
                  s.bbProgressFill,
                  { width: `${Math.round((stats.done / stats.total) * 100)}%` },
                ]}
              />
            </View>
          )}
        </View>
        <Pressable
          style={[s.btn, (items.length === 0 || submitting) && { opacity: 0.5 }]}
          disabled={items.length === 0 || submitting}
          onPress={start}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>创建并上传</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const TILE_SIZE = 100;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    margin: space.md,
    marginBottom: 0,
    ...shadow.sm,
  },
  label: { ...font.smallStrong, color: colors.text2, marginBottom: 6 },
  labelHint: { ...font.caption, color: colors.text4, fontWeight: '400' },
  input: {
    height: 48,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text1,
  },
  ttlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ttlChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ttlChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ttlChipText: { ...font.small, color: colors.text2 },

  imgHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },

  dz: {
    minHeight: 200,
    backgroundColor: colors.primarySofter,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: space.lg,
  },
  dzIcon: { fontSize: 40, color: colors.primary, fontWeight: '300' },
  dzTitle: { ...font.bodyStrong, color: colors.text1 },
  dzHint: { ...font.caption, color: colors.text3, textAlign: 'center' },

  thumb: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bbInfo: { ...font.small, color: colors.text2 },
  bbProgressTrack: {
    height: 3,
    backgroundColor: colors.surfaceHover,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  bbProgressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },

  btn: {
    paddingHorizontal: space.lg,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { ...font.bodyStrong, color: '#fff' },
  btnOutline: {
    paddingHorizontal: space.lg,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { ...font.bodyStrong, color: colors.text1 },

  /* 成功页 */
  successWrap: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    padding: space.xl,
    paddingTop: space.xxl,
    alignItems: 'center',
  },
  successIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
    ...shadow.md,
  },
  successIcon: { fontSize: 36, color: '#fff', fontWeight: '700' },
  successTitle: { ...font.h1, color: colors.text1 },
  successDesc: { ...font.small, color: colors.text3, marginTop: 6, marginBottom: space.xl },
  codeBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    marginBottom: space.xl,
    ...shadow.sm,
  },
  codeBoxLabel: { ...font.eyebrow, color: colors.text3, textTransform: 'uppercase', marginBottom: 6 },
  codeBig: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 8,
  },
  codeMeta: { ...font.caption, color: colors.text3, marginTop: 8 },
});
