import { useState } from 'react';
import { Fade } from '../components/ui';
import { Icon } from '../components/Icon';
import { Dropdown } from '../components/Dropdown';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { ACTIONS, SECTIONS, TYPES, SCOPES, SEED_USERS, effectivePerms, type SeedUser, type ActionKey } from '../domain/permissions';
import { initials } from '../shared/helpers';
import { AV } from '../shared/constants';

type Tab = 'users' | 'types' | 'sections' | 'extra' | 'log';

interface PermLogEntry { user: string; section: string; change: string; at: string }
// session-only log (matches the prototype's _permLog, which resets on reload)
const permLog: PermLogEntry[] = [];

function avColor(name: string): [string, string] {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV[h % AV.length] as [string, string];
}

export function Settings() {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const L = lang === 'en';
  const users = useStore((s) => s.users);
  const setUsers = useStore((s) => s.setUsers);
  const { showToast } = useToast();
  const { params } = useNav();
  const [tab, setTab] = useState<Tab>(() => {
    const p = params.adminTab as Tab | undefined;
    return p && ['users', 'types', 'sections', 'extra', 'log'].includes(p) ? p : 'users';
  });
  const [permUser, setPermUser] = useState('moza');
  const [, force] = useState(0);

  const typeObj = (id: string) => TYPES.find((t) => t.id === id) || TYPES[0];
  const grantCount = (u: SeedUser) => {
    if (u.type === 'chair' || u.all) return SECTIONS.length * ACTIONS.length;
    return Object.values(u.g || {}).reduce((n, letters) => n + letters.length, 0);
  };

  const setType = (id: string, type: string) => { setUsers((us) => { const u = us.find((x) => x.id === id); if (u) u.type = type as SeedUser['type']; }); };
  const setScope = (id: string, scope: string) => { setUsers((us) => { const u = us.find((x) => x.id === id); if (u) u.scope = scope; }); };

  const toggle = (u: SeedUser, section: string, action: ActionKey) => {
    if (u.type === 'chair') { showToast(rl('رئيس القطاع يملك صلاحية كاملة دائماً — غير قابلة للتعديل', 'Sector Head always has full access')); return; }
    const letter = ACTIONS.find((a) => a.k === action)!.letter;
    setUsers((us) => {
      const uu = us.find((x) => x.id === u.id); if (!uu) return;
      if (!uu.g) uu.g = {};
      let cur = uu.g[section] || '';
      const has = cur.includes(letter);
      if (action === 'view' && has) { cur = ''; }
      else if (has) { cur = cur.split('').filter((c) => c !== letter).join(''); }
      else { cur += letter; if (!cur.includes('v')) cur = 'v' + cur; }
      if (cur) uu.g[section] = cur; else delete uu.g[section];
    });
    const secName = SECTIONS.find((s) => s.k === section);
    const actName = ACTIONS.find((a) => a.k === action);
    const on = !(u.g?.[section] || '').includes(letter);
    permLog.unshift({ user: u.name, section: secName ? (L ? secName.en : secName.ar) : section, change: (on ? (L ? 'Granted ' : 'منح ') : (L ? 'Revoked ' : 'سحب ')) + (actName ? (L ? actName.en : actName.ar) : ''), at: L ? 'Just now' : 'الآن' });
    if (permLog.length > 60) permLog.pop();
    force((n) => n + 1);
  };

  const typeOpts = TYPES.map((t) => ({ v: t.id, label: L ? t.en : t.ar }));
  const scopeOpts = SCOPES.map((s) => ({ v: s.v, label: L ? s.en : s.ar }));

  const pu = users.find((u) => u.id === permUser) || users[0];
  const locked = pu.type === 'chair';
  const puPerms = effectivePerms(pu);

  // extra grants: diff current vs SEED
  const extras: { who: string; section: string; action: string; grant: boolean }[] = [];
  users.forEach((u) => {
    if (u.type === 'chair') return;
    const base = SEED_USERS.find((s) => s.id === u.id);
    const curP = effectivePerms(u); const baseP = base ? effectivePerms(base) : {};
    SECTIONS.forEach((sec) => {
      ACTIONS.forEach((a) => {
        const cur = curP[sec.k]?.has(a.k) || false;
        const b = baseP[sec.k]?.has(a.k) || false;
        if (cur && !b) extras.push({ who: u.name, section: L ? sec.en : sec.ar, action: L ? a.en : a.ar, grant: true });
        if (!cur && b) extras.push({ who: u.name, section: L ? sec.en : sec.ar, action: L ? a.en : a.ar, grant: false });
      });
    });
  });

  const tabBtn = (k: Tab, label: string) => (
    <button onClick={() => setTab(k)} style={{ padding: '9px 15px', border: 'none', borderRadius: 11, fontSize: 12.5, fontWeight: tab === k ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: tab === k ? '#1e4634' : 'transparent', color: tab === k ? '#fff' : '#6d7973' }}>{label}</button>
  );

  return (
    <Fade>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 14, padding: 6, boxShadow: '0 1px 2px rgba(20,45,32,.04)', width: 'fit-content', maxWidth: '100%', overflowX: 'auto', marginBottom: 20 }}>
        {tabBtn('users', rl('المستخدمون', 'Users'))}
        {tabBtn('types', rl('الأدوار', 'Roles'))}
        {tabBtn('sections', rl('صلاحيات الأقسام', 'Section permissions'))}
        {tabBtn('extra', rl('الصلاحيات الإضافية', 'Extra permissions'))}
        {tabBtn('log', rl('سجل التغييرات', 'Change log'))}
      </div>

      {tab === 'users' && (
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#17211c' }}>{rl('مستخدمو المنصة', 'Platform users')}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#9aa39b' }}>{rl('إدارة الأنواع والنطاقات والصلاحيات', 'Manage types, scopes and grants')} — {users.length}</p>
            </div>
            <button onClick={() => showToast(rl('إضافة مستخدم — سيتم التفعيل عند الربط بالنظام', 'Add user — enabled once connected to the backend'))} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة مستخدم', 'Add user')}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.2fr 1.3fr 0.7fr', gap: 12, padding: '14px 8px 10px', borderBottom: '1px solid #eef0ec', fontSize: 10.5, fontWeight: 700, color: '#9aa39b', letterSpacing: '.03em' }}>
            <span>{rl('المستخدم', 'User')}</span><span>{rl('النوع', 'Type')}</span><span>{rl('النطاق', 'Scope')}</span><span style={{ textAlign: 'center' }}>{rl('الصلاحيات', 'Grants')}</span>
          </div>
          {users.map((u) => {
            const [avBg, avFg] = avColor(u.name);
            return (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.2fr 1.3fr 0.7fr', gap: 12, alignItems: 'center', padding: '12px 8px', borderBottom: '1px solid #f4f6f3' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  {u.img ? <img src={'/' + u.img} alt={u.name} style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }} /> : <span style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: avBg, color: avFg }}>{initials(u.name)}</span>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#9aa39b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.job}</div>
                  </div>
                </div>
                <div><Dropdown value={u.type} options={typeOpts} onChange={(v) => setType(u.id, v)} opt={{ size: 'sm', block: true }} /></div>
                <div><Dropdown value={u.scope} options={scopeOpts} onChange={(v) => setScope(u.id, v)} opt={{ size: 'sm', block: true }} /></div>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#2b5c44' }}>{grantCount(u)}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'types' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }} className="rg2">
          {TYPES.map((tp) => (
            <div key={tp.id} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tp.bg, color: tp.fg }}><Icon name={tp.icon} size={20} /></span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#17211c' }}>{L ? tp.en : tp.ar}</div>
                  <div style={{ fontSize: 11.5, color: '#9aa39b' }}>{users.filter((u) => u.type === tp.id).length} {rl('مستخدم', 'users')}</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#5b6b62', lineHeight: 1.7 }}>{tp.desc}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'sections' && (
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '22px 24px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {users.map((p) => {
              const tp = typeObj(p.type); const active = p.id === permUser;
              return (
                <button key={p.id} onClick={() => setPermUser(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 12, fontSize: 12.5, fontWeight: active ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (active ? 'transparent' : '#e6e9e4'), background: active ? tp.bg : '#fff', color: active ? tp.fg : '#5b6b62' }}>
                  <Icon name={tp.icon} size={14} />{p.name}
                </button>
              );
            })}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr repeat(9,1fr)', gap: 6, padding: '0 4px 10px', borderBottom: '1px solid #eef0ec', fontSize: 10, fontWeight: 700, color: '#9aa39b' }}>
                <span />
                {ACTIONS.map((a) => <span key={a.k} style={{ textAlign: 'center' }}>{L ? a.en : a.ar}</span>)}
              </div>
              {SECTIONS.map((sec) => (
                <div key={sec.k} style={{ display: 'grid', gridTemplateColumns: '1.8fr repeat(9,1fr)', gap: 6, alignItems: 'center', padding: '6px 4px', borderBottom: '1px solid #f4f6f3' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#3c4a42' }}><Icon name={sec.icon} size={15} stroke="#9aa39b" />{L ? sec.en : sec.ar}</span>
                  {ACTIONS.map((a) => {
                    const on = locked ? true : puPerms[sec.k]?.has(a.k) || false;
                    return (
                      <button key={a.k} onClick={() => toggle(pu, sec.k, a.k)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 3px', borderRadius: 8, cursor: locked ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .12s', background: on ? '#1e4634' : '#f4f6f3', border: '1px solid ' + (on ? '#1e4634' : '#e6e9e4') }}>
                        {on && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'extra' && (
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#17211c' }}>{rl('الصلاحيات الإضافية / المسحوبة', 'Extra / revoked permissions')}</h3>
          {extras.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa39b', fontSize: 13, background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد تعديلات على الصلاحيات الافتراضية', 'No changes to default permissions')}</div>}
          {extras.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid #f4f6f3' }}>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: x.grant ? '#e2f0e8' : '#f7e6e4', color: x.grant ? '#2e7d55' : '#b0433b' }}>{x.grant ? rl('صلاحية إضافية', 'Added') : rl('صلاحية مسحوبة', 'Revoked')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{x.who}</div>
                <div style={{ fontSize: 11.5, color: '#8a938c' }}>{x.section} · {x.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'log' && (
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#17211c' }}>{rl('سجل تغييرات الصلاحيات', 'Permission change log')}</h3>
          {permLog.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa39b', fontSize: 13, background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد تغييرات في هذه الجلسة', 'No changes in this session')}</div>}
          {permLog.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid #f4f6f3' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1f8a5b', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#2a332d' }}><b>{l.user}</b> — {l.change} <span style={{ color: '#9aa39b' }}>({l.section})</span></div>
              </div>
              <span style={{ fontSize: 11, color: '#9aa39b' }}>{l.at}</span>
            </div>
          ))}
        </div>
      )}
    </Fade>
  );
}
