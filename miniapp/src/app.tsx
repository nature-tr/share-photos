import { PropsWithChildren } from 'react';
import { View } from '@tarojs/components';
import { useLaunch } from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import GlobalProgress from '@/components/GlobalProgress';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    void checkAuth();
  });

  return (
    <View>
      {children}
      <GlobalProgress />
    </View>
  );
}

export default App;
