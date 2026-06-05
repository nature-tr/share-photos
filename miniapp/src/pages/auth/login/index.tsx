import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { login } from '@/api/auth.api';
import { useAuth } from '@/stores/auth.store';
import './index.scss';

export default function LoginPage() {
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      Taro.showToast({ title: '请填写完整', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.data) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.refreshExpiresAt);
        Taro.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => Taro.redirectTo({ url: '/pages/index/index' }), 800);
      } else {
        Taro.showToast({ title: res.error?.message ?? '登录失败', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-title">欢迎回来</Text>
        <Text className="hero-sub">登录后管理你的分享相册</Text>
      </View>

      <View className="card">
        <View className="field">
          <Text className="label">邮箱</Text>
          <Input
            className="input"
            value={email}
            onInput={(e) => setEmail(e.detail.value)}
            placeholder="you@example.com"
            type="text"
          />
        </View>
        <View className="field">
          <Text className="label">密码</Text>
          <Input
            className="input"
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
            placeholder="••••••••"
            password
            confirmType="go"
            onConfirm={onSubmit}
          />
        </View>
        <View
          className={`btn ${(!email.trim() || !password || loading) ? 'btn-disabled' : ''}`}
          onClick={() => !loading && email.trim() && password && onSubmit()}
        >
          <Text className="btn-text">{loading ? '登录中…' : '登录'}</Text>
        </View>
      </View>

      <View className="link-row">
        <Text className="link-label">没有账号？</Text>
        <Text className="link" onClick={() => Taro.redirectTo({ url: '/pages/auth/register/index' })}>
          立即注册
        </Text>
      </View>
    </View>
  );
}
