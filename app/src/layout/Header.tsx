import { useState } from 'react';
import { useNav, type Page } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { NotificationsBell } from './Notifications';

const BACK_PAGES: Page[] = ['projectDetail', 'meetingDetail', 'docDetail', 'reportDetail', 'auditDetail', 'finDetail', 'reglog', 'mtasks'];

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { page, back, search, setSearch } = useNav();
  const { t, lang, toggleLang, dir } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [mSearchOpen, setMSearchOpen] = useState(false);


  const titles: Record<string, string> = {
    dashboard: t('t_dashboard'),
    committees: rl('اللجان وفرق العمل', 'Committees'), projects: t('t_projects'),
    projectDetail: t('t_projectDetail'), meetings: t('t_meetings'), meetingDetail: t('t_meetingDetail'),
    actions: t('t_actions'), reqmeetings: t('n_reqmeetings'), correspondence: t('t_correspondence'),
    docDetail: t('t_docDetail'), reportcenter: t('t_reportcenter'), reportDetail: t('rc_detailTitle'),
    auditDetail: t('au_title'), finDetail: t('fin_title'), reglog: t('reg_title'), mtasks: t('mt_title'),
    otasks: t('ot_title'), leaves: t('lv_title'), settings: t('t_settings'),
    notifications: rl('مركز التنبيهات', 'Notifications Center'),
  };
  const crumbs: Record<string, string> = {
    dashboard: t('c_dashboard'),
    committees: rl('قطاع الخدمات المركزية', 'Central Services Sector'), projects: t('c_projects'),
    projectDetail: t('c_projectDetail'), meetings: t('c_meetings'), meetingDetail: t('c_meetingDetail'),
    actions: t('c_actions'), reqmeetings: t('n_reqmeetings'), correspondence: t('c_correspondence'),
    docDetail: t('c_docDetail'), reportcenter: t('c_reportcenter'), reportDetail: t('rc_crumb'),
    auditDetail: t('rc_crumb'), finDetail: t('rc_crumb'), reglog: t('rc_crumb'), mtasks: t('n_meetings'),
    otasks: t('ot_crumb'), leaves: t('lv_crumb'), settings: t('c_settings'),
    notifications: rl('التنبيهات', 'Notifications'),
  };

  const showBack = BACK_PAGES.includes(page);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
        {/* phone: search collapses into an icon that opens a full-width bar */}
        <button onClick={() => setMSearchOpen((v) => !v)} className="hdr-search-btn" aria-label={t('searchPh')} style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, border: '1px solid #ebeee9', background: mSearchOpen ? '#e9f0ec' : '#fff', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1f4a37' }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
        </button>
        {mSearchOpen && (
          <div className="hdr-msearch">
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPh')} />
          </div>
        )}
        <div className="hide-sm" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', pointerEvents: 'none', insetInlineStart: 12 }} width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPh')} style={{ border: '1px solid #ebeee9', background: '#fff', borderRadius: 12, padding: '10px 14px', paddingInlineStart: 40, fontSize: 13, width: 240, outline: 'none', color: '#17211c', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }} />
        </div>
        <button onClick={toggleLang} style={{ height: 42, borderRadius: 12, border: '1px solid #ebeee9', background: '#fff', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#1f4a37', fontWeight: 700, fontSize: 12.5, padding: '0 14px', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" /></svg>
          <span className="hdr-langtxt">{lang === 'ar' ? 'EN' : 'ع'}</span>
        </button>
        <NotificationsBell />
      </div>
    </header>
  );
}
