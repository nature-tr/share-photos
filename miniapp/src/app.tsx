import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    // 后台验证 token + 自动刷新
    void checkAuth();
  });

  return children;
}

export default App;
