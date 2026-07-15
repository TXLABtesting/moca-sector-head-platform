import { useEffect } from 'react';
import { I18nProvider, useI18n } from './i18n/i18n';
import { ToastProvider } from './components/Toast';
import { NavProvider } from './store/nav';
import { Shell } from './layout/Shell';

function DirSync() {
  const { lang, dir } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  return null;
}

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <NavProvider>
          <DirSync />
          <Shell />
        </NavProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
