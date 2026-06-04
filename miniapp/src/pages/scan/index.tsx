import { useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export default function ScanPage() {
  useEffect(() => {
    // 页面加载后立即唤起扫码
    Taro.scanCode({ onlyFromCamera: true }).then((res) => {
      if (res.result) {
        Taro.redirectTo({ url: `/pages/viewer/detail/index?code=${res.result.toUpperCase()}` });
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
        <Text className="title">正在打开相机</Text>
        <Text className="sub">对准分享码二维码即可自动扫描</Text>
        <Text className="cancel" onClick={() => Taro.navigateBack()}>取消</Text>
      </View>
    </View>
  );
}
