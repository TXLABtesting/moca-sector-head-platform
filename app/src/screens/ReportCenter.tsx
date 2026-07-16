import { Fade, Avatar } from '../components/ui';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/i18n';
import { useNav } from '../store/nav';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { AuditReport } from './reportcenter/AuditReport';
import { AuditWorkspace } from './reportcenter/AuditWorkspace';
import { FinancialSummary } from './reportcenter/FinancialSummary';
import { ReportsRegister } from './reportcenter/ReportsRegister';
import { RetentionReport } from './reportcenter/RetentionReport';
import { RetentionWorkspace } from './reportcenter/RetentionWorkspace';
import { SectionAddButton } from '../components/SectionAddButton';

interface CardData {
  cat: string; icon: string; statusLabel: string; stBg: string; stFg: string;
  title: string; period: string; freq: string; entity: string;
  ownerAr: string; ownerName: string; ownerRole: string;
  updatedLabel: string; viewLabel: string; downloadLabel: string; open: () => void;
}

const metaSvgs: Record<string, React.ReactNode> = {
  period: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><rect x="3.5" y="5" width="17" height="16" rx="3.5"></rect><path d="M8 3v4M16 3v4M3.5 10.5h17"></path></svg>,
  freq: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path><path d="M21 3v5h-5"></path></svg>,
  entity: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M3 21h18M6 21V8l6-4 6 4v13M10 12h4M10 16h4"></path></svg>,
};

