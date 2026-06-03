import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

/**
 * 二级页面通用返回按钮（用于 Stack.screenOptions.headerLeft）。
 *
 * 与 viewer 详情页的自定义 nav 风格一致：圆形浅灰底 + ‹ 字符。
 *
 * - 顶层 Stack 还能 back（如从首页 push 进来）→ router.back()
 * - 否则（深链接直达）→ replace 回首页
 */
export default function HeaderBackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
      hitSlop={10}
    >
      <Text style={s.text}>‹</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  text: {
    fontSize: 24,
    color: colors.text1,
    lineHeight: 26,
    fontWeight: '300',
    marginLeft: -2,
  },
});
