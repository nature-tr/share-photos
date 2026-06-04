import { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface Props {
  visible: boolean;
  code: string;
  title?: string;
  url?: string;
  onClose: () => void;
}

/** 用 quickchart.io 生成二维码图 URL */
function qrUrl(text: string, size = 280) {
  const encoded = encodeURIComponent(text);
  return `https://quickchart.io/qr?text=${encoded}&size=${size}&margin=2&ecLevel=M`;
}

export default function QrSheet({ visible, code, title, url, onClose }: Props) {
  const fullUrl = url || `https://www.dolmo.top/v/${code}`;
  const [saving, setSaving] = useState(false);

  function copyCode() {
    Taro.setClipboardData({ data: code });
    Taro.showToast({ title: '分享码已复制', icon: 'none' });
  }
  function copyLink() {
    Taro.setClipboardData({ data: fullUrl });
    Taro.showToast({ title: '链接已复制', icon: 'none' });
  }

  async function saveToAlbum() {
    setSaving(true);
    try {
      // 1. 下载二维码图片
      const downloadRes = await Taro.downloadFile({ url: qrUrl(fullUrl) });
      if (downloadRes.statusCode !== 200) throw new Error('二维码下载失败');
      // 2. 保存到相册
      await Taro.saveImageToPhotosAlbum({ filePath: downloadRes.tempFilePath });
      Taro.showToast({ title: '二维码已保存到相册', icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('auth deny') || e?.errMsg?.includes('deny')) {
        Taro.showToast({ title: '请在设置中允许保存到相册', icon: 'none' });
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      }
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <View className="qr-backdrop" onClick={onClose}>
      <View className="qr-sheet" onClick={(e: any) => e.stopPropagation()}>
        {/* 拖拽条 */}
        <View className="qr-handle" />

        <Text className="qr-title" numberOfLines={1}>
          {title || '分享相册'}
        </Text>
        <Text className="qr-subtitle">对方扫码即可访问，无需手动输入</Text>

        {/* 二维码图片 */}
        <View className="qr-img-box">
          <Image
            src={qrUrl(fullUrl)}
            className="qr-img"
            mode="aspectFit"
          />
        </View>

        <Text className="qr-code-big">{code}</Text>
        <Text className="qr-link" numberOfLines={1}>{fullUrl}</Text>

        {/* 操作按钮 */}
        <View className="qr-btn-row">
          <View className="qr-btn" onClick={copyCode}>
            <Text className="qr-btn-text">复制码</Text>
          </View>
          <View className="qr-btn" onClick={copyLink}>
            <Text className="qr-btn-text">复制链接</Text>
          </View>
        </View>

        <View className="qr-btn-primary" onClick={saveToAlbum}>
          <Text className="qr-btn-primary-text">
            {saving ? '保存中…' : '保存二维码到相册'}
          </Text>
        </View>

        <View className="qr-close" onClick={onClose}>
          <Text className="qr-close-text">关闭</Text>
        </View>
      </View>
    </View>
  );
}