export function ReportCenter() {
  const { t, lang } = useI18n();
  const { page, goto } = useNav();
  const cu = useCurrentUser();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const canApprove = can(cu, 'reportCenter', 'approve') || can(cu, 'auditReports', 'approve')
    || can(cu, 'finReports', 'approve') || can(cu, 'reportLog', 'approve');

  if (page === 'auditDetail') {
    const manageAud = cu.type !== 'chair' && (can(cu, 'auditReports', 'add') || can(cu, 'auditReports', 'edit'));
    return <Fade>{manageAud ? <AuditWorkspace /> : <><SectionAddButton section="auditReports" header /><AuditReport canApprove={canApprove} /></>}</Fade>;
  }
  if (page === 'finDetail') return <Fade><SectionAddButton section="finReports" header /><FinancialSummary /></Fade>;
  if (page === 'reglog') return <Fade><SectionAddButton section="reportLog" header /><ReportsRegister /></Fade>;
  if (page === 'reportDetail') {
    const manageRet = cu.type !== 'chair' && (can(cu, 'reportCenter', 'add') || can(cu, 'reportCenter', 'edit'));
    return <Fade>{manageRet ? <RetentionWorkspace /> : <><RetentionReport /><RetentionWorkspace /></>}</Fade>;
  }

  // ---- HUB ----
  const cards: CardData[] = [
    {
      cat: rl('التقارير المالية', 'Financial reports'), icon: 'bank', statusLabel: rl('محدّث', 'Updated'), stBg: '#e2f0e8', stFg: '#2e7d55',
      title: rl('الملخص التنفيذي المالي', 'Financial Executive Summary'), period: rl('حتى 30 مايو 2026', 'To 30 May 2026'), freq: rl('دوري', 'Periodic'), entity: rl('إدارة الخدمات المالية', 'Financial Services Dept.'),
      ownerAr: 'هاجر هلول', ownerName: rl('هاجر هلول', 'Hajar Halool'), ownerRole: rl('إداري - الإنجاز والمتابعة', 'Administrator - Achievement & Follow up'),
      updatedLabel: rl('آخر تحديث: مايو 2026', 'Updated: May 2026'), viewLabel: rl('عرض التقرير', 'View report'), downloadLabel: rl('تحميل الملف', 'Download file'), open: () => goto('finDetail'),
    },
    {
      cat: rl('التقارير المالية', 'Financial reports'), icon: 'note', statusLabel: rl('مكتمل', 'Completed'), stBg: '#e2f0e8', stFg: '#2e7d55',
      title: rl('تقرير الدفعات المستبقاة', 'Retention Payments Report'), period: rl('الربع الثاني 2026', 'Q2 2026'), freq: rl('ربع سنوي', 'Quarterly'), entity: rl('إدارة الخدمات المالية', 'Financial Services Dept.'),
      ownerAr: 'حسن همام', ownerName: rl('حسن همام', 'Hasan Hammam'), ownerRole: rl('خبير الجودة والامتثال', 'Quality and Compliance Expert'),
      updatedLabel: rl('آخر تحديث: يونيو 2026', 'Updated: Jun 2026'), viewLabel: rl('عرض التقرير', 'View report'), downloadLabel: rl('تحميل آخر إصدار', 'Download latest'), open: () => goto('reportDetail'),
    },
    {
      cat: rl('سجل المتابعة', 'Tracking register'), icon: 'list', statusLabel: rl('سجل حي', 'Live register'), stBg: '#e6eef6', stFg: '#3a6ea5',
      title: rl('سجل التقارير', 'Reports Register'), period: rl('2026 · متابعة شهرية', '2026 · monthly tracking'), freq: rl('متعدد الدوريات', 'Mixed frequency'), entity: rl('كل الإدارات', 'All departments'),
      ownerAr: 'هاجر هلول', ownerName: rl('هاجر هلول', 'Hajar Halloul'), ownerRole: rl('إداري - الإنجاز والمتابعة', 'Admin – Delivery & Follow-up'),
      updatedLabel: rl('آخر تحديث: مايو 2026', 'Updated: May 2026'), viewLabel: rl('عرض السجل', 'View register'), downloadLabel: rl('تحميل السجل', 'Download register'), open: () => goto('reglog'),
    },
    {
      cat: rl('تقارير المتابعة والتدقيق', 'Follow-up & Audit reports'), icon: 'shield', statusLabel: rl('قيد المتابعة', 'Under follow-up'), stBg: '#fbf0d6', stFg: '#a9791f',
      title: rl('تقارير المتابعة والتدقيق', 'Follow-up & Audit reports'), period: rl('السنة 2025', 'Year 2025'), freq: rl('متابعة دورية / حسب الحاجة', 'Periodic / as needed'), entity: rl('إدارة الشؤون الإدارية', 'Admin Affairs Dept.'),
      ownerAr: 'حسن همام', ownerName: rl('حسن همام', 'Hasan Hammam'), ownerRole: rl('خبير الجودة والامتثال', 'Quality and Compliance Expert'),
      updatedLabel: rl('آخر تحديث: يونيو 2025', 'Updated: Jun 2025'), viewLabel: rl('عرض التقارير', 'View reports'), downloadLabel: rl('تحميل أحدث تقرير', 'Download latest'), open: () => goto('auditDetail'),
    },
  ];

  const chip = (key: 'period' | 'freq' | 'entity', label: string, value: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3c4a42', background: '#f3f5f1', borderRadius: 8, padding: '5px 10px' }}>
      {metaSvgs[key]}<span style={{ color: '#9aa39b' }}>{label}:</span><span style={{ fontWeight: 600 }}>{value}</span>
    </span>
  );

  return (
    <Fade>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('مركز التقارير', 'Report Center')}</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{t('rc_intro')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 18 }}>
        {cards.map((r, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '22px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#e9f0ec', color: '#1f4a37', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={r.icon} size={22} strokeWidth={1.7} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '5px 12px', background: r.stBg, color: r.stFg }}>{r.statusLabel}</span>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#a9791f', letterSpacing: '.04em', marginBottom: 6 }}>{r.cat}</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16.5, fontWeight: 700, color: '#17211c', lineHeight: 1.4 }}>{r.title}</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {chip('period', t('rc_period'), r.period)}
              {chip('freq', t('rc_freq'), r.freq)}
              {chip('entity', t('rc_entity'), r.entity)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, borderTop: '1px solid #f0f2ee', paddingTop: 12 }}>
              <Avatar name={r.ownerAr} size={31} />
              <div style={{ flex: 1, lineHeight: 1.35 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#2a332d' }}>{r.ownerName}</div><div style={{ fontSize: 10.5, color: '#9aa39b' }}>{r.ownerRole}</div></div>
              <span style={{ fontSize: 10.5, color: '#9aa39b' }}>{r.updatedLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={r.open} style={{ flex: 1, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: 11, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{r.viewLabel}</button>
              <button style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '11px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"></path></svg>{r.downloadLabel}</button>
            </div>
          </div>
        ))}
      </div>
    </Fade>
  );
}
