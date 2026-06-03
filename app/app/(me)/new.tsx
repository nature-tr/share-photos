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
import { colors, radius, space } from '@/theme';

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

      // 串行上传（移动端并发上传容易触发限流和网络抖动）
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

  // 创建成功展示
  if (created && stats.done === stats.total && stats.error === 0) {
    return (
      <View style={s.successWrap}>
        <Stack.Screen options={{ title: '已创建' }} />
        <Text style={s.successIcon}>✓</Text>
        <Text style={s.successTitle}>上传完成！</Text>
        <Text style={s.successDesc}>分享码已生成，对方扫码或输入即可访问</Text>
        <View style={s.codeBox}>
          <Text style={s.codeBig}>{created.code}</Text>
          <Text style={s.codeMeta}>
            {stats.done} 张 · {formatBytes(stats.totalBytes)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Pressable
            style={[s.btn, { flex: 1 }]}
            onPress={() => router.replace({ pathname: '/viewer/[code]', params: { code: created.code } })}
          >
            <Text style={s.btnText}>查看相册</Text>
          </Pressable>
          <Pressable
            style={[s.btnOutline, { flex: 1 }]}
            onPress={() => router.replace('/(me)/shares')}
          >
            <Text style={s.btnOutlineText}>我的分享</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: '新建分享' }} />

      <View style={s.card}>
        <Text style={s.label}>相册标题（可选）</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="例如：周末聚会"
          placeholderTextColor={colors.text3}
          style={s.input}
          editable={!submitting}
        />

        <Text style={[s.label, { marginTop: space.md }]}>有效期</Text>
        <View style={s.ttlRow}>
          {TTL_PRESETS.map((p) => (
            <Pressable
              key={p.seconds}
              style={[s.ttlChip, ttl === p.seconds && s.ttlChipActive]}
              disabled={submitting}
              onPress={() => setTtl(p.seconds)}
            >
              <Text
                style={[s.ttlChipText, ttl === p.seconds && { color: '#fff' }]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[s.card, { flex: 1 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
          <Text style={s.label}>
            图片 ({items.length}/{MAX_PHOTOS_PER_SHARE})
          </Text>
          <View style={{ flex: 1 }} />
          {items.length > 0 && !submitting && (
            <Pressable onPress={() => setItems([])} hitSlop={10}>
              <Text style={{ color: colors.danger, fontSize: 13 }}>清空</Text>
            </Pressable>
          )}
        </View>

        {items.length === 0 ? (
          <Pressable style={s.dz} onPress={pickImages} disabled={submitting}>
            <Text style={s.dzIcon}>＋</Text>
            <Text style={s.dzTitle}>从相册选择图片</Text>
            <Text style={s.dzHint}>
              JPEG / PNG / WebP / HEIC · 单文件 ≤ {formatBytes(MAX_FILE_SIZE)}
            </Text>
          </Pressable>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            numColumns={3}
            columnWrapperStyle={{ gap: 4 }}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            ListFooterComponent={
              !submitting && items.length < MAX_PHOTOS_PER_SHARE ? (
                <Pressable style={s.addThumb} onPress={pickImages}>
                  <Text style={{ fontSize: 32, color: colors.text3 }}>＋</Text>
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
                  <View style={[s.thumbOverlay, { backgroundColor: 'rgba(16,185,129,0.65)' }]}>
                    <Text style={{ color: '#fff', fontSize: 22 }}>✓</Text>
                  </View>
                )}
                {item.status === 'error' && (
                  <View style={[s.thumbOverlay, { backgroundColor: 'rgba(239,68,68,0.7)' }]}>
                    <Text style={{ color: '#fff', fontSize: 11 }} numberOfLines={2}>
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
                    <Text style={{ color: '#fff', fontSize: 12 }}>×</Text>
                  </Pressable>
                )}
              </View>
            )}
          />
        )}
      </View>

      <View style={s.bottomBar}>
        <Text style={s.bbInfo}>
          {submitting
            ? `上传中 · ${stats.done}/${stats.total}${stats.error ? ` · 失败 ${stats.error}` : ''}`
            : `${items.length} 张 · ${formatBytes(stats.totalBytes)}`}
        </Text>
        <Pressable
          style={[s.btn, items.length === 0 && { opacity: 0.4 }]}
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
    borderRadius: radius.lg,
    padding: space.md,
    margin: space.md,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  label: { fontSize: 13, color: colors.text2, fontWeight: '500', marginBottom: 6 },
  input: {
    height: 44,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.text1,
  },
  ttlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ttlChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ttlChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ttlChipText: { fontSize: 13, color: colors.text2 },

  dz: {
    minHeight: 200,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: space.lg,
  },
  dzIcon: { fontSize: 36, color: colors.primary, fontWeight: '300' },
  dzTitle: { fontSize: 15, fontWeight: '600', color: colors.text1 },
  dzHint: { fontSize: 12, color: colors.text3, textAlign: 'center' },

  thumb: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  thumbClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  bbInfo: { flex: 1, fontSize: 13, color: colors.text2 },
  btn: {
    paddingHorizontal: space.xl,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  btnOutline: {
    paddingHorizontal: space.xl,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { color: colors.text1, fontWeight: '600' },

  successWrap: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    padding: space.xl,
    paddingTop: space.xxl + 12,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 36,
    color: '#fff',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: space.md,
  },
  successTitle: { fontSize: 22, fontWeight: '700', color: colors.text1 },
  successDesc: { fontSize: 13, color: colors.text3, marginTop: 4, marginBottom: space.xl },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    marginBottom: space.xl,
  },
  codeBig: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 8,
  },
  codeMeta: { fontSize: 12, color: colors.text3, marginTop: 4 },
});
