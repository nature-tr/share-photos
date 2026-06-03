import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '@/theme';

const CODE_RE = /[A-Z0-9]{8}/;

function extractCode(raw: string): string | null {
  const m = raw.match(/\/v\/([A-Z0-9]{8})/i);
  if (m) return m[1]!.toUpperCase();
  const m2 = raw.match(CODE_RE);
  if (m2) return m2[0]!.toUpperCase();
  return null;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lastRef = useRef('');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  function onScanned(data: string) {
    if (scanned || data === lastRef.current) return;
    lastRef.current = data;
    const code = extractCode(data);
    if (!code) return;
    setScanned(true);
    router.replace({ pathname: '/viewer/[code]', params: { code } });
  }

  if (!permission) {
    return (
      <View style={s.center}>
        <Text style={s.tip}>正在请求相机权限…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={s.center} edges={['top', 'bottom']}>
        <Pressable style={s.closeBtn} onPress={() => router.back()} hitSlop={10}>
          <Text style={s.closeText}>取消</Text>
        </Pressable>
        <Text style={s.bigEmoji}>📷</Text>
        <Text style={s.cTitle}>需要相机权限</Text>
        <Text style={s.cDesc}>授权后即可扫描分享码二维码</Text>
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
          onPress={() => requestPermission()}
        >
          <Text style={s.btnText}>开启相机</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScanned(data)}
      />
      <SafeAreaView style={s.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={s.topBar} pointerEvents="box-none">
          <Pressable style={s.closeBtnDark} onPress={() => router.back()} hitSlop={10}>
            <Text style={s.closeTextLight}>关闭</Text>
          </Pressable>
          <Text style={s.topTitle}>扫一扫</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.frameWrap} pointerEvents="none">
          <View style={s.frame}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </View>
          <Text style={s.hint}>把分享码二维码放进框内</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.sm,
    backgroundColor: colors.surfaceSoft,
  },
  bigEmoji: { fontSize: 56, marginBottom: space.md },
  cTitle: { ...font.h2, color: colors.text1 },
  cDesc: { ...font.small, color: colors.text3, marginBottom: space.lg },
  tip: { ...font.body, color: colors.text2 },
  btn: {
    paddingHorizontal: space.xl,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { ...font.bodyStrong, color: '#fff' },
  closeBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeText: { ...font.smallStrong, color: colors.text2 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  closeBtnDark: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.full,
  },
  closeTextLight: { ...font.smallStrong, color: '#fff' },
  topTitle: { ...font.bodyStrong, color: '#fff' },

  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 4 },
  hint: {
    marginTop: space.xl,
    color: '#fff',
    ...font.small,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
