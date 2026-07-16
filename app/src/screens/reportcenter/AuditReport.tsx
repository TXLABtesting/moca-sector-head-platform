import { useState, type CSSProperties } from 'react';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { Dropdown } from '../../components/Dropdown';
import { Drawer, Avatar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { initials } from '../../shared/helpers';
import { AUS, useAv, audBullets, type Pair } from './shared';

const AUDIT_UNITS = [
  'إدارة الشؤون الإدارية', 'إدارة الخدمات المالية', 'إدارة خدمات الموارد البشرية',
  'إدارة العقود والمشتريات', 'إدارة الخدمات والبنية التحتية', 'مركز التجربة المتكاملة',
];
const impRank: Record<string, number> = { 'عالية': 0, 'متوسطة': 1, 'منخفضة': 2 };

const th: CSSProperties = { textAlign: 'start', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#8a938c', borderBottom: '1px solid #eef0ec' };
const tdBase: CSSProperties = { padding: 12, borderBottom: '1px solid #f4f6f2', verticalAlign: 'top' };

export function AuditReport({ canApprove }: { canApprove: boolean }) {
  const { t, tr, dl, lang } = useI18n();
  const auditAll = useStore((s) => s.data.audit);
  const auditReps = useStore((s) => s.data.auditReps) || [];
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const av = useAv();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);

  // family filter state
  const [famSearch, setFamSearch] = useState('');
  const [selUnit, setSelUnit] = useState('');
  const [selYear, setSelYear] = useState('');
  const [repStatus, setRepStatus] = useState('');
  // observation filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [dept, setDept] = useState('');
  const [due, setDue] = useState('');
  const [late, setLate] = useState(false);
  const [needInt, setNeedInt] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const clearFilters = () => { setSearch(''); setStatus(''); setOwner(''); setDept(''); setDue(''); setLate(false); setNeedInt(false); };
  const resetKpi = () => clearFilters();

  const audLbl = (s: string) => (s === 'قيد التنفيذ' ? rl('جاري العمل', 'In progress') : tr(s));
  const audStale = (a: any) => { const y = (String(a.updated || '').match(/20\d\d/) || [])[0]; return !y || parseInt(y) < 2026; };
  const audFlag = (a: any) => a.status !== 'مغلق' && (a.status === 'متأخر' || a.imp === 'عالية' || audStale(a));
  const audReason = (a: any) => a.status === 'متأخر' ? rl('متأخرة عن تاريخ التنفيذ', 'Overdue past due date')
    : (a.imp === 'عالية' ? rl('أهمية عالية تتطلب تدخلك', 'High priority — needs attention')
      : (audStale(a) ? rl('لم تُحدَّث مؤخراً', 'No recent update') : rl('تحتاج متابعة', 'Needs follow-up')));

  // ---- family registry (shared auditReps collection — new reports from the
  //      responsible member appear here automatically) ----
  const obsOf = (repId: string) => auditAll.filter((a) => (a.rep || 'admin2025') === repId);
  const AUDIT_REG = auditReps.map((r) => {
    const meta = r as typeof r & { _mret?: string };
    const obs = obsOf(r.id);
    return {
      id: r.id, unit: r.unit, year: r.year, status: meta._mret ? 'أعيد للتعديل' : r.status,
      title: tr(r.title), period: r.period, freq: r.freq, resp: r.resp,
      total: obs.length, closed: obs.filter((a) => a.status === 'مغلق').length,
    };
  });
  const audLatest = AUDIT_REG.find((r) => r.total > 0) || AUDIT_REG[0]
    || { id: 'admin2025', unit: 'إدارة الشؤون الإدارية', year: '2025', status: 'قيد المتابعة', title: '', period: '', freq: '', resp: '', total: 0, closed: 0 };
  const curUnit = selUnit || audLatest.unit;
  const curYear = selYear || audLatest.year;
  const selReport = AUDIT_REG.find((r) => r.unit === curUnit && r.year === curYear) || null;
  const audit = selReport ? obsOf(selReport.id) : auditAll;

  const audTotal = audit.length;
  const audClosed = audit.filter((a) => a.status === 'مغلق').length;
  const audProg = audit.filter((a) => a.status === 'قيد التنفيذ').length;
  const audLateN = audit.filter((a) => a.status === 'متأخر').length;
  const audNeedIntN = audit.filter(audFlag).length;
  const arq = famSearch.trim();
  const reportsList = AUDIT_REG.filter((r) => {
    if (repStatus && r.status !== repStatus) return false;
    if (arq && !(r.title.includes(arq) || r.unit.includes(arq))) return false;
    return true;
  });

  // ---- decorate an observation ----
  const decAud = (a: any) => {
    const [b, f] = AUS[a.status] || ['#eee', '#555'];
    const [ob, of] = av(a.owner);
    return {
      ...a, area: tr(a.area), obsBullets: audBullets(tr(a.obs)), actionBullets: audBullets(tr(a.action)),
      notes: a.notes ? tr(a.notes) : '—', owner: tr(a.owner), ownerInitials: initials(a.owner), due: dl(a.due), statusLabel: audLbl(a.status),
      reason: audReason(a), _bg: b, _fg: f, ownerBg: ob, ownerFg: of,
      _rowBg: a.status === 'متأخر' ? '#fdf6f5' : 'transparent',
    };
  };

  // KPIs
  const kpis = [
    { label: rl('إجمالي الملاحظات', 'Total observations'), value: audTotal, icon: 'shield', bg: '#e6eef6', fg: '#3a6ea5', accent: '#3a6ea5', kind: 'all' },
    { label: rl('الملاحظات المغلقة', 'Closed'), value: audClosed, icon: 'tick', bg: '#e2f0e8', fg: '#2e7d55', accent: '#2e7d55', kind: 'مغلق' },
    { label: rl('جاري العمل', 'In progress'), value: audProg, icon: 'timer', bg: '#fbf0d6', fg: '#a9791f', accent: '#a9791f', kind: 'قيد التنفيذ' },
    { label: rl('المتأخرة', 'Overdue'), value: audLateN, icon: 'pin', bg: '#f7e6e4', fg: '#b0433b', accent: '#b0433b', kind: 'متأخر' },
    { label: rl('تحتاج تدخل', 'Needs attention'), value: audNeedIntN, icon: 'star', bg: '#f3ecf6', fg: '#7a4d94', accent: '#7a4d94', kind: 'needint' },
  ];
  const kpiActive = (kind: string) => kind === 'needint' ? needInt : (kind === 'all' ? (!status && !needInt) : (status === kind && !needInt));
  const kpiClick = (kind: string) => { clearFilters(); if (kind === 'needint') setNeedInt(true); else if (kind !== 'all') setStatus(kind); };

  // follow-up top 3
  const follow = audit.filter(audFlag)
    .sort((a, b) => ((a.status === 'متأخر' ? -1 : 0) - (b.status === 'متأخر' ? -1 : 0)) || (impRank[a.imp] - impRank[b.imp]))
    .slice(0, 3).map(decAud);

  // table rows
  const aq = search.trim();
  const rows = audit.filter((a) => {
    if (status && a.status !== status) return false;
    if (owner && a.owner !== owner) return false;
    if (dept && a.area !== dept) return false;
    if (due && a.due !== due) return false;
    if (late && a.status !== 'متأخر') return false;
    if (needInt && !audFlag(a)) return false;
    if (aq && !(a.area.includes(aq) || a.obs.includes(aq) || a.action.includes(aq) || a.num.includes(aq))) return false;
    return true;
  }).map(decAud);

  const selDetail = sel ? decAud(audit.find((x) => x.id === sel)) : null;

  // actions
  const reqUpdate = () => showToast(rl('تم إرسال طلب تحديث إلى المسؤول عن الملاحظة', 'Update request sent'));
  const markReviewed = (id: string) => { mutate((d) => { const a = d.audit.find((x) => x.id === id) as any; if (a) a.reviewed = true; }); showToast(rl('تم وضع علامة تمت المراجعة', 'Marked as reviewed')); };
  const addDirective = (id: string) => { mutate((d) => { const a = d.audit.find((x) => x.id === id) as any; if (a) { a.directives = a.directives || []; a.directives.push({ text: rl('توجيه من رئيس القطاع', 'Directive from the Sector Head') }); } }); showToast(rl('تمت إضافة التوجيه', 'Directive added')); };

  // dropdown option lists
  const uniq = (k: 'owner' | 'area' | 'due') => [...new Set(audit.map((a) => a[k]).filter(Boolean))];
  const statusOpts = [{ v: '', label: t('allStatuses') }, ...['متأخر', 'قيد التنفيذ', 'مغلق'].map((s) => ({ v: s, label: audLbl(s) }))];
  const ownerOpts = [{ v: '', label: rl('كل المسؤولين', 'All responsibles') }, ...uniq('owner').map((o) => ({ v: o, label: tr(o) }))];
  const deptOpts = [{ v: '', label: rl('كل الوحدات', 'All units') }, ...uniq('area').map((o) => ({ v: o, label: tr(o) }))];
  const dueOpts = [{ v: '', label: rl('كل التواريخ', 'All dates') }, ...uniq('due').map((o) => ({ v: o, label: dl(o) }))];
  const unitOpts = [{ v: '', label: rl('كل الوحدات', 'All units') }, ...[...new Set([...AUDIT_UNITS, ...auditReps.map((r) => r.unit)])].map((u) => ({ v: u, label: tr(u) }))];
  const yearOpts = [{ v: '', label: rl('كل السنوات', 'All years') }, ...[...new Set(['2026', '2025', ...auditReps.map((r) => r.year)])].sort().reverse().map((y) => ({ v: y, label: y }))];
  const repStatusOpts = [{ v: '', label: t('allStatuses') }, ...[...new Set(['قيد المتابعة', 'مكتمل', ...AUDIT_REG.map((r) => r.status)])].map((s) => ({ v: s, label: tr(s) }))];
  const REPC: Record<string, [string, string]> = {
    'قيد المتابعة': ['#fbf0d6', '#a9791f'], 'بانتظار مراجعة رئيس القطاع': ['#fbf0d6', '#a9791f'],
    'مسودة': ['#eceeeb', '#6d7973'], 'معتمد': ['#e2f0e8', '#2e7d55'], 'مكتمل': ['#e2f0e8', '#2e7d55'], 'أعيد للتعديل': ['#f7e6e4', '#b0433b'],
  };

  const filterBtn = (on: boolean, onC: string, onBg: string): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid ' + (on ? onC : '#e2e6df'), background: on ? onBg : '#ffffff', color: on ? onC : '#7d867f',
  });

  return (
    <div style={{ animation: 'fadeUp .16s ease' }}>
      {/* family filter bar */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 12px 30px -16px rgba(23,40,32,.14)', padding: '15px 18px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="2" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
          <input value={famSearch} onChange={(e) => setFamSearch(e.target.value)} placeholder={t('au_searchReport')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', paddingInlineStart: 34, fontSize: 12.5, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 11.5, color: '#7d867f', fontWeight: 600 }}>{t('au_unit')}</span><Dropdown value={curUnit} options={unitOpts} onChange={setSelUnit} opt={{ size: 'sm', minWidth: '150px', popMaxWidth: '340px' }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 11.5, color: '#7d867f', fontWeight: 600 }}>{t('rc_year')}</span><Dropdown value={curYear} options={yearOpts} onChange={setSelYear} opt={{ size: 'sm', minWidth: '96px' }} /></div>
        <Dropdown value={repStatus} options={repStatusOpts} onChange={setRepStatus} opt={{ size: 'sm', minWidth: '118px' }} />
      </div>

      {/* available reports list */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {reportsList.map((r) => (
          <div key={r.id} onClick={() => { setSelUnit(r.unit); setSelYear(r.year); }} style={{ cursor: 'pointer', background: (r.unit === curUnit && r.year === curYear) ? '#fbf7ec' : '#fff', border: '1px solid #e6eadf', borderRadius: 14, padding: '13px 16px', minWidth: 230, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#a9791f' }}>{tr(r.unit)} · {r.year}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', background: (REPC[r.status] || REPC['قيد المتابعة'])[0], color: (REPC[r.status] || REPC['قيد المتابعة'])[1] }}>{tr(r.status)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.45 }}>{tr(r.title)}</div>
            <div style={{ fontSize: 10.5, color: '#9aa39b' }}>{r.total} {t('au_obsWord')} · {r.closed} {t('rc_closedShort')}</div>
          </div>
        ))}
      </div>

      {selReport ? (
        <>
          {/* header */}
          <div style={{ background: 'linear-gradient(120deg,#1e4634,#2b5c44)', borderRadius: 22, padding: '24px 26px', color: '#eaf1ec', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(233,200,119,.22)', color: '#f0d488', borderRadius: 20, padding: '5px 12px' }}>{rl('تقارير المتابعة والتدقيق', 'Follow-up & Audit reports')}</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: (REPC[selReport.status] || REPC['قيد المتابعة'])[0], color: (REPC[selReport.status] || REPC['قيد المتابعة'])[1], borderRadius: 20, padding: '5px 12px' }}>{tr(selReport.status)}</span>
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>{tr(selReport.title)}</h2>
              <div style={{ fontSize: 13, color: '#bcd2c3' }}>{tr(selReport.unit)} · {rl('متابعة ملاحظات التدقيق الداخلي', 'Internal audit findings follow-up')} · {selReport.freq === 'حسب الحاجة' ? rl('حسب الحاجة', 'As needed') : rl('متابعة دورية', 'Periodic')}{selReport.period ? ' · ' + tr(selReport.period) : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: '11px 15px' }}>
              <Avatar name={selReport.resp || 'حسن همام'} size={40} />
              <div style={{ lineHeight: 1.4 }}><div style={{ fontSize: 10.5, color: '#a9c0b1' }}>{t('rc_responsible')}</div><div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{tr(selReport.resp || 'حسن همام')}</div><div style={{ fontSize: 10.5, color: '#a9c0b1' }}>{selReport.resp && selReport.resp !== 'حسن همام' ? rl('مسؤول المتابعة والتدقيق', 'Follow-up & audit officer') : rl('خبير الجودة والامتثال', 'Quality and Compliance Expert')}</div></div>
            </div>
            <button style={{ background: '#e9c877', color: '#3a2f10', border: 'none', borderRadius: 11, padding: '12px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"></path></svg>{t('rc_downloadFile')}</button>
          </div>

          {/* KPI summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
            {kpis.map((k) => {
              const active = kpiActive(k.kind);
              return (
                <div key={k.kind} onClick={() => kpiClick(k.kind)} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -22px rgba(23,40,32,.14)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow .15s,transform .15s', cursor: 'pointer', outline: active ? '2px solid ' + k.accent : undefined, outlineOffset: active ? -2 : undefined, transform: active ? 'translateY(-2px)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.fg }}>
                      {k.icon === 'star'
                        ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 15 9l7 .5-5.4 4.6L18.5 21 12 17l-6.5 4 1.9-6.9L2 9.5 9 9z"></path></svg>
                        : <Icon name={k.icon} size={19} strokeWidth={1.8} />}
                    </span>
                    <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: '#17211c', textAlign: 'end' }}>{k.value}</span>
                  </div>
                  <div><div style={{ fontSize: 13, color: '#5b6b62', fontWeight: 600 }}>{k.label}</div></div>
                </div>
              );
            })}
          </div>

          {/* observations needing follow-up (top 3) */}
          {follow.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><span style={{ width: 8, height: 26, borderRadius: 6, background: '#b0433b', flex: 'none' }}></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('au_topObs')}</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
                {follow.map((a) => (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid #e6eae4', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 36px -22px rgba(23,40,32,.16)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '4px 10px', background: '#fbf0d6', color: '#a9791f' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path></svg>{a.reason}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '4px 10px', background: a._bg, color: a._fg }}>{a.statusLabel}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#17211c', lineHeight: 1.5 }}>{a.area}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11.5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}><span style={{ width: 24, height: 24, flex: 'none', borderRadius: '50%', background: a.ownerBg, color: a.ownerFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700 }}>{a.ownerInitials || ''}</span><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#3c4a42', fontWeight: 600 }}>{a.owner}</span></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontWeight: 700, color: '#3c4a42' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5"></rect><path d="M8 3v4M16 3v4M3.5 10.5h17"></path></svg>{a.due}</span>
                    </div>
                    <div style={{ height: 1, background: '#eef0ec' }}></div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <button onClick={() => setSel(a.id)} style={{ flex: 1, minWidth: 92, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 10px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('au_viewDetails')}</button>
                      {canApprove && <button onClick={() => addDirective(a.id)} style={{ background: '#f3ecf6', color: '#7a4d94', border: 'none', borderRadius: 9, padding: '9px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('au_addDirective')}</button>}
                      <button onClick={() => reqUpdate()} style={{ background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 9, padding: '9px 12px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('au_requestUpdate')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* all observations table */}
          <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#e9f0ec', color: '#1f4a37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('au_allObs')}</h3></div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 170 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="2" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('au_search')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', paddingInlineStart: 34, fontSize: 12.5, fontFamily: 'inherit' }} />
              </div>
              <Dropdown value={status} options={statusOpts} onChange={(v) => { setStatus(v); setNeedInt(false); }} opt={{ size: 'sm', minWidth: '118px' }} />
              <Dropdown value={owner} options={ownerOpts} onChange={setOwner} opt={{ size: 'sm', minWidth: '120px' }} />
              <Dropdown value={dept} options={deptOpts} onChange={setDept} opt={{ size: 'sm', minWidth: '150px', popMaxWidth: '320px' }} />
              <Dropdown value={due} options={dueOpts} onChange={setDue} opt={{ size: 'sm', minWidth: '120px' }} />
              <button onClick={() => { setLate(!late); setNeedInt(false); }} style={filterBtn(late, '#b0433b', '#f7e6e4')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>{t('au_onlyLate')}</button>
              <button onClick={() => { setNeedInt(!needInt); setLate(false); }} style={filterBtn(needInt, '#7a4d94', '#f3ecf6')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 15 9l7 .5-5.4 4.6L18.5 21 12 17l-6.5 4 1.9-6.9L2 9.5 9 9z"></path></svg>{t('au_onlyNeedInt')}</button>
              <button onClick={resetKpi} style={{ border: '1px solid #e2e6df', background: '#fff', color: '#7d867f', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('au_clear')}</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
                <thead><tr>
                  <th style={{ ...th, whiteSpace: 'nowrap' }}>{t('au_num')}</th>
                  <th style={th}>{t('au_observation')}</th>
                  <th style={th}>{t('au_closureMechanism')}</th>
                  <th style={{ ...th, whiteSpace: 'nowrap' }}>{t('thOwner')}</th>
                  <th style={{ ...th, whiteSpace: 'nowrap' }}>{t('thStatus')}</th>
                  <th style={{ ...th, whiteSpace: 'nowrap' }}>{t('au_dueDate')}</th>
                  <th style={th}>{t('au_notes')}</th>
                </tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} onClick={() => setSel(a.id)} style={{ background: a._rowBg, cursor: 'pointer' }}>
                      <td style={{ ...tdBase, fontWeight: 800, color: '#8a938c', whiteSpace: 'nowrap' }}>{a.num}</td>
                      <td style={{ ...tdBase, color: '#17211c', fontWeight: 600 }}>{a.area}<ul style={{ margin: '5px 0 0', paddingInlineStart: 16, fontSize: 11, color: '#9aa39b', fontWeight: 400, lineHeight: 1.6, maxWidth: 260 }}>{a.obsBullets.map((ob: string, i: number) => <li key={i} style={{ marginBottom: 3 }}>{ob}</li>)}</ul></td>
                      <td style={{ ...tdBase, maxWidth: 280 }}><ul style={{ margin: 0, paddingInlineStart: 16, color: '#3c4a42', lineHeight: 1.6 }}>{a.actionBullets.map((bl: string, i: number) => <li key={i} style={{ marginBottom: 3 }}>{bl}</li>)}</ul></td>
                      <td style={{ ...tdBase, color: '#3c4a42', whiteSpace: 'nowrap' }}>{a.owner}</td>
                      <td style={{ ...tdBase, whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 10px', background: a._bg, color: a._fg }}>{a.statusLabel}</span></td>
                      <td style={{ ...tdBase, color: '#3c4a42', whiteSpace: 'nowrap', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{a.due}</td>
                      <td style={{ ...tdBase, color: '#8a938c', lineHeight: 1.5, maxWidth: 180 }}>{a.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <div style={{ padding: 34, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('au_noReport')}</div>}
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: '#fff', border: '1px dashed #d8ddd4', borderRadius: 22, padding: '56px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 60, height: 60, borderRadius: 16, background: '#f4f6f2', color: '#a7b0a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5.5c0 4.3 3 7.4 7 8.5 4-1.1 7-4.2 7-8.5V6z"></path><path d="M9.5 11.5h5M12 9v5"></path></svg></span>
          <div><h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{t('au_noReport')}</h3><p style={{ margin: 0, fontSize: 13, color: '#8a938c' }}>{selReport ? '' : (tr(curUnit) + ' ' + curYear)}</p></div>
          <button onClick={() => { setSelUnit(audLatest.unit); setSelYear(audLatest.year); setRepStatus(''); setFamSearch(''); }} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 5 5v3"></path></svg>{t('au_backLatest')}</button>
        </div>
      )}

      {/* observation drawer */}
      <Drawer open={!!selDetail} onClose={() => setSel(null)} width={460}>
        {selDetail && <ObsDrawer d={selDetail} canApprove={canApprove} onClose={() => setSel(null)} t={t} reqUpdate={reqUpdate} markReviewed={markReviewed} addDirective={addDirective} />}
      </Drawer>
    </div>
  );
}

function ObsDrawer({ d, canApprove, onClose, t, reqUpdate, markReviewed, addDirective }: {
  d: any; canApprove: boolean; onClose: () => void; t: (k: string) => string;
  reqUpdate: (id: string) => void; markReviewed: (id: string) => void; addDirective: (id: string) => void;
}) {
  const initials = d.ownerInitials || '';
  const [ob, of] = [d.ownerBg, d.ownerFg] as Pair;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 22px', borderBottom: '1px solid #eef0ec' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 15 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#a9791f', marginBottom: 5 }}>{t('au_num')} {d.num}</div><h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#17211c', lineHeight: 1.45 }}>{d.area}</h3></div>
          <button onClick={onClose} style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid #e2e6df', background: '#fff', color: '#7d867f', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canApprove && <button onClick={() => addDirective(d.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>{t('au_addDirective')}</button>}
          <button onClick={() => reqUpdate(d.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f3ecf6', color: '#7a4d94', border: 'none', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path><path d="M21 3v5h-5"></path></svg>{t('au_requestUpdate')}</button>
          {canApprove && <button onClick={() => markReviewed(d.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e2f0e8', color: '#2e7d55', border: 'none', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>{t('au_markReviewed')}</button>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '5px 12px', background: d._bg, color: d._fg }}>{d.statusLabel}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#2a332d', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="16" rx="3.5"></rect><path d="M8 3v4M16 3v4M3.5 10.5h17"></path></svg>{d.due}</span>
        </div>
        <div><div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 6 }}>{t('thOwner')}</div><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', background: ob, color: of, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{initials}</span><span style={{ fontSize: 13, fontWeight: 600, color: '#2a332d' }}>{d.owner}</span></div></div>
        <div><div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 7 }}>{t('au_obsDetail')}</div><ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: '#2a332d', lineHeight: 1.75 }}>{d.obsBullets.map((ob2: string, i: number) => <li key={i} style={{ marginBottom: 5 }}>{ob2}</li>)}</ul></div>
        <div><div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 7 }}>{t('au_closureMechanism')}</div><ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: '#2a332d', lineHeight: 1.7 }}>{d.actionBullets.map((bl: string, i: number) => <li key={i} style={{ marginBottom: 6 }}>{bl}</li>)}</ul></div>
        <div style={{ border: '1px solid #eef1ec', borderRadius: 12, padding: '14px 16px' }}><div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 6 }}>{t('au_notes')}</div><p style={{ margin: 0, fontSize: 12.5, color: '#6d7973', lineHeight: 1.7 }}>{d.notes}</p></div>
      </div>
    </div>
  );
}
