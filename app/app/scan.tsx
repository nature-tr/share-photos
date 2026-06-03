import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme';

/** 8 位字母数字分享码 */
const CODE_RE = /[A-Z0-9]{8}/;

/** 从扫到的字符串里抽出 8 位分享码（兼容直接二维码内容是 https://.../v/CODE） */
function extractCode(raw: string): string | null {
  // URL 形式
  const m = raw.match(/\/v\/([A-Z0-9]{8})/i);
  if (m) return m[1]!.toUpperCase();
  // 纯码
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
    if (!code) return; // 不是合法码，继续扫
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
      <View style={s.center}>
        <Text style={s.tip}>需要相机权限才能扫码</Text>
        <Pressable style={s.btn} onPress={() => requestPermission()}>
          <Text style={s.btnText}>授权相机</Text>
        </Pressable>
      </View>
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
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame} />
        <Text style={s.hint}>把分享码二维码放进框内</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.lg },
  tip: { color: colors.text2, fontSize: 14 },
  btn: {
    paddingHorizontal: space.xl,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  btnText: { color: '#fff', fontWeight: '600' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: space.lg,
    color: '#fff',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
