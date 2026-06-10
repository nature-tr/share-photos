import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { register } from '@/api/auth.api';
import { useAuth } from '@/stores/auth.store';
import AgreementCheckbox from '@/components/AgreementCheckbox';
import './index.scss';

export default function RegisterPage() {
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      Taro.showToast({ title: '请填写邮箱和密码', icon: 'none' });
      return;
    }
    if (password.length < 8) {
      Taro.showToast({ title: '密码至少 8 位', icon: 'none' });
      return;
    }
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并同意隐私政策', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const res = await register(email.trim(), password, displayName.trim() || undefined);
      if (res.data) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.refreshExpiresAt);
        Taro.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => Taro.redirectTo({ url: '/pages/index/index' }), 800);
      } else {
        Taro.showToast({ title: res.error?.message ?? '注册失败', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '注册失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-title">创建账号</Text>
        <Text className="hero-sub">开始你的相册分享之旅</Text>
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
          <Text className="label">
            密码 <Text className="label-hint">至少 8 位</Text>
          </Text>
          <Input
            className="input"
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
            placeholder="••••••••"
            password
          />
        </View>
        <View className="field">
          <Text className="label">
            昵称 <Text className="label-hint">可选</Text>
          </Text>
          <Input
            className="input"
            value={displayName}
            onInput={(e) => setDisplayName(e.detail.value)}
            placeholder="你的称呼"
            confirmType="go"
            onConfirm={onSubmit}
          />
        </View>
        <AgreementCheckbox onChange={setAgreed} />
        <View
          className={`btn ${(!email.trim() || password.length < 8 || !agreed || loading) ? 'btn-disabled' : ''}`}
          onClick={() => !loading && email.trim() && password.length >= 8 && agreed && onSubmit()}
        >
          <Text className="btn-text">{loading ? '注册中…' : '注册'}</Text>
        </View>
      </View>

      <View className="link-row">
        <Text className="link-label">已有账号？</Text>
        <Text className="link" onClick={() => Taro.redirectTo({ url: '/pages/auth/login/index' })}>
          直接登录
        </Text>
      </View>
    </View>
  );
}
