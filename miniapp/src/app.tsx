import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAuth } from '@/stores/auth.store';
import PrivacyConsent from '@/components/PrivacyConsent';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const checkAuth = useAuth((s) => s.checkAuth);

  useLaunch(() => {
    void checkAuth();
  });

  return (
    <>
      {children}
      <PrivacyConsent />
    </>
  );
}

export default App;
