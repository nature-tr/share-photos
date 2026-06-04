import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    // 启动时尝试恢复登录态（如本地有 token 则验证）
    checkAuth();
  });

  return children;
}

export default App;
