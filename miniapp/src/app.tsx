import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import GlobalProgress from '@/components/GlobalProgress';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    void checkAuth();
  });

  return children;
}

export default App;
