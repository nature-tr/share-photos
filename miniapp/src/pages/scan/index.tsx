import { useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

/** 从扫码结果中提取分享码。支持纯分享码字符串和包含分享码的 URL */
function extractCode(input: string): string {
  const trimmed = input.trim();
  // 尝试按 URL 解析，取最后一段作为分享码
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[A-Za-z0-9]{4,12}$/.test(last)) return last.toUpperCase();
  } catch { /* 非 URL，按纯分享码处理 */ }
  return trimmed.toUpperCase();
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
