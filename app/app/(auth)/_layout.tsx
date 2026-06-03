import { Slot } from 'expo-router';

/**
 * (auth) 分组无额外逻辑，由 root Stack 统一管理 header；这里仅透传子路由。
 */
export default function AuthLayout() {
  return <Slot />;
}
