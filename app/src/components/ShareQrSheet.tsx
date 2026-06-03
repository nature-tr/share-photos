import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { toast } from '@/utils/toast';
import { colors, font, radius, shadow, space } from '@/theme';

interface Props {
  visible: boolean;
  code: string;
  /** 相册标题，仅作展示 */
  title?: string;
  /** 完整链接（默认 https://www.dolmo.top/v/{code}） */
  url?: string;
  onClose: () => void;
}

export default function ShareQrSheet({ visible, code, title, url, onClose }: Props) {
  const fullUrl = url || `https://www.dolmo.top/v/${code}`;
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    toast('分享码已复制');
  }
  async function copyLink() {
    await Clipboard.setStringAsync(fullUrl);
    toast('链接已复制');
  }

  async function saveToAlbum() {
    if (busy) return;
    if (!qrRef.current) {
      toast('二维码生成中，请稍后');
      return;
    }
    setBusy(true);
    try {
      // 申请相册写入权限
      const { status } = await MediaLibrary.getPermissionsAsync(true);
      if (status !== 'granted') {
        const r = await MediaLibrary.requestPermissionsAsync(true);
        if (r.status !== 'granted') {
          toast('请在系统设置中允许访问相册');
          setBusy(false);
          return;
        }
      }
      // 拿到 base64 PNG
      const base64 = await new Promise<string>((resolve, reject) => {
        qrRef.current!.toDataURL((data: string) => {
          if (!data) reject(new Error('二维码导出失败'));
          else resolve(data);
        });
      });
      const path = `${FileSystem.cacheDirectory ?? ''}qr_${code}_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await MediaLibrary.saveToLibraryAsync(path);
      FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
      toast('二维码已保存到相册');
    } catch (err) {
      toast((err as Error).message || '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />

          <Text style={s.title} numberOfLines={1}>
            {title || '分享相册'}
          </Text>
          <Text style={s.subtitle}>对方扫码即可访问，无需手动输入</Text>

          <View style={s.qrBox}>
            <QRCode
              value={fullUrl}
              size={220}
              color={colors.text1}
              backgroundColor="#fff"
              ecl="M"
              getRef={(c) => {
                qrRef.current = c as never;
              }}
            />
          </View>

          <Text style={s.codeBig}>{code}</Text>
          <Text style={s.linkText} numberOfLines={1}>
            {fullUrl}
          </Text>

          <View style={s.btnRow}>
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
              onPress={copyCode}
            >
              <Text style={s.btnText}>复制码</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
              onPress={copyLink}
            >
              <Text style={s.btnText}>复制链接</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [s.btnPrimary, (pressed || busy) && { opacity: 0.85 }]}
            disabled={busy}
            onPress={saveToAlbum}
          >
            <Text style={s.btnPrimaryText}>{busy ? '保存中…' : '保存二维码到相册'}</Text>
          </Pressable>

          <Pressable style={s.closeRow} onPress={onClose}>
            <Text style={s.closeText}>关闭</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: 10,
    paddingBottom: space.xl + 10,
    alignItems: 'center',
    ...shadow.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: space.lg,
  },
  title: { ...font.h2, color: colors.text1 },
  subtitle: { ...font.small, color: colors.text3, marginTop: 4, marginBottom: space.lg },

  qrBox: {
    padding: space.md,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  codeBig: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 6,
    marginTop: space.lg,
  },
  linkText: {
    ...font.caption,
    color: colors.text3,
    marginTop: 4,
    paddingHorizontal: space.md,
  },

  btnRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignSelf: 'stretch',
    marginTop: space.lg,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { ...font.smallStrong, color: colors.text1 },

  btnPrimary: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  btnPrimaryText: { ...font.bodyStrong, color: '#fff' },

  closeRow: { paddingTop: space.md, paddingHorizontal: space.lg },
  closeText: { ...font.small, color: colors.text3 },
});
