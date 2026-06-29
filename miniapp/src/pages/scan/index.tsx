import { useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { SHARE_CODE_REGEX } from '@photo/shared';
import './index.scss';

/**
 * 从扫码结果中提取分享码。
 * 小程序不支持 new URL()，所以用纯字符串解析。
 *
 * 支持的输入格式：
 *   - 纯分享码：ABCD1234
 *   - Web 生成的完整 URL：https://www.dolmo.top/v/ABCD1234
 *   - 文本中含分享码：扫描结果：ABCD1234
 */
function extractCode(input: string): string {
  const s = input.trim().toUpperCase();

  // 直接命中分享码格式
  if (SHARE_CODE_REGEX.test(s)) return s;

  // 从 URL 路径中提取：取最后一个 / 之后的段
  // 例如 https://www.dolmo.top/v/ABCD1234 → ABCD1234
  const lastSlash = s.lastIndexOf('/');
  if (lastSlash >= 0) {
    const after = s.slice(lastSlash + 1);
    // 去掉可能的 query string / hash
    const clean = after.split(/[?#]/)[0]!.toUpperCase();
    if (SHARE_CODE_REGEX.test(clean)) return clean;
  }

  // 在整段文本中搜索符合分享码格式的子串
  const match = s.match(SHARE_CODE_REGEX);
  if (match) return match[0]!;

  // 什么都匹配不到，原样返回让 viewer 报 "没有该分享"
  return s;
}

export default function ScanPage() {
  useEffect(() => {
    // 页面加载后立即唤起扫码
    Taro.scanCode({ onlyFromCamera: true }).then((res) => {
      if (res.result) {
        const code = extractCode(res.result);
        Taro.redirectTo({ url: `/pages/viewer/detail/index?code=${code}` });
      } else {
        Taro.navigateBack();
      }
    }).catch(() => {
      Taro.navigateBack();
    });
  }, []);

  return (
    <View className="page">
      <View className="center">
        <Text className="emoji">📷</Text>
        <View className="title-row">
          <Text className="title">正在打开相机</Text>
          <Text className="sub">对准分享码二维码即可自动扫描</Text>
        </View>
        <Text className="cancel" onClick={() => Taro.navigateBack()}>取消</Text>
      </View>
    </View>
  );
}
