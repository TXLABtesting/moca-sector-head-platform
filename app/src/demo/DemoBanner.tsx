/* A clear, always-visible "Demo Environment" label for the demo branch, so no
 * one mistakes the demo for the production platform. Shows whether it is backed
 * by the shared demo database or the local-only fallback. */
import { useI18n } from '../i18n/i18n';
import { isDemoEnv, backendEnabled } from '../config/env';

export function DemoBanner() {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  if (!isDemoEnv) return null;
  return (
    <div
      role="note"
      style={{
        position: 'fixed', bottom: 12, insetInlineStart: 12, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(30,70,52,.94)', color: '#eaf1ec',
        border: '1px solid rgba(233,200,119,.5)', borderRadius: 999,
        padding: '7px 14px', fontSize: 11.5, fontWeight: 700,
        fontFamily: "'IBM Plex Sans Arabic',sans-serif",
        boxShadow: '0 8px 22px -10px rgba(0,0,0,.5)', pointerEvents: 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e9c877', flex: 'none' }} />
      {rl('بيئة تجريبية', 'Demo Environment')}
      <span style={{ opacity: .8, fontWeight: 500 }}>
        · {backendEnabled ? rl('قاعدة بيانات مشتركة', 'shared database') : rl('تخزين محلي', 'local storage')}
      </span>
    </div>
  );
}
