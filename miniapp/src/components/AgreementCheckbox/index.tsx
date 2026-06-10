/**
 * 用户协议 + 隐私政策勾选框
 *
 * 用于登录/注册页面的底部，用户勾选后方可提交表单。
 * 微信审核要求：收集用户信息前必须取得明示同意。
 */

import { useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface Props {
  onChange: (agreed: boolean) => void;
}

export default function AgreementCheckbox({ onChange }: Props) {
  const [checked, setChecked] = useState(false);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    onChange(next);
  };

  return (
    <View className="agreement-row" onClick={toggle}>
      <View className={`agreement-checkbox ${checked ? 'agreement-checkbox-on' : ''}`}>
        {checked && <Text className="agreement-checkmark">✓</Text>}
      </View>
      <Text className="agreement-text">
        我已阅读并同意{' '}
        <Text
          className="agreement-link"
          onClick={(e: any) => {
            e.stopPropagation();
            Taro.setClipboardData({ data: 'https://www.dolmo.top/privacy' });
          }}
        >
          隐私政策
        </Text>
        {' 和 '}
        <Text
          className="agreement-link"
          onClick={(e: any) => {
            e.stopPropagation();
            Taro.setClipboardData({ data: 'https://www.dolmo.top/terms' });
          }}
        >
          用户协议
        </Text>
      </Text>
    </View>
  );
}
