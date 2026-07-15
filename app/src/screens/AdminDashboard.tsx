import { Fade } from '../components/ui';
import { Icon } from '../components/Icon';
import { DemoHint } from '../components/DemoHint';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { ACTIONS, SECTIONS, TYPES, SCOPES, type SeedUser } from '../domain/permissions';
import { initials } from '../shared/helpers';
import { AV } from '../shared/constants';

function avColor(name: string): [string, string] {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV[h % AV.length] as [string, string];
}

/** System-admin home: who exists, what role and scope each person has,
 *  and quick entry points into user/role/permission management. */
export function AdminDashboard() {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const L = lang === 'en';
  const { goto } = useNav();
  const users = useStore((s) => s.users);

  const grantCount = (u: SeedUser) => (u.type === 'chair' || u.all)
    ? SECTIONS.length * ACTIONS.length
    : Object.values(u.g || {}).reduce((n, letters) => n + letters.length, 0);

  const scopeName = (v: string) => { const s = SCOPES.find((x) => x.v === v); return s ? (L ? s.en : s.ar) : v; };

  const kpis = [
    { label: rl('المستخدمون', 'Users'), value: users.length, icon: 'team', accent: '#2b5c44', bg: '#e9f0ec' },
    { label: rl('الأدوار', 'Roles'), value: TYPES.length, icon: 'crown', accent: '#a9791f', bg: '#fbf0d6' },
    { label: rl('الأقسام المُدارة', 'Managed sections'), value: SECTIONS.length, icon: 'list', accent: '#3a6ea5', bg: '#e6eef6' },
    { label: rl('نطاقات الوصول', 'Access scopes'), value: SCOPES.length, icon: 'shield', accent: '#7a4d94', bg: '#f3ecf6' },
  ];

  const actionBtn = (label: string, tab: string, primary = false) => (
    <button onClick={() => goto('settings', { adminTab: tab })} style={{
      display: 'flex', alignItems: 'center', gap: 7, borderRadius: 11, padding: '10px 16px',
      fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
      background: primary ? '#1e4634' : '#fff', color: primary ? '#fff' : '#1e4634',
      border: primary ? 'none' : '1px solid #cdd8ce',
    }}>{label}</button>
  );

  return (
    <Fade style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('مرحباً، مدير النظام', 'Welcome, System Admin')}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('إدارة المستخدمين والأدوار والنطاقات والأقسام الظاهرة لكل شخص.', 'Manage users, roles, scopes, and the sections each person can see.')}</p>
      </div>
      <DemoHint />

      <div className="rg4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="glass" style={{ borderRadius: 16, padding: '16px 17px', boxShadow: '0 1px 2px rgba(23,40,32,.04),0 14px 34px -18px rgba(20,45,32,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.accent }}><Icon name={k.icon} size={19} /></span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: k.accent }}>{k.value}</span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('المستخدمون ونطاقاتهم', 'Users & their scopes')}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {actionBtn(rl('إدارة المستخدمين', 'Manage users'), 'users', true)}
              {actionBtn(rl('مصفوفة الصلاحيات', 'Permission matrix'), 'sections')}
            </div>
          </div>
          {users.map((u) => {
            const tp = TYPES.find((t) => t.id === u.type) || TYPES[0];
            const [avBg, avFg] = avColor(u.name);
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderBottom: '1px solid #f4f6f3' }}>
                {u.img
                  ? <img src={'/' + u.img} alt={u.name} style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }} />
                  : <span style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: avBg, color: avFg }}>{initials(u.name)}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#9aa39b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scopeName(u.scope)}</div>
                </div>
                <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: tp.bg, color: tp.fg }}><Icon name={tp.icon} size={12} />{L ? tp.en : tp.ar}</span>
                <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: '#2b5c44', minWidth: 34, textAlign: 'center' }}>{grantCount(u)}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 8, textAlign: 'end' }}>{rl('الرقم = عدد الصلاحيات الممنوحة', 'Number = granted permissions count')}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('توزيع الأدوار', 'Role distribution')}</h3>
            {TYPES.map((tp) => (
              <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid #f4f6f3' }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tp.bg, color: tp.fg }}><Icon name={tp.icon} size={16} /></span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: '#17211c' }}>{L ? tp.en : tp.ar}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: tp.fg }}>{users.filter((u) => u.type === tp.id).length}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'linear-gradient(160deg,#1e4634,#17372a)', borderRadius: 20, boxShadow: '0 14px 34px -16px rgba(20,45,32,.5)', padding: '20px 22px', color: '#fff' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14.5, fontWeight: 700 }}>{rl('قاعدة الاعتماد', 'Approval rule')}</h3>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: 'rgba(255,255,255,.85)' }}>
              {rl('الاعتماد النهائي يبقى دائماً بيد رئيس القطاع ولا يُمنح لأي عضو تلقائياً. مدير النظام يدير الوصول فقط ولا يعتمد البنود التنفيذية.',
                  'Final approval always remains with the Sector Head and is never auto-granted to any member. The system admin manages access only and does not approve executive items.')}
            </p>
          </div>
        </div>
      </div>
    </Fade>
  );
}
