/**
 * 隐私协议同意弹窗
 *
 * 关键：onNeedPrivacyAuthorization 必须在 chooseMedia 被调用前完成注册，
 * React 的 useEffect 是异步的，太晚。这里把监听器注册放到模块顶层同步执行。
 */

import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './index.scss';

/* ───── 模块顶层：同步注册隐私监听，早于任何 API 调用 ───── */

let resolveRef: ((res: { event: string }) => void) | null = null;
let showFn: ((v: boolean) => void) | null = null;

function getWx(): any {
  try { return (globalThis as any).wx || (Taro as any).apiready; } catch { return (Taro as any); }
}

const wxNative = getWx();

if (typeof wxNative?.onNeedPrivacyAuthorization === 'function') {
  wxNative.onNeedPrivacyAuthorization((resolve: (res: { event: string }) => void) => {
    resolveRef = resolve;
    showFn?.(true);
  });
}

/* ───── 组件 ───── */

export default function PrivacyConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showFn = setVisible;
    return () => { showFn = null; };
  }, []);

  const handleAgree = () => {
    if (resolveRef) {
      resolveRef({ event: 'agree', buttonId: 'agree' });
      resolveRef = null;
    }
    try { Taro.setStorageSync('privacy_agreed_v3', true); } catch { /* */ }
    setVisible(false);
    Taro.showToast({ title: '授权成功，请继续操作', icon: 'success', duration: 2000 });
  };

  const handleDisagree = () => {
    if (resolveRef) {
      resolveRef({ event: 'disagree', buttonId: 'disagree' });
      resolveRef = null;
    }
    setVisible(false);
    Taro.showToast({ title: '需同意隐私指引才能使用选图功能', icon: 'none', duration: 2500 });
  };

  if (!visible) return null;

  return (
    <View className="privacy-overlay">
      <View className="privacy-card">
        <Text className="privacy-title">隐私保护指引</Text>
        <View className="privacy-content-scroll">
          <Text className="privacy-content">
感谢您使用格子橱窗。我们深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。

本指引将帮助您了解以下内容：

1. 我们收集的信息
    - 账号信息（邮箱、昵称）：创建和管理您的账户
    - 上传的图片：存储在您创建的分享相册中，到期自动删除

2. 权限申请
    - 相册（读取）：从手机相册选择图片上传到分享
    - 相册（写入）：将网络图片保存到您的手机相册
    这些权限仅在您主动使用时请求，不会后台获取。

3. 信息安全
    我们采取加密传输等措施保护您的数据，不会共享给任何第三方。

点击「同意」即表示您已阅读并同意以上条款。
          </Text>
        </View>
        <View className="privacy-links">
          <Text className="privacy-link" onClick={() => Taro.navigateTo({ url: '/pages/me/privacy/index' })}>隐私政策</Text>
          <Text className="privacy-link-sep">|</Text>
          <Text className="privacy-link" onClick={() => Taro.navigateTo({ url: '/pages/me/terms/index' })}>用户协议</Text>
        </View>
        <View className="privacy-buttons">
          <View className="privacy-btn privacy-btn-reject" onClick={handleDisagree}>
            <Text className="privacy-btn-text">拒绝</Text>
          </View>
          <View className="privacy-btn privacy-btn-agree" onClick={handleAgree}>
            <Text className="privacy-btn-text">同意</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
