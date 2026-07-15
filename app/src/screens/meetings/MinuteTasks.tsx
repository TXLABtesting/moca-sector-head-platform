import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Fade } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Dropdown } from '../../components/Dropdown';
import { Modal, Drawer, Badge, Avatar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/i18n';
import { useNav } from '../../store/nav';
import { useStore } from '../../store/store';
import { useCurrentUser } from '../../store/useCurrentUser';
import { can } from '../../domain/permissions';
import type { MinuteTask } from '../../data/types';
import { SectionAddButton } from '../../components/SectionAddButton';
import { MTS, GS, MT_STATUSES, mtNeedsSupport, mtMonKey, mtMonLabel } from './mtShared';

const CARD_SHADOW = '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)';

export function MinuteTasks() {
  const { t, tr, dl, lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { params } = useNav();
  const { showToast } = useToast();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();

  const canDirect = can(cu, 'minuteTasks', 'note');
  const canReview = can(cu, 'minuteTasks', 'review');
  const canStatus = can(cu, 'minuteTasks', 'status');

  const mtasks = data.mtasks;

  // ---- local state ----
  const [mtSearch, setSearch] = useState('');
  const [mtStatus, setStatus] = useState('');
  const [mtOwner, setOwner] = useState('');
  const [mtDept, setDept] = useState('');
  const [mtSupport, setSupport] = useState(false);
  const [selMtMonth, setSelMonth] = useState('');
  const [mtDetailed, setDetailed] = useState(false);
  const [mtLimit, setLimit] = useState(12);
  const [selMtask, setSelMtask] = useState<string | null>(null);
  const [dirModalId, setDirModalId] = useState<string | null>(null);
  const [dirDraft, setDirDraft] = useState('');

  // seed filters from nav params when navigating in (e.g. from a KPI on the minutes list)
  useEffect(() => {
    const st = (params.mtStatus as string) || '';
    const sup = !!params.mtSupport;
    setStatus(st); setSupport(sup);
    setSearch((params.mtSearch as string) || '');
    setOwner((params.mtOwner as string) || '');
    setDept((params.mtDept as string) || '');
    setLimit(12);
    // If a status/support deep-link arrives, land on the newest month that actually
    // has matching tasks (otherwise keep the default newest month).
    if (st || sup) {
      const desc = [...new Set(mtasks.map((tk) => mtMonKey(tk.mDate)))].filter(Boolean).sort().reverse();
      const match = desc.find((mk) => mtasks.some((tk) =>
        mtMonKey(tk.mDate) === mk && (st ? tk.status === st : true) && (sup ? mtNeedsSupport(tk) : true)));
      setSelMonth(match || '');
    } else {
      setSelMonth('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ---- month navigator ----
  const monthsAll = useMemo(
    () => [...new Set(mtasks.map((tk) => mtMonKey(tk.mDate)))].filter(Boolean).sort().reverse(),
    [mtasks]
  );
  const curMonth = (selMtMonth && monthsAll.includes(selMtMonth)) ? selMtMonth : (monthsAll[0] || '');
  const curIdx = monthsAll.indexOf(curMonth);
  const canOlder = curIdx > -1 && curIdx < monthsAll.length - 1;
  const canNewer = curIdx > 0;

  const setMonth = (key: string) => {
    setSelMonth(key); setStatus(''); setSupport(false); setSearch(''); setOwner(''); setDept(''); setLimit(12);
  };

  const monthTasks = useMemo(
    () => mtasks.filter((tk) => mtMonKey(tk.mDate) === curMonth),
    [mtasks, curMonth]
  );

  // ---- KPIs (for the selected month) ----
  const cnt = (st: string) => monthTasks.filter((t2) => t2.status === st).length;
  const supCount = monthTasks.filter(mtNeedsSupport).length;
  const kpis = [
    { icon: 'list', label: rl('إجمالي المهام', 'Total tasks'), value: monthTasks.length, bg: '#e6eef6', fg: '#3a6ea5', accent: '#3a6ea5', kind: 'all' },
    { icon: 'tick', label: rl('المكتملة', 'Completed'), value: cnt('مكتمل'), bg: '#e2f0e8', fg: '#2e7d55', accent: '#2e7d55', kind: 'مكتمل' },
    { icon: 'timer', label: rl('قيد التنفيذ', 'In progress'), value: cnt('قيد التنفيذ'), bg: '#fbf0d6', fg: '#a9791f', accent: '#a9791f', kind: 'قيد التنفيذ' },
    { icon: 'note', label: rl('لم تبدأ', 'Not started'), value: cnt('لم يبدأ'), bg: '#eceae6', fg: '#8a8078', accent: '#8a8078', kind: 'لم يبدأ' },
    { icon: 'pin', label: rl('المتأخرة', 'Overdue'), value: cnt('متأخر'), bg: '#f7e6e4', fg: '#b0433b', accent: '#b0433b', kind: 'متأخر' },
    { icon: 'shield', label: rl('تحتاج دعم رئيس القطاع', 'Need your support'), value: supCount, bg: '#fbf3df', fg: '#c9a24b', accent: '#c9a24b', kind: 'support' },
  ];

  const kpiClick = (kind: string) => {
    if (kind === 'support') { setStatus(''); setSupport(true); }
    else if (kind === 'all') { setStatus(''); setSupport(false); }
    else { setStatus(kind); setSupport(false); }
    setTimeout(() => document.getElementById('mt-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 70);
  };

  // ---- filtering ----
  const mq = mtSearch.trim();
  const filtered = monthTasks.filter((tk) => {
    if (mtStatus && tk.status !== mtStatus) return false;
    if (mtOwner && tk.owner !== mtOwner) return false;
    if (mtDept && tk.dept !== mtDept) return false;
    if (mtSupport && !mtNeedsSupport(tk)) return false;
    if (mq && !(tk.task.includes(mq) || tk.meeting.includes(mq) || tk.owner.includes(mq))) return false;
    return true;
  });
  const shown = filtered.slice(0, mtLimit);
  const hasMore = filtered.length > mtLimit;

  // ---- grouping (by meeting|date|dept) ----
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; meeting: string; dept: string; mDate: string; tasks: MinuteTask[] }>();
    shown.forEach((r) => {
      const k = r.meeting + '|' + r.mDate + '|' + r.dept;
      if (!m.has(k)) m.set(k, { key: k, meeting: r.meeting, dept: r.dept, mDate: r.mDate, tasks: [] });
      m.get(k)!.tasks.push(r);
    });
    const span = 7 + (mtDetailed ? 5 : 0);
    return [...m.values()].map((g) => {
      const raw = g.tasks.map((x) => x.status);
      const st = raw.every((s) => s === 'مكتمل') ? 'مكتمل' : (raw.some((s) => s === 'متأخر') ? 'متأخر' : 'قيد التنفيذ');
      const [stBg, stFg] = GS[st] || GS['قيد التنفيذ'];
      return { ...g, span, status: st, stBg, stFg, count: g.tasks.length };
    });
  }, [shown, mtDetailed]);

  const supportTasks = monthTasks.filter(mtNeedsSupport);

  // ---- filter dropdown options ----
  const statusOpts = [{ v: '', label: t('allStatuses') }].concat(MT_STATUSES.map((s) => ({ v: s, label: tr(s) })));
  const ownerOpts = [{ v: '', label: rl('كل المسؤولين', 'All owners') }].concat(
    [...new Set(monthTasks.map((tk) => tk.owner))].map((o) => ({ v: o, label: tr(o) }))
  );
  const deptOpts = [{ v: '', label: rl('كل الجهات', 'All departments') }].concat(
    [...new Set(monthTasks.map((tk) => tk.dept))].map((o) => ({ v: o, label: tr(o) }))
  );
  const monthOpts = monthsAll.map((k) => ({ v: k, label: mtMonLabel(k, lang) }));

  // ---- mutations ----
  const setTaskStatus = (id: string, val: string) => mutate((d) => {
    const tk = d.mtasks.find((x) => x.id === id); if (tk) tk.status = val;
  });
  const openDirective = (id: string) => { setDirModalId(id); setDirDraft(''); };
  const saveDirective = () => {
    const txt = dirDraft.trim(); if (!dirModalId || !txt) return;
    mutate((d) => {
      const tk = d.mtasks.find((x) => x.id === dirModalId);
      if (tk) { tk.directives = tk.directives || []; tk.directives.push({ text: txt, date: 'اليوم' }); }
    });
    setDirModalId(null); setDirDraft('');
    showToast(rl('تم حفظ التوجيه في سجل المهمة', 'Directive saved to the task log'));
  };
  const requestUpdate = () => showToast(rl('تم إرسال طلب تحديث إلى المسؤول عن المهمة', 'Update request sent to the task owner'));
  const markReviewed = (id: string) => {
    let now = false;
    mutate((d) => { const tk = d.mtasks.find((x) => x.id === id); if (tk) { tk.reviewed = !tk.reviewed; now = tk.reviewed; } });
    showToast(now ? rl('تم وضع علامة تمت المراجعة', 'Marked as reviewed') : rl('أُلغيت علامة المراجعة', 'Review mark removed'));
  };

  const disp = (v: string | undefined) => (v && v.trim() ? tr(v) : '—');
  const dueColorOf = (tk: MinuteTask) => (tk.status === 'متأخر' ? '#b0433b' : '#8a938c');

  const monLabel = mtMonLabel(curMonth, lang);
  const tableTitle = rl('جدول المهام لشهر ' + monLabel, 'Tasks for ' + monLabel);
  const detailBtnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (mtDetailed ? '#1f4a37' : '#e2e6df'), background: mtDetailed ? '#e9f0ec' : '#f7f8f6', color: mtDetailed ? '#1f4a37' : '#7d867f',
  };
  const supportBtnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (mtSupport ? '#c9a24b' : '#e2e6df'), background: mtSupport ? '#fbf3df' : '#f7f8f6', color: mtSupport ? '#8a6a1f' : '#7d867f',
  };
  const stepBtn = (on: boolean): CSSProperties => ({
    width: 34, height: 34, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, border: '1px solid #e2e6df', background: '#ffffff',
    color: on ? '#1f4a37' : '#c8cec6', cursor: on ? 'pointer' : 'default', fontFamily: 'inherit',
  });

  const thStyle: CSSProperties = { textAlign: 'start', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#8a938c', borderBottom: '1px solid #eef0ec', whiteSpace: 'nowrap' };

  const selTask = selMtask ? mtasks.find((x) => x.id === selMtask) || null : null;

  return (
    <Fade>
      {/* KPI summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12, marginBottom: 22 }} className="rg5">
        {kpis.map((k) => {
          const active = k.kind === 'support' ? mtSupport : (k.kind === 'all' ? (!mtStatus && !mtSupport) : mtStatus === k.kind);
          return (
            <div key={k.kind} onClick={() => kpiClick(k.kind)} style={{
              background: '#ffffff', borderRadius: 18, boxShadow: `0 2px 6px rgba(23,40,32,.04),0 14px 34px -22px rgba(23,40,32,${active ? '.26' : '.14'})`,
              padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 15, transition: 'box-shadow .15s,transform .15s',
              outline: active ? `2px solid ${k.accent}` : 'none', outlineOffset: active ? -2 : 0, transform: active ? 'translateY(-2px)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.fg }}>
                  <Icon name={k.icon} size={19} strokeWidth={1.8} />
                </span>
                <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: '#17211c' }}>{k.value}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#5b6b62', fontWeight: 600, lineHeight: 1.4 }}>{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* tasks table */}
      <div id="mt-table-section" style={{ background: '#ffffff', border: 'none', borderRadius: 22, boxShadow: CARD_SHADOW, padding: '22px 24px', marginBottom: 30 }}>
        {/* title + month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: '#e9f0ec', color: '#1f4a37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="list" size={17} strokeWidth={1.8} />
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{tableTitle}</h3>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button title={rl('شهر أقدم', 'Older month')} onClick={() => { if (canOlder) setMonth(monthsAll[curIdx + 1]); }} style={stepBtn(canOlder)}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <Dropdown value={curMonth} options={monthOpts} onChange={(v) => setMonth(v)} opt={{ size: 'sm', minWidth: '150px' }} />
            <button title={rl('شهر أحدث', 'Newer month')} onClick={() => { if (canNewer) setMonth(monthsAll[curIdx - 1]); }} style={stepBtn(canNewer)}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            {curIdx > 0 && (
              <button onClick={() => setMonth(monthsAll[0])} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, border: '1px solid #e2e6df', background: '#f7f8f6', color: '#1f4a37', borderRadius: 10, padding: '0 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {rl('الأحدث', 'Latest')}
              </button>
            )}
          </div>
        </div>

        {/* filters */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={2} style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={mtSearch} onChange={(e) => setSearch(e.target.value)} placeholder={t('mt_search')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', paddingInlineStart: 34, fontSize: 12.5, fontFamily: 'inherit' }} />
          </div>
          <Dropdown value={mtStatus} options={statusOpts} onChange={setStatus} opt={{ size: 'sm', minWidth: '118px' }} />
          <Dropdown value={mtOwner} options={ownerOpts} onChange={setOwner} opt={{ size: 'sm', minWidth: '120px' }} />
          <Dropdown value={mtDept} options={deptOpts} onChange={setDept} opt={{ size: 'sm', minWidth: '120px' }} />
          <button onClick={() => setSupport(!mtSupport)} style={supportBtnStyle}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7v6c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7z" /></svg>
            {t('mt_onlySupport')}
          </button>
          <button onClick={() => setDetailed(!mtDetailed)} style={detailBtnStyle}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>
            {mtDetailed ? rl('عرض مختصر', 'Concise view') : rl('عرض مفصّل', 'Detailed view')}
          </button>
          <button onClick={() => { setSearch(''); setStatus(''); setOwner(''); setDept(''); setSupport(false); }} style={{ border: '1px solid #e2e6df', background: '#ffffff', color: '#7d867f', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('mt_clear')}
          </button>
        </div>

        {/* table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
            <thead>
              <tr>
                <th style={thStyle}>{t('mt_mDate')}</th>
                <th style={thStyle}>{t('mt_meeting')}</th>
                <th style={thStyle}>{t('mt_task')}</th>
                <th style={thStyle}>{t('mt_owner')}</th>
                {mtDetailed && <th style={thStyle}>{t('mt_prereq')}</th>}
                {mtDetailed && <th style={thStyle}>{t('mt_support')}</th>}
                {mtDetailed && <th style={thStyle}>{t('mt_budget')}</th>}
                <th style={thStyle}>{t('mt_due')}</th>
                <th style={thStyle}>{t('mt_status')}</th>
                {mtDetailed && <th style={thStyle}>{t('mt_deps')}</th>}
                {mtDetailed && <th style={thStyle}>{t('mt_notes')}</th>}
                <th style={thStyle}>{t('mt_markReviewed')}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.key} g={g} tr={tr} dl={dl} rl={rl}
                  detailed={mtDetailed}
                  canDirect={canDirect} canReview={canReview} canStatus={canStatus}
                  disp={disp} dueColorOf={dueColorOf}
                  onOpen={setSelMtask} onDirective={openDirective} onReviewed={markReviewed} onStatus={setTaskStatus}
                  tDir={t('mt_dirCount')} tAdd={t('mt_addDirective')} tRev={t('mt_markReviewed')} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9aa39b', fontSize: 13 }}>{t('mt_noResults')}</div>
          )}
        </div>

        {hasMore && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 12px 4px' }}>
            <button onClick={() => setLimit(mtLimit + 12)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#1f4a37', borderRadius: 10, padding: '10px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              {rl('عرض المزيد', 'Show more')}
            </button>
            <span style={{ fontSize: 11.5, color: '#9aa39b' }}>
              {rl('عرض ' + shown.length + ' من ' + filtered.length, 'Showing ' + shown.length + ' of ' + filtered.length)}
            </span>
          </div>
        )}
      </div>

      {/* tasks needing chief support */}
      {supportTasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: '#fbf0d6', color: '#a9791f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7v6c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
            </span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('mt_needSupport')}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
            {supportTasks.map((tk) => {
              const [sb, sf] = MTS[tk.status] || ['#eee', '#555'];
              const reason = tk.status === 'متأخر'
                ? rl('المهمة متأخرة عن موعدها', 'Task is overdue')
                : rl('لم يُحدَّد تاريخ إنجاز — تحتاج توجيه رئيس القطاع للأولوية', 'No due date set — needs the Sector Head’s prioritisation');
              return (
                <div key={tk.id} style={{ background: '#ffffff', border: '1px solid #edf0ea', borderRadius: 14, boxShadow: '0 1px 3px rgba(23,40,32,.05),0 10px 26px -18px rgba(23,40,32,.14)', padding: '14px 15px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', background: sb, color: sf }}>{tr(tk.status)}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 600, borderRadius: 20, padding: '3px 9px', background: '#eef3f0', color: '#2b5c44', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{tr(tk.dept)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45, marginBottom: 10 }}>{tr(tk.task)}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: '#fbf7ec', borderRadius: 10, padding: '9px 11px', marginBottom: 11 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#a9791f" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}><path d="M12 2 3 7v6c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7z" /><path d="M12 9v4M12 16h.01" /></svg>
                    <div>
                      <div style={{ fontSize: 10, color: '#a9791f', fontWeight: 700, marginBottom: 2 }}>{t('mt_supportReason')}</div>
                      <div style={{ fontSize: 11.5, color: '#5b4a1f', lineHeight: 1.5 }}>{reason}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10.5, color: '#8a938c', paddingBottom: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Avatar name={tk.owner} size={22} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#3c4a42' }}>{tr(tk.owner)}</span>
                    </span>
                    <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, color: dueColorOf(tk), fontWeight: 600 }}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>
                      {dl(tk.due)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f2f4f0', paddingTop: 10 }}>
                    {canDirect && (
                      <button onClick={() => openDirective(tk.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: 8, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        {t('mt_addDirective')}
                      </button>
                    )}
                    {canReview && (
                      <button onClick={requestUpdate} title={t('mt_requestUpdate')} style={{ width: 34, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef3f6', color: '#2f6aa8', border: '1px solid #d8e4ee', borderRadius: 9, padding: 8, cursor: 'pointer' }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* task detail drawer */}
      <Drawer open={!!selTask} onClose={() => setSelMtask(null)} width={468}>
        {selTask && (
          <MtaskDrawerBody tk={selTask} tr={tr} dl={dl} rl={rl} t={t}
            canDirect={canDirect} canReview={canReview}
            onDirective={() => openDirective(selTask.id)} onRequestUpdate={requestUpdate} onReviewed={() => markReviewed(selTask.id)}
            onClose={() => setSelMtask(null)} disp={disp} dueColorOf={dueColorOf} />
        )}
      </Drawer>

      {/* add-directive modal */}
      <Modal open={!!dirModalId} onClose={() => setDirModalId(null)} width={460} padded={false}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #eef0ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('mt_dirTitle')}</h2>
          <button onClick={() => setDirModalId(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15 }}>✕</button>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <textarea value={dirDraft} onChange={(e) => setDirDraft(e.target.value)} rows={4} placeholder={t('mt_dirPh')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', borderRadius: 9, padding: '11px 13px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #eef0ec', display: 'flex', gap: 10 }}>
          <button onClick={saveDirective} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('mt_save')}</button>
          <button onClick={() => setDirModalId(null)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#5b6b62', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{t('mt_cancel')}</button>
        </div>
      </Modal>
      <SectionAddButton section="minuteTasks" />
    </Fade>
  );
}

// ---- group header + task rows ----
interface GroupRowsProps {
  g: { key: string; meeting: string; dept: string; mDate: string; span: number; status: string; stBg: string; stFg: string; count: number; tasks: MinuteTask[] };
  tr: (s: string) => string; dl: (s: string) => string; rl: (a: string, b: string) => string;
  detailed: boolean;
  canDirect: boolean; canReview: boolean; canStatus: boolean;
  disp: (v: string | undefined) => string; dueColorOf: (tk: MinuteTask) => string;
  onOpen: (id: string) => void; onDirective: (id: string) => void; onReviewed: (id: string) => void; onStatus: (id: string, v: string) => void;
  tDir: string; tAdd: string; tRev: string;
}

function GroupRows(p: GroupRowsProps) {
  const { g, tr, dl, rl, detailed, disp, dueColorOf } = p;
  const tdBase: CSSProperties = { padding: 12, borderBottom: '1px solid #f4f6f2', verticalAlign: 'top', color: '#3c4a42' };
  const countLabel = g.count === 1 ? rl('مهمة واحدة', '1 task') : (g.count + ' ' + rl('مهام', 'tasks'));
  return (
    <>
      <tr>
        <td colSpan={g.span} style={{ padding: '12px 14px', background: '#f3f7f3', borderTop: '1px solid #e6ece7', borderBottom: '1px solid #e6ece7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', fontSize: 11, fontWeight: 700, color: '#1f4a37', background: '#e4efe7', borderRadius: 8, padding: '5px 10px' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>
              {dl(g.mDate)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#17211c', lineHeight: 1.4 }}>{tr(g.meeting)}</div>
              <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{tr(g.dept)}</div>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: g.stFg, background: g.stBg, borderRadius: 20, padding: '5px 12px' }}>{tr(g.status)}</span>
            <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: '#8a6a1f', background: '#fbf3df', borderRadius: 20, padding: '5px 12px' }}>{countLabel}</span>
          </div>
        </td>
      </tr>
      {g.tasks.map((a) => {
        const [sb, sf] = MTS[a.status] || ['#eee', '#555'];
        const dirCount = (a.directives || []).length;
        return (
          <tr key={a.id}>
            <td style={tdBase} />
            <td style={{ ...tdBase, textAlign: 'center' }}><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#c3cec4' }} /></td>
            <td onClick={() => p.onOpen(a.id)} style={{ ...tdBase, lineHeight: 1.55, maxWidth: 340, cursor: 'pointer' }}>
              {tr(a.task)}
              {dirCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 600, color: '#1f4a37', background: '#e9f0ec', borderRadius: 6, padding: '2px 8px' }}>{dirCount} {p.tDir}</span>
              )}
            </td>
            <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>{tr(a.owner)}</td>
            {detailed && <td style={{ ...tdBase, maxWidth: 190, lineHeight: 1.5 }}>{disp(a.prerequisite)}</td>}
            {detailed && <td style={{ ...tdBase, maxWidth: 190, lineHeight: 1.5 }}>{disp(a.support)}</td>}
            {detailed && <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>{disp(a.budget)}</td>}
            <td style={{ ...tdBase, whiteSpace: 'nowrap' }}><span style={{ fontSize: 12, color: dueColorOf(a) }}>{dl(a.due)}</span></td>
            <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
              {p.canStatus
                ? <Dropdown value={a.status} options={MT_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => p.onStatus(a.id, v)} opt={{ size: 'sm', bg: sb, color: sf, weight: 700, borderColor: 'transparent', block: true }} />
                : <Badge bg={sb} fg={sf}>{tr(a.status)}</Badge>}
            </td>
            {detailed && <td style={{ ...tdBase, maxWidth: 190, lineHeight: 1.5 }}>{disp(a.dependencies)}</td>}
            {detailed && <td style={{ ...tdBase, maxWidth: 220, lineHeight: 1.5 }}>{disp(a.notes)}</td>}
            <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {p.canDirect && (
                  <button onClick={() => p.onDirective(a.id)} title={p.tAdd} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f4f0', border: '1px solid #e2e6df', borderRadius: 8, color: '#1f4a37', cursor: 'pointer' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                )}
                {p.canReview && (
                  <button onClick={() => p.onReviewed(a.id)} title={p.tRev} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.reviewed ? '#e2f0e8' : '#f2f4f0', border: '1px solid #e2e6df', borderRadius: 8, color: '#2e7d55', cursor: 'pointer' }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ---- drawer body ----
interface DrawerBodyProps {
  tk: MinuteTask; tr: (s: string) => string; dl: (s: string) => string; rl: (a: string, b: string) => string; t: (k: string) => string;
  canDirect: boolean; canReview: boolean;
  onDirective: () => void; onRequestUpdate: () => void; onReviewed: () => void; onClose: () => void;
  disp: (v: string | undefined) => string; dueColorOf: (tk: MinuteTask) => string;
}

function MtaskDrawerBody(p: DrawerBodyProps) {
  const { tk, tr, dl, t, disp, dueColorOf } = p;
  const [sb, sf] = MTS[tk.status] || ['#eee', '#555'];
  const field = (label: string, value: string, strong = false, color = '#17211c') => (
    <div style={{ flex: 1, minWidth: 140, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6d7973', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: strong ? 700 : 600, color }}>{value}</div>
    </div>
  );
  const block = (label: string, value: string) => (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6d7973', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: '#17211c', lineHeight: 1.7 }}>{value}</div>
    </div>
  );
  return (
    <>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0ec' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: sb, color: sf }}>{tr(tk.status)}</span>
          <button onClick={p.onClose} style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15 }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 4 }}>{tr(tk.meeting)} · {dl(tk.mDate)}</div>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#17211c', lineHeight: 1.6 }}>{tr(tk.task)}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {p.canDirect && (
            <button onClick={p.onDirective} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {t('mt_addDirective')}
            </button>
          )}
          {p.canReview && (
            <button onClick={p.onRequestUpdate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef3f6', border: '1px solid #d8e4ee', color: '#2f6aa8', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
              {t('mt_requestUpdate')}
            </button>
          )}
          {p.canReview && (
            <button onClick={p.onReviewed} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e2f0e8', border: '1px solid #cfe6d8', color: '#1f7a4d', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {t('mt_markReviewed')}
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {field(t('mt_owner'), tr(tk.owner))}
          {field(t('mt_dept'), tr(tk.dept))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {field(t('mt_due'), dl(tk.due), true, dueColorOf(tk))}
          {field(t('mt_budget'), disp(tk.budget))}
        </div>
        {block(t('mt_prereq'), disp(tk.prerequisite))}
        {block(t('mt_deps'), disp(tk.dependencies))}
        <div style={{ background: '#fbf3df', border: '1px solid #efe0be', borderRadius: 11, padding: '11px 13px' }}>
          <div style={{ fontSize: 10.5, color: '#c9a24b', marginBottom: 4, fontWeight: 700 }}>{t('mt_support')}</div>
          <div style={{ fontSize: 12.5, color: '#8a6a1f', lineHeight: 1.6 }}>{disp(tk.support)}</div>
        </div>
        {block(t('mt_notes'), disp(tk.notes))}
      </div>
    </>
  );
}
