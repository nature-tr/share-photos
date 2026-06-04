import { useState } from 'react';
import { View, Text, Input, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import { colors, font, space, radius } from '@/theme';
import logoImg from '../../assets/logo.png';
import './index.scss';

export default function IndexPage() {
  const user = useAuth((s) => s.user);
  const [code, setCode] = useState('');

  function go() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    Taro.navigateTo({ url: `/pages/viewer/detail/index?code=${c}` });
  }

  function gotoScan() {
    Taro.navigateTo({ url: '/pages/scan/index' });
  }

  return (
    <View className="page-root">
      {/* 品牌区 */}
      <View className="brand-section">
        <View className="logo-box">
          <Image src={logoImg} className="logo-img" mode="aspectFit" />
        </View>
        <Text className="app-title">Dolmo Photo</Text>
        <Text className="app-subtitle">限时分享相册 · 一键存到手机相册</Text>
      </View>

      {/* 输入分享码 */}
      <View className="card">
        <Text className="card-label">输入分享码</Text>
        <Input
          className="code-input"
          value={code}
          onInput={(e) => setCode(e.detail.value.toUpperCase())}
          placeholder="ABCD1234"
          maxlength={8}
          confirmType="go"
          onConfirm={go}
        />
        <Button className="btn-primary" onClick={go} disabled={!code.trim()}>
          查看相册
        </Button>
      </View>

      {/* 操作入口 */}
      <Text className="section-label">更多操作</Text>

      <View className="action-card" onClick={gotoScan}>
        <View className="action-icon action-icon-blue">
          <Text className="action-icon-text">⌒</Text>
        </View>
        <View className="action-body">
          <Text className="action-title">扫一扫</Text>
          <Text className="action-desc">扫描分享码二维码进入</Text>
        </View>
        <Text className="action-arrow">›</Text>
      </View>

      <View className="action-card" onClick={() => {
        if (user) Taro.navigateTo({ url: '/pages/me/new/index' });
        else Taro.navigateTo({ url: '/pages/auth/login/index' });
      }}>
        <View className="action-icon action-icon-green">
          <Text className="action-icon-text">↑</Text>
        </View>
        <View className="action-body">
          <Text className="action-title">分享图片</Text>
          <Text className="action-desc">
            {user ? '从相册选图，生成分享码与二维码' : '需要先登录账号'}
          </Text>
        </View>
        <Text className="action-arrow">›</Text>
      </View>

      {user && (
        <View className="action-card" onClick={() => Taro.switchTab({ url: '/pages/me/shares/index' })}>
          <View className="action-icon action-icon-gray">
            <Text className="action-icon-text">≡</Text>
          </View>
          <View className="action-body">
            <Text className="action-title">我的分享</Text>
            <Text className="action-desc">查看、续期或结束已创建的分享</Text>
          </View>
          <Text className="action-arrow">›</Text>
        </View>
      )}

      <View style={{ height: '64rpx' }} />
      <Text style={{ textAlign: 'center', fontSize: '20rpx', color: colors.text4 }}>
        Dolmo Photo · v0.1
      </Text>
    </View>
  );
}
