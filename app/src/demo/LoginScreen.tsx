import { useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/i18n';
import { DEMO_CREDENTIALS } from './auth';

/* Demo sign-in gate. Client-side only (GitHub Pages) — see auth.ts. */
export function LoginScreen() {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const login = useStore((s) => s.login);
  const users = useStore((s) => s.users);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showCreds, setShowCreds] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(username, password);
    if (!ok) setError(true);
  };

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', border: '1px solid #d9e2dc', background: '#f7faf8',
    borderRadius: 12, padding: '13px 15px', fontSize: 14, fontFamily: 'inherit', color: '#17211c', outline: 'none',
  };
  const nameOf = (uid: string) => users.find((u) => u.id === uid)?.name || uid;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'linear-gradient(150deg,#0f2419,#1f4a37 55%,#2b5c44)', fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, boxShadow: '0 30px 80px -30px rgba(0,0,0,.5)', padding: '34px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ width: 48, height: 48, flex: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#1f4a37,#2b5c44)', color: '#e9c877', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M6 21V9l6-4 6 4v12M10 21v-5h4v5" /></svg>
          </span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#17211c' }}>{rl('منصة متابعة رئيس القطاع', 'Sector Head Platform')}</div>
            <div style={{ fontSize: 11.5, color: '#7d867f' }}>{rl('مكتب رئيس قطاع الخدمات المركزية', 'Central Services Sector Head Office')}</div>
          </div>
        </div>
        <p style={{ margin: '14px 0 20px', fontSize: 13, color: '#5b6b62', lineHeight: 1.6 }}>
          {rl('سجّل الدخول للوصول إلى مساحتك الخاصة وإضافة تحديثاتك.', 'Sign in to reach your own workspace and add your updates.')}
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#5b6b62', marginBottom: 6 }}>{rl('اسم المستخدم', 'Username')}</label>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setError(false); }} autoFocus autoComplete="username"
              placeholder={rl('مثال: samah.abusharkh', 'e.g. samah.abusharkh')} style={field} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#5b6b62', marginBottom: 6 }}>{rl('كلمة المرور', 'Password')}</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(false); }} autoComplete="current-password" style={field} />
          </div>
          {error && (
            <div style={{ fontSize: 12.5, color: '#b0433b', background: '#fdf3f2', border: '1px solid #f3d9d6', borderRadius: 10, padding: '9px 12px' }}>
              {rl('اسم المستخدم أو كلمة المرور غير صحيحة.', 'Incorrect username or password.')}
            </div>
          )}
          <button type="submit" style={{ marginTop: 4, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
            {rl('تسجيل الدخول', 'Sign in')}
          </button>
        </form>

        <div style={{ marginTop: 20, borderTop: '1px dashed #e2e8e3', paddingTop: 14 }}>
          <button onClick={() => setShowCreds((v) => !v)} style={{ background: 'transparent', border: 'none', color: '#2b5c44', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: showCreds ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="m9 18 6-6-6-6" /></svg>
            {rl('حسابات العرض التجريبي', 'Demo accounts')}
          </button>
          {showCreds && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {DEMO_CREDENTIALS.map((c) => (
                <button key={c.username} type="button" onClick={() => { setUsername(c.username); setPassword(c.password); setError(false); }}
                  style={{ textAlign: 'start', background: '#f7faf8', border: '1px solid #e2e8e3', borderRadius: 10, padding: '8px 11px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#17211c' }}>{nameOf(c.userId)}</span>
                  <span style={{ fontSize: 10.5, color: '#7d867f', fontFamily: 'ui-monospace,monospace' }}>{c.username} · {c.password}</span>
                </button>
              ))}
              <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2, lineHeight: 1.6 }}>
                {rl('اضغط على أي حساب لتعبئة الحقول تلقائياً. (بيانات عرض فقط — تُستبدل بتسجيل الدخول المؤسسي في نسخة الإنتاج.)',
                    'Click any account to auto-fill. (Demo only — replaced by enterprise SSO in production.)')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
