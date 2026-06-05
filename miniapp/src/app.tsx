import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAuth, tryRestoreSession } from '@/stores/auth.store';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    // 1. 立即从 storage 恢复登录态（同步，不阻塞渲染）
    const { user, token } = tryRestoreSession();
    if (user && token) {
      useAuth.setState({ user, accessToken: token });
    }
    // 2. 后台静默验证（过期则自动刷新，失败才退出）
    void checkAuth();
  });

  return children;
}

export default App;
