import { useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';

/** Dismissible strip that explains the current stakeholder's view — makes the
 *  member → chief → admin communication loop obvious in management demos. */
export function DemoHint() {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const key = 'moca.demoHint.' + cu.type;
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
  });
  if (hidden) return null;

  const text = cu.type === 'chair'
    ? rl('هذه اللوحة تجمع كل ما يرفعه فريق المكتب: اعتمدي البند أو أرجعيه للتعديل أو وجّهي — وتصل النتيجة فوراً إلى لوحة العضو المسؤول.',
        'This board gathers everything your office team submits: approve, return for edit, or direct — and the outcome instantly reaches the responsible member’s board.')
    : cu.type === 'sysadmin'
      ? rl('مدير النظام يدير المستخدمين والأدوار والنطاقات والأقسام الظاهرة لكل شخص — من شاشة الإعدادات والصلاحيات.',
          'The system admin manages users, roles, scopes, and the sections each person can see — from Settings & Roles.')
      : rl('ما تضيفه هنا وترسله للمراجعة يظهر مباشرة في لوحة رئيس القطاع، وما يعتمده أو يرجعه رئيس القطاع يظهر لك هنا.',
          'Whatever you add and send for review appears directly on the Sector Head’s board, and the Sector Head’s decisions come back to you here.');

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: '#eef6f0', border: '1px solid #d6e8dd', borderRadius: 14, padding: '12px 15px', marginBottom: 16 }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1f8a5b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#3f6a54', lineHeight: 1.7 }}>
        {text}{' '}
        <b>{rl('بدّل المستخدم من الزر أعلى الصفحة لرؤية المنصة بعين كل دور.', 'Switch the user from the header button to see the platform through each role.')}</b>
      </div>
      <button onClick={() => { setHidden(true); try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } }} aria-label={rl('إغلاق', 'Close')} style={{ flex: 'none', width: 24, height: 24, border: 'none', background: 'transparent', color: '#7ba28c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}
