import { useState } from 'react';
import { useNav, type Page } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useStore } from '../store/store';
import { useCurrentUser } from '../store/useCurrentUser';
import { TYPES } from './headerHelpers';
import { Icon } from '../components/Icon';
import { asset } from '../shared/helpers';

const BACK_PAGES: Page[] = ['projectDetail', 'meetingDetail', 'docDetail', 'reportDetail', 'auditDetail', 'finDetail', 'reglog', 'mtasks'];

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { page, back, search, setSearch } = useNav();
  const { t, lang, toggleLang, dir } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const users = useStore((s) => s.users);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const [roleOpen, setRoleOpen] = useState(false);

  const titles: Record<string, string> = {
    dashboard: t('t_dashboard'), workspace: rl('لوحة فريق المكتب', 'Office Team Workspace'),
    committees: rl('اللجان وفرق العمل', 'Committees'), team: t('t_team'), projects: t('t_projects'),
    projectDetail: t('t_projectDetail'), meetings: t('t_meetings'), meetingDetail: t('t_meetingDetail'),
    actions: t('t_actions'), reqmeetings: t('n_reqmeetings'), correspondence: t('t_correspondence'),
    docDetail: t('t_docDetail'), reportcenter: t('t_reportcenter'), reportDetail: t('rc_detailTitle'),
    auditDetail: t('au_title'), finDetail: t('fin_title'), reglog: t('reg_title'), mtasks: t('mt_title'),
    otasks: t('ot_title'), leaves: t('lv_title'), settings: t('t_settings'),
  };
  const crumbs: Record<string, string> = {
    dashboard: t('c_dashboard'), workspace: rl('فريق المكتب', 'Office Team'),
    committees: rl('قطاع الخدمات المركزية', 'Central Services Sector'), team: t('c_team'), projects: t('c_projects'),
    projectDetail: t('c_projectDetail'), meetings: t('c_meetings'), meetingDetail: t('c_meetingDetail'),
    actions: t('c_actions'), reqmeetings: t('n_reqmeetings'), correspondence: t('c_correspondence'),
    docDetail: t('c_docDetail'), reportcenter: t('c_reportcenter'), reportDetail: t('rc_crumb'),
    auditDetail: t('rc_crumb'), finDetail: t('rc_crumb'), reglog: t('rc_crumb'), mtasks: t('n_meetings'),
    otasks: t('ot_crumb'), leaves: t('lv_crumb'), settings: t('c_settings'),
  };

  const showBack = BACK_PAGES.includes(page);
  const ct = TYPES.find((x) => x.id === cu.type) || TYPES[0];

  const pickUser = (id: string) => {
    setCurrentUser(id);
    setRoleOpen(false);
    // Shell redirects to the dashboard automatically when the new user can't see this page.
  };

  return (
    <header className="app-header" style={{ height: 76, flex: 'none', background: 'rgba(247,250,246,.55)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,.55)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', position: 'sticky', top: 0, zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <button onClick={onOpenMenu} className="menu-btn" style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, border: '1px solid #ebeee9', background: '#fff', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1f4a37' }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        {showBack && (
          <button onClick={back} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #ebeee9', color: '#3c4a42', borderRadius: 11, padding: '9px 14px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
            <svg style={{ transform: dir === 'ltr' ? 'scaleX(-1)' : undefined }} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            {t('back')}
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#8a938c', fontWeight: 500, marginBottom: 2 }}>{crumbs[page]}</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titles[page]}</h1>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="hide-sm" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', pointerEvents: 'none', insetInlineStart: 12 }} width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPh')} style={{ border: '1px solid #ebeee9', background: '#fff', borderRadius: 12, padding: '10px 14px', paddingInlineStart: 40, fontSize: 13, width: 240, outline: 'none', color: '#17211c', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }} />
        </div>
        <div className="hide-sm" style={{ position: 'relative' }}>
          <button onClick={() => setRoleOpen((v) => !v)} title={lang === 'en' ? ct.en : ct.ar} style={{ height: 42, borderRadius: 12, border: '1px solid #ebeee9', background: '#fff', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '0 12px 0 10px', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
            <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ct.bg, color: ct.fg }}><Icon name={ct.icon} size={15} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#17211c' }}>{cu.name}</span>
              <span style={{ fontSize: 9.5, color: '#9aa39b' }}>{lang === 'en' ? ct.en : ct.ar}</span>
            </span>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {roleOpen && (
            <>
              <div onClick={() => setRoleOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 590 }} />
              <div style={{ position: 'absolute', top: 50, insetInlineEnd: 0, width: 300, background: '#fff', border: '1px solid #edf0ea', borderRadius: 16, boxShadow: '0 16px 44px -12px rgba(23,40,32,.3),0 3px 10px rgba(23,40,32,.07)', padding: 8, zIndex: 600, animation: 'fadeUp .14s ease', maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ padding: '8px 11px 9px', fontSize: 10.5, fontWeight: 700, color: '#9aa39b', letterSpacing: '.04em' }}>{rl('عرض المنصة كـ', 'View platform as')}</div>
                {users.map((u) => {
                  const tp = TYPES.find((x) => x.id === u.type) || TYPES[0];
                  const active = u.id === cu.id;
                  return (
                    <button key={u.id} onClick={() => pickUser(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 11px', border: 'none', background: active ? '#f2f7f4' : 'transparent', cursor: 'pointer', textAlign: 'start', borderRadius: 12, fontFamily: 'inherit' }}>
                      <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tp.bg, color: tp.fg }}><Icon name={tp.icon} size={15} /></span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{u.name}</span>
                        <span style={{ fontSize: 10, color: '#9aa39b' }}>{lang === 'en' ? tp.en : tp.ar}</span>
                      </span>
                      {active && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1e4634" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button onClick={toggleLang} style={{ height: 42, borderRadius: 12, border: '1px solid #ebeee9', background: '#fff', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#1f4a37', fontWeight: 700, fontSize: 12.5, padding: '0 14px', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" /></svg>
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
        <button style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, border: '1px solid #ebeee9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3c4a42', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
          <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5a5 5 0 0 0-5 5c0 4-1.5 5.5-1.5 5.5h13S17 15.5 17 11.5a5 5 0 0 0-5-5Z" /><path d="M10 19.5a2 2 0 0 0 4 0M12 4v2.5" /></svg>
          <span style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: '50%', background: '#b0433b', border: '2px solid #fff' }} />
        </button>
        <img src={asset('assets/logo.png')} alt="وزارة شؤون مجلس الوزراء" style={{ height: 34, width: 'auto', marginInlineStart: 6 }} />
      </div>
    </header>
  );
}
