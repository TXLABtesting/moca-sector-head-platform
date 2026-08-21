import type { ReactNode, CSSProperties } from 'react';
import { useNav, type Page } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useStore } from '../store/store';
import { useCurrentUser } from '../store/useCurrentUser';
import { canSee } from '../domain/permissions';
import { pendingCompletionItems } from '../screens/member/workflow';
import { ACTIVE_MAP, NAV_SECTION, NAV_BASE, NAV_ON, BADGE_STYLE } from './navConfig';
import { Avatar } from '../components/ui';
import { asset } from '../shared/helpers';

interface NavDef { key: Page; labelKey: string; labelAr: string; labelEn: string; icon: ReactNode; badge?: number; child?: boolean }

export function Sidebar({ collapsed, onToggleCollapse, menuOpen, onCloseMenu }: {
  collapsed: boolean; onToggleCollapse: () => void; menuOpen: boolean; onCloseMenu: () => void;
}) {
  const { page, goto } = useNav();
  const { t, lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const logout = useStore((s) => s.logout);

  const pendingMeetings = data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد').length;
  const corrBadge = data.correspondence.filter((c) => c.needsAction).length;
  const oNeedDir = data.otasks.filter((tk) => tk.status === 'يحتاج توجيه').length;
  const oLateN = data.otasks.filter((tk) => tk.status === 'متأخر').length;
  const otaskBadge = oNeedDir + oLateN;
  const leaveBadge = data.leaves.filter((l) => l.status === 'بانتظار الاعتماد').length;
  const completionBadge = cu.type === 'chair' ? pendingCompletionItems(data).length : 0;

  const activeKey = ACTIVE_MAP[page] || page;
  const see = (key: string) => {
    // Report Center hosts several sub-reports; show it only if one with a real
    // page/card is visible. `recommendations` is excluded on purpose — it has no
    // entry in the hub yet, so it must not surface an empty Report Center
    // (e.g. سماح has recommendations but no report-center report).
    if (key === 'reportcenter') return ['reportCenter', 'reportLog', 'finReports', 'auditReports'].some((s) => canSee(cu, s));
    const sec = NAV_SECTION[key]; return !sec || sec === 'dashboard' ? true : canSee(cu, sec);
  };

  const navTasksLabel = cu.type === 'office' ? rl('مهامي', 'My tasks') : rl('مهام فريق المكتب', 'My team');

  const items: (NavDef & { show: boolean })[] = [
    { key: 'dashboard', labelKey: 'navLHome', labelAr: 'الرئيسية', labelEn: 'Home', icon: <IcoHome />, show: true },
    { key: 'projects', labelKey: '', labelAr: 'المشاريع', labelEn: 'Projects', icon: <IcoFolder />, show: see('projects') },
    { key: 'reqmeetings', labelKey: '', labelAr: 'الاجتماعات', labelEn: 'Meetings', icon: <IcoCalendarCheck />, badge: pendingMeetings, show: see('reqmeetings') },
    { key: 'meetings', labelKey: '', labelAr: 'محاضر الاجتماعات', labelEn: 'Minutes', icon: <IcoFileText />, show: see('meetings'), child: true },
    { key: 'correspondence', labelKey: '', labelAr: 'الصادر والوارد', labelEn: 'Correspondence', icon: <IcoMail />, badge: corrBadge, show: see('correspondence') },
    { key: 'reportcenter', labelKey: '', labelAr: 'مركز التقارير', labelEn: 'Reports', icon: <IcoReport />, show: see('reportcenter') },
    { key: 'committees', labelKey: '', labelAr: 'اللجان وفرق العمل', labelEn: 'Committees', icon: <IcoUsers />, show: see('committees') },
    { key: 'otasks', labelKey: '', labelAr: navTasksLabel, labelEn: navTasksLabel, icon: <IcoClipboard />, badge: otaskBadge, show: see('otasks') },
    { key: 'leaves', labelKey: '', labelAr: 'تخطيط إجازات الفريق', labelEn: 'Team leaves', icon: <IcoLeave />, badge: leaveBadge, show: see('leaves') },
    { key: 'completionReview', labelKey: '', labelAr: 'قيد مراجعة الاكتمال', labelEn: 'Completion review', icon: <IcoCheckReview />, badge: completionBadge, show: cu.type === 'chair' },
    { key: 'settings', labelKey: '', labelAr: 'الإعدادات والصلاحيات', labelEn: 'Settings & Roles', icon: <IcoSettings />, show: see('settings') },
  ];

  const roleName = cu.name;
  const roleTypeName = cu.job;

  const go = (p: Page) => { goto(p); onCloseMenu(); };

  return (
    <aside className={'app-side' + (menuOpen ? ' open' : '') + (collapsed ? ' collapsed' : '')} style={{
      width: 272, flex: 'none', background: 'linear-gradient(180deg,#132b20,#0e2118)',
      color: '#cfdcd3', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
    }}>
      <div className="sb-brand" style={{ padding: '22px 18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="sb-brandmark" style={{ width: 42, height: 42, flex: 'none', borderRadius: 13, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)', color: '#e8d5a2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3 4 7v5c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V7z" /><path d="m9 12 2 2 4-4" /></svg>
        </div>
        <div className="sb-brandtext" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: '.12em', color: '#c9a24b', fontWeight: 700, marginBottom: 3 }}>{t('brand')}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, color: '#fff' }}>{t('office')}</div>
        </div>
        <button onClick={onToggleCollapse} className="sb-collapse" title={collapsed ? rl('توسيع', 'Expand') : rl('طي', 'Collapse')} style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#cfdcd3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="m13 6-6 6 6 6M18 6l-6 6 6 6" /></svg>
        </button>
      </div>
      <div className="sb-menulabel" style={{ padding: '0 20px 8px', fontSize: 10.5, color: 'rgba(255,255,255,.32)', fontWeight: 600, letterSpacing: '.08em' }}>{t('menu')}</div>
      {/* only the menu list scrolls — brand stays pinned on top, profile at the bottom */}
      <nav className="sb-nav" style={{ flex: 1, minHeight: 0, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.filter((i) => i.show).map((it) => {
          const active = activeKey === it.key;
          const label = lang === 'en' ? it.labelEn : it.labelAr;
          const link = (
            <a key={it.key} onClick={() => go(it.key)} style={(active ? NAV_ON : NAV_BASE) as CSSProperties}>
              {it.icon}
              <span className="sb-label">{label}</span>
              {!!it.badge && it.badge > 0 && <span className="sb-badge" style={BADGE_STYLE}>{it.badge}</span>}
              <span className="sb-tip">{label}</span>
            </a>
          );
          if (it.child) {
            return (
              <div key={it.key} className="sb-child">
                <span className="sb-rail-v" /><span className="sb-rail-h" />
                {link}
              </div>
            );
          }
          return link;
        })}
      </nav>
      <div className="sb-profile" style={{ margin: 12, padding: '14px 15px', borderRadius: 16, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar name={cu.name} img={cu.img ? asset(cu.img) : undefined} size={42} />
        <div className="sb-proftext" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{roleName}</div>
          <div style={{ fontSize: 11, color: '#9fb8a9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleTypeName}</div>
        </div>
        <button onClick={logout} title={rl('تسجيل الخروج', 'Sign out')} aria-label={rl('تسجيل الخروج', 'Sign out')}
          style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#f0b9b3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
        </button>
      </div>
    </aside>
  );
}

/* ---- nav icons (inline, from the prototype template) ---- */
const S = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IcoHome = () => <svg {...S}><path d="M3 9.8 12 3l9 6.8V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></svg>;
const IcoFolder = () => <svg {...S}><path d="M3 8a2 2 0 0 1 2-2h3.3c.5 0 1 .2 1.4.6l1.1 1.2c.4.4.9.6 1.4.6H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
const IcoCalendarCheck = () => <svg {...S}><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /><path d="m9 15.5 1.8 1.8 3.7-3.7" /></svg>;
const IcoFileText = () => <svg {...S}><path d="M8 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 8 3.5Z" /><path d="M13.5 3.5V8h4.5" /><path d="M9 12.5h6M9 16h4" /></svg>;
const IcoMail = () => <svg {...S}><rect x="3" y="5" width="18" height="14" rx="4" /><path d="m4.8 7.8 6.1 4.1c.7.45 1.5.45 2.2 0l6.1-4.1" /></svg>;
const IcoReport = () => <svg {...S}><path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>;
const IcoUsers = () => <svg {...S}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></svg>;
const IcoClipboard = () => <svg {...S}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 13 2 2 4-4" /></svg>;
const IcoLeave = () => <svg {...S}><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /><path d="M12 14v3M10.5 15.5h3" /></svg>;
const IcoCheckReview = () => <svg {...S}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
const IcoSettings = () => <svg {...S}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
