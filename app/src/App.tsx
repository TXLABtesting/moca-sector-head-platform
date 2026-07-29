import { useEffect } from 'react';
import { I18nProvider, useI18n } from './i18n/i18n';
import { ToastProvider } from './components/Toast';
import { NavProvider } from './store/nav';
import { Shell } from './layout/Shell';
import { useStore } from './store/store';
import { LoginScreen } from './demo/LoginScreen';
import { DemoSync } from './demo/DemoSync';

function DirSync() {
  const { lang, dir } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  return null;
}

function Gate() {
  const authUserId = useStore((s) => s.authUserId);
  return authUserId ? <Shell /> : <LoginScreen />;
}

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <NavProvider>
          <DirSync />
          <DemoSync />
          <Gate />
        </NavProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
