import { useState, type CSSProperties } from 'react';
import { Fade, Avatar, Modal, Drawer } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { DateField } from '../components/DateField';
import { useI18n } from '../i18n/i18n';
import { useStore } from '../store/store';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useToast } from '../components/Toast';
import { AR_MONTHS } from '../shared/constants';
import { parseAr, pad2 } from '../shared/helpers';
import type { OfficeTask } from '../data/types';

/* Office-task status colours (ported from the prototype's local OTS map;
   var(--cXXXXXX,#hex) collapsed to #hex). */
const OTS: Record<string, [string, string]> = {
  'لم يبدأ': ['#eceae6', '#8a8078'],
  'قيد التنفيذ': ['#fbf0d6', '#a9791f'],
  'بانتظار اعتماد': ['#e6eef6', '#3a6ea5'],
  'يحتاج توجيه': ['#f7ece0', '#c26a2b'],
  'مكتمل': ['#e2f0e8', '#2e7d55'],
  'متأخر': ['#f7e6e4', '#b0433b'],
};

const PROG: Record<string, number> = {
  'لم يبدأ': 6, 'يحتاج توجيه': 35, 'متأخر': 45,
  'قيد التنفيذ': 60, 'بانتظار اعتماد': 80, 'مكتمل': 100,
};

const O_STATUS_LIST = ['لم يبدأ', 'قيد التنفيذ', 'بانتظار اعتماد', 'يحتاج توجيه', 'مكتمل', 'متأخر'];

/** Prototype "today" anchors: TODAY = 5 Jul 2026, WEEKEND = 12 Jul 2026. */
const TODAY = new Date(2026, 6, 5);
const WEEKEND = new Date(2026, 6, 12);
const TODAY_AR = '15 يوليو 2026';

const noDueOf = (tk: OfficeTask) => !tk.due || !String(tk.due).trim();

function isoFromAr(s: string): string {
  const d = parseAr(s);
  if (!d) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function arFromIso(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return d + ' ' + AR_MONTHS[m - 1] + ' ' + y;
}

type ViewMode = 'board' | 'timeline' | 'table';
type OModal = { type: 'deadline' | 'directive'; id: string } | null;

export function OfficeTasks() {
  const { t, tr, dl, lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const { showToast } = useToast();

  const canEdit = cu.type === 'chair' || can(cu, 'myTasks', 'edit');
  const isChair = cu.type === 'chair';
  const memberEdit = !isChair && can(cu, 'myTasks', 'edit');
  const canAdd = !isChair && (can(cu, 'myTasks', 'add') || can(cu, 'myTasks', 'edit'));
  const canDrag = isChair || memberEdit;
  const [taskForm, setTaskForm] = useState<{ id: string | null } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [oSearch, setOSearch] = useState('');
  const [oStatus, setOStatus] = useState('');
  const [oOwner, setOOwner] = useState('');
  const [oLate, setOLate] = useState(false);
  const [oNoDue, setONoDue] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selOtask, setSelOtask] = useState<string | null>(null);
  const [oModal, setOModal] = useState<OModal>(null);
  const [dlDate, setDlDate] = useState('');
  const [dlNote, setDlNote] = useState('');
  const [dirNote, setDirNote] = useState('');

  const otasks = data.otasks;

  // ---- decorate (display + computed) ----
  const decorate = (tk: OfficeTask) => {
    const [bg, fg] = OTS[tk.status] || ['#eceeeb', '#6d7973'];
    const nd = noDueOf(tk);
    const late = tk.status === 'متأخر';
    const mid = (tk.status === 'يحتاج توجيه' || tk.status === 'بانتظار اعتماد' || nd) && tk.status !== 'مكتمل';
    return {
      id: tk.id,
      status: tk.status,
      due: tk.due,
      noDue: nd,
      ownerRaw: tk.owner,
      title: tr(tk.title),
      desc: tr(tk.desc),
      dept: tr(tk.dept),
      owner: tr(tk.owner),
      statusLabel: tr(tk.status),
      lastUpdate: tk.lastUpdate ? dl(tk.lastUpdate) : '—',
      dueLabel: nd ? rl('لم يُحدَّد', 'Not set') : dl(tk.due),
      dueColor: nd ? '#b0433b' : '#2e7d55',
      prog: PROG[tk.status] ?? 30,
      _bg: bg,
      _fg: fg,
      accent: fg,
      isDone: tk.status === 'مكتمل',
      notDone: tk.status !== 'مكتمل',
      prLabel: late ? rl('عالية', 'High') : mid ? rl('متوسطة', 'Medium') : rl('منخفضة', 'Low'),
      prBg: late ? '#faf0ef' : mid ? '#fbf7ee' : '#f0f2ee',
      prFg: late ? '#b0433b' : mid ? '#a9791f' : '#8a938c',
    };
  };
  type Dec = ReturnType<typeof decorate>;

  // ---- filter (on raw, like the prototype) ----
  const oq = oSearch.trim();
  const filtered = otasks.filter((tk) => {
    if (oStatus && tk.status !== oStatus) return false;
    if (oOwner && tk.owner !== oOwner) return false;
    if (oLate && tk.status !== 'متأخر') return false;
    if (oNoDue && !(noDueOf(tk) && tk.status !== 'مكتمل')) return false;
    if (oq && !(tk.title.includes(oq) || tk.desc.includes(oq) || tk.owner.includes(oq))) return false;
    return true;
  });
  const rows: Dec[] = filtered.map(decorate);

  // ---- board columns (final 5-column set) ----
  const colDefs: { key: string; label: string; dot: string; match: (r: Dec) => boolean }[] = [
    { key: 'nodue', label: rl('بدون موعد نهائي', 'No deadline'), dot: '#7a4d94', match: (r) => r.status !== 'مكتمل' && r.noDue },
    { key: 'inprogress', label: rl('قيد التنفيذ', 'In progress'), dot: '#a9791f', match: (r) => (r.status === 'قيد التنفيذ' || r.status === 'يحتاج توجيه' || r.status === 'بانتظار اعتماد') && !r.noDue },
    { key: 'late', label: rl('متأخر', 'Overdue'), dot: '#b0433b', match: (r) => r.status === 'متأخر' && !r.noDue },
    { key: 'notstarted', label: rl('لم يبدأ', 'Not started'), dot: '#9aa39b', match: (r) => r.status === 'لم يبدأ' && !r.noDue },
    { key: 'done', label: rl('مكتمل', 'Completed'), dot: '#2e7d55', match: (r) => r.status === 'مكتمل' },
  ];
  const columns = colDefs.map((c) => { const list = rows.filter(c.match); return { ...c, count: list.length, tasks: list, isEmpty: list.length === 0 }; });

  // ---- timeline buckets ----
  const tlDefs: { key: string; label: string; accent: string; bg: string }[] = [
    { key: 'overdue', label: rl('مهام متأخرة', 'Overdue tasks'), accent: '#b0433b', bg: '#faf0ef' },
    { key: 'week', label: rl('مستحقة هذا الأسبوع', 'Due this week'), accent: '#a9791f', bg: '#fbf7ee' },
    { key: 'upcoming', label: rl('مهام قادمة', 'Upcoming tasks'), accent: '#3a6ea5', bg: '#eef3f9' },
    { key: 'nodue', label: rl('بدون موعد نهائي', 'No deadline'), accent: '#7a4d94', bg: '#f6f1fa' },
  ];
  const tlBucket = (r: Dec): string | null => {
    if (r.status === 'مكتمل') return null;
    if (r.status === 'متأخر') return 'overdue';
    if (r.noDue) return 'nodue';
    const d = parseAr(r.due);
    if (!d) return 'upcoming';
    if (d < TODAY) return 'overdue';
    if (d <= WEEKEND) return 'week';
    return 'upcoming';
  };
  const timeline = tlDefs.map((g) => { const list = rows.filter((r) => tlBucket(r) === g.key); return { ...g, count: list.length, tasks: list, isEmpty: list.length === 0 }; });
  const doneCount = rows.filter((r) => r.status === 'مكتمل').length;

  // ---- filter dropdown options ----
  const statusOpts = [{ v: '', label: t('allStatuses') }].concat(O_STATUS_LIST.map((s) => ({ v: s, label: tr(s) })));
  const statusSetOpts = O_STATUS_LIST.map((s) => ({ v: s, label: tr(s) }));
  const ownerOpts = [{ v: '', label: rl('كل المسؤولين', 'All owners') }].concat([...new Set(otasks.map((tk) => tk.owner))].map((o) => ({ v: o, label: tr(o) })));

  // ---- mutations ----
  const setStatus = (id: string, v: string) => mutate((d) => { const tk = d.otasks.find((x) => x.id === id); if (tk) { tk.status = v; tk.lastUpdate = TODAY_AR; } });
  const reqUpdate = () => showToast(rl('تم إرسال طلب تحديث للمسؤول', 'Update request sent to the owner'));
  const markComplete = (id: string) => {
    mutate((d) => { const tk = d.otasks.find((x) => x.id === id); if (tk) { tk.status = 'مكتمل'; tk.lastUpdate = TODAY_AR; } });
    showToast(rl('تم وضع علامة الاكتمال', 'Task marked complete'));
  };
  const openModal = (type: 'deadline' | 'directive', id: string) => {
    const tk = otasks.find((x) => x.id === id);
    setDlDate(tk ? isoFromAr(tk.end) : '');
    setDlNote('');
    setDirNote('');
    setOModal({ type, id });
  };
  const saveDeadline = () => {
    if (!oModal || !dlDate) return;
    const ar = arFromIso(dlDate);
    const note = dlNote.trim();
    mutate((d) => {
      const tk = d.otasks.find((x) => x.id === oModal.id);
      if (!tk) return;
      tk.end = ar;
      tk.due = ar;
      tk.lastUpdate = TODAY_AR;
      (tk.directives ||= []).push({ text: rl('تحديد تاريخ النهاية: ', 'End date set: ') + ar + (note ? ' — ' + note : ''), date: TODAY_AR });
    });
    setOModal(null);
    showToast(rl('تم تحديث تاريخ النهاية', 'End date updated'));
  };
  const saveDirective = () => {
    if (!oModal) return;
    const note = dirNote.trim();
    if (!note) return;
    mutate((d) => {
      const tk = d.otasks.find((x) => x.id === oModal.id);
      if (!tk) return;
      (tk.directives ||= []).push({ text: note, date: TODAY_AR });
      tk.lastUpdate = TODAY_AR;
    });
    setOModal(null);
    showToast(rl('تمت إضافة التوجيه', 'Directive added'));
  };

  // ---- shared inline styles ----
  const tab = (on: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9,
    padding: '8px 15px', fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: 'pointer',
    fontFamily: 'inherit', background: on ? '#1e4634' : 'transparent', color: on ? '#fff' : '#5b6b62',
  });
  const lateBtnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '9px 13px', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (oLate ? '#b0433b' : '#e2e6df'),
    background: oLate ? '#faf0ef' : '#f7f8f6', color: oLate ? '#b0433b' : '#7d867f',
  };
  const noDueBtnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '9px 13px', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid ' + (oNoDue ? '#7a4d94' : '#e2e6df'),
    background: oNoDue ? '#f3ecf6' : '#f7f8f6', color: oNoDue ? '#7a4d94' : '#7d867f',
  };

  const calIcon = (w = 11) => (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </svg>
  );

  const detail = selOtask ? otasks.find((x) => x.id === selOtask) : null;

  return (
    <Fade>
      {/* PAGE HEADER with in-page add button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{isChair ? rl('مهام فريق المكتب', 'Office team tasks') : rl('مهامي', 'My tasks')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('متابعة مهام المكتب وتحديث حالاتها', 'Track office tasks and update their statuses')}</p>
        </div>
        {canAdd && (
          <button type="button" onClick={() => setTaskForm({ id: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.55)', flex: 'none' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {rl('إضافة مهمة', 'Add task')}
          </button>
        )}
      </div>

      {/* filters (mobile toggle button) */}
      <button className="fbtn" onClick={() => setFiltersOpen((v) => !v)}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="17" x2="14" y2="17" /></svg>
        <span>{rl('الفلاتر', 'Filters')}</span>
        <svg className="fchev" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ marginInlineStart: 'auto', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>

      <div className={'mfbar' + (filtersOpen ? '' : ' collapsed')} style={{ background: '#ffffff', border: 'none', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 12px 30px -16px rgba(23,40,32,.14)', padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={2} style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={oSearch} onChange={(e) => setOSearch(e.target.value)} placeholder={t('ot_search')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', paddingInlineStart: 34, fontSize: 12.5, fontFamily: 'inherit' }} />
        </div>
        <Dropdown value={oOwner} options={ownerOpts} onChange={setOOwner} opt={{ size: 'sm', minWidth: '120px' }} />
        <Dropdown value={oStatus} options={statusOpts} onChange={setOStatus} opt={{ size: 'sm', minWidth: '118px' }} />
        <button onClick={() => setOLate((v) => !v)} style={lateBtnStyle}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{t('ot_onlyLate')}
        </button>
        <button onClick={() => setONoDue((v) => !v)} style={noDueBtnStyle}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>{t('ot_onlyNoDue')}
        </button>
        <button onClick={() => { setOSearch(''); setOStatus(''); setOOwner(''); setOLate(false); setONoDue(false); }} style={{ border: '1px solid #e2e6df', background: '#ffffff', color: '#7d867f', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('ot_clear')}</button>
      </div>

      {/* view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, background: '#ffffff', borderRadius: 12, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 12px 30px -16px rgba(23,40,32,.14)', padding: 6, width: 'fit-content' }}>
        <button onClick={() => setViewMode('board')} style={tab(viewMode === 'board')}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /></svg>{t('ot_viewBoard')}
        </button>
        <button onClick={() => setViewMode('timeline')} style={tab(viewMode === 'timeline')}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M6 12h15M9 18h12" /><circle cx="3.5" cy="12" r="1" /><circle cx="6.5" cy="18" r="1" /></svg>{t('ot_viewTimeline')}
        </button>
        <button onClick={() => setViewMode('table')} style={tab(viewMode === 'table')}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16" /></svg>{t('ot_viewTable')}
        </button>
      </div>

      {/* BOARD VIEW */}
      {viewMode === 'board' && (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 12, alignItems: 'flex-start', height: 640 }}>
          {columns.map((c) => (
            <div key={c.key}
              onDragOver={canDrag ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(c.key); } : undefined}
              onDragLeave={canDrag ? () => setDragOverCol((v) => (v === c.key ? null : v)) : undefined}
              onDrop={canDrag ? (e) => {
                e.preventDefault(); setDragOverCol(null);
                const tid = e.dataTransfer.getData('text/plain'); if (!tid) return;
                const tk = data.otasks.find((x) => x.id === tid); if (!tk) return;
                const cur = rows.find((r) => r.id === tid);
                if (cur && c.match(cur)) return; // dropped on its own column
                const wasNoDue = noDueOf(tk);
                mutate((d) => {
                  const r = d.otasks.find((x) => x.id === tid); if (!r) return;
                  if (c.key === 'nodue') { r.due = ''; r.end = ''; if (r.status === 'مكتمل') r.status = 'قيد التنفيذ'; }
                  else if (c.key === 'done') { r.status = 'مكتمل'; }
                  else { r.status = c.key === 'inprogress' ? 'قيد التنفيذ' : c.key === 'late' ? 'متأخر' : 'لم يبدأ'; }
                  r.lastUpdate = rl('اليوم', 'Today');
                });
                if (c.key !== 'nodue' && c.key !== 'done' && wasNoDue) {
                  openModal('deadline', tid);
                  showToast(rl('حدّد الموعد النهائي لتظهر المهمة في عمود «' + c.label + '»', 'Set a deadline so the task appears under “' + c.label + '”'));
                } else {
                  showToast(rl('تم نقل المهمة إلى «' + c.label + '»', 'Task moved to “' + c.label + '”'));
                }
              } : undefined}
              style={{ flex: 'none', width: 288, background: dragOverCol === c.key ? '#e7efe6' : '#f4f6f2', outline: dragOverCol === c.key ? '2px dashed #2b5c44' : 'none', outlineOffset: -2, borderRadius: 16, padding: '12px 12px 6px', maxHeight: '100%', display: 'flex', flexDirection: 'column', transition: 'background .12s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 12px', flex: 'none' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.dot, flex: 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2a332d' }}>{c.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7d867f', background: '#e7ebe3', borderRadius: 20, padding: '2px 9px', marginInlineStart: 'auto' }}>{c.count}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingBottom: 6 }}>
                {c.tasks.map((a) => (
                  <div key={a.id}
                    draggable={canDrag}
                    onDragStart={canDrag ? (e) => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                    style={{ background: '#ffffff', border: '1px solid #edf0ea', borderRadius: 14, boxShadow: '0 1px 3px rgba(23,40,32,.05)', padding: '13px 14px', display: 'flex', flexDirection: 'column', cursor: canDrag ? 'grab' : 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 600, borderRadius: 20, padding: '3px 9px', background: a.prBg, color: a.prFg }}>{a.prLabel}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 600, borderRadius: 20, padding: '3px 9px', background: '#eef3f0', color: '#2b5c44', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 155 }}>{a.dept}</span>
                    </div>
                    <div onClick={() => setSelOtask(a.id)} style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45, marginBottom: 10, cursor: 'pointer' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 10.5, color: '#9aa39b' }}>{t('progress')}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#17211c' }}>{a.prog}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 4, background: '#eef0ec', overflow: 'hidden', marginBottom: 11 }}>
                      <div style={{ height: '100%', borderRadius: 4, background: a.accent, width: a.prog + '%' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10.5, color: '#8a938c', paddingBottom: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <Avatar name={a.ownerRaw} size={20} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.owner}</span>
                      </span>
                      <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, color: a.dueColor, fontWeight: 600 }}>{calIcon(11)}{a.dueLabel}</span>
                    </div>
                    {a.notDone ? (
                      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f2f4f0', paddingTop: 9 }}>
                        <button onClick={() => setSelOtask(a.id)} title={t('pv_openBtn')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: 7, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>{t('pv_openBtn')}
                        </button>
                        {isChair && (
                          <button onClick={reqUpdate} title={t('ot_requestUpdate')} style={{ width: 32, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f2', color: '#5b6b62', border: '1px solid #e6eae4', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                          </button>
                        )}
                        {isChair && (
                          <button onClick={() => openModal('directive', a.id)} title={t('ot_addDirective')} style={{ width: 32, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf3df', color: '#a9791f', border: '1px solid #f0e4c4', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          </button>
                        )}
                        {memberEdit && (
                          <button onClick={() => setTaskForm({ id: a.id })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: 7, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>{rl('تعديل', 'Edit')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #f2f4f0', paddingTop: 8, fontSize: 10.5, fontWeight: 600, color: '#2e7d55' }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{t('ot_doneNote')}
                      </div>
                    )}
                  </div>
                ))}
                {c.isEmpty && <div style={{ textAlign: 'center', padding: '18px 8px', color: '#b3bbb2', fontSize: 11 }}>{t('ot_emptyCol')}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {timeline.map((g) => (
            <div key={g.key} style={{ background: '#ffffff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.16)' }}>
              <div style={{ padding: '13px 18px', background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderInlineStart: '4px solid ' + g.accent }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c' }}>{g.label}</span>
                <span style={{ minWidth: 24, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: g.accent, background: '#ffffff', borderRadius: 20, padding: '3px 10px' }}>{g.count}</span>
              </div>
              <div style={{ padding: '6px 18px' }}>
                {g.tasks.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #f2f4f0' }}>
                    <div onClick={() => setSelOtask(a.id)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c', lineHeight: 1.4 }}>{a.title}</div>
                      <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{a.dept}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                      <Avatar name={a.ownerRaw} size={24} />
                      <span style={{ fontSize: 11, color: '#5b6b62', whiteSpace: 'nowrap' }}>{a.owner}</span>
                    </div>
                    <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', background: a._bg, color: a._fg }}>{a.statusLabel}</span>
                    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: a.dueColor, minWidth: 96, justifyContent: 'flex-end' }}>{calIcon(12)}{a.dueLabel}</div>
                    {isChair && (
                      <button onClick={() => openModal('deadline', a.id)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('ot_setDeadline')}</button>
                    )}
                    {memberEdit && (
                      <button onClick={() => setTaskForm({ id: a.id })} style={{ flex: 'none', background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{rl('تعديل', 'Edit')}</button>
                    )}
                  </div>
                ))}
                {g.isEmpty && <div style={{ textAlign: 'center', padding: 16, color: '#b3bbb2', fontSize: 11.5 }}>{t('ot_emptyCol')}</div>}
              </div>
            </div>
          ))}
          <div style={{ textAlign: 'center', fontSize: 11.5, color: '#9aa39b' }}>{doneCount} {t('ot_doneNote')}</div>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div style={{ background: '#ffffff', border: 'none', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', overflow: 'hidden' }}>
          <div className="trow" style={{ display: 'grid', gridTemplateColumns: '2.6fr 1.2fr 1.1fr 1.1fr 1fr 1.4fr', gap: 12, padding: '13px 20px', background: '#f7f9f6', borderBottom: '1px solid #eef1ec', fontSize: 11.5, fontWeight: 600, color: '#7d867f' }}>
            <div>{t('ot_task')}</div><div>{t('ot_owner')}</div><div>{t('ot_status')}</div><div>{t('ot_due')}</div><div>{t('ot_lastUpdate')}</div><div />
          </div>
          {rows.map((a) => (
            <div key={a.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '2.6fr 1.2fr 1.1fr 1.1fr 1fr 1.4fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid #f2f4f0', alignItems: 'center' }}>
              <div onClick={() => setSelOtask(a.id)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.4 }}>{a.title}</div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{a.dept}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Avatar name={a.ownerRaw} size={26} />
                <span style={{ fontSize: 11.5, color: '#3c4a42' }}>{a.owner}</span>
              </div>
              <div>
                {canEdit ? (
                  <Dropdown value={a.status} options={statusSetOpts} onChange={(v) => setStatus(a.id, v)} opt={{ size: 'sm', block: true, bg: a._bg, color: a._fg, weight: 700, borderColor: 'transparent' }} />
                ) : (
                  <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: a._bg, color: a._fg }}>{a.statusLabel}</span>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: a.dueColor }}>{a.dueLabel}</div>
              <div style={{ fontSize: 11.5, color: '#8a938c' }}>{a.lastUpdate}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {isChair && (
                  <button onClick={() => openModal('deadline', a.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>{t('ot_setDeadline')}
                  </button>
                )}
                {memberEdit && (
                  <button onClick={() => setTaskForm({ id: a.id })} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '7px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{rl('تعديل', 'Edit')}</button>
                )}
                <button onClick={() => setSelOtask(a.id)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('ot_details')}</button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9aa39b', fontSize: 13 }}>{t('ot_noResults')}</div>}
        </div>
      )}

      {/* DETAIL DRAWER */}
      <Drawer open={!!detail} onClose={() => setSelOtask(null)} width={480}>
        {detail && <TaskDetail
          task={detail}
          canEdit={isChair}
          onClose={() => setSelOtask(null)}
          onEditDeadline={() => openModal('deadline', detail.id)}
          onAddDirective={() => openModal('directive', detail.id)}
          onRequestUpdate={reqUpdate}
          onMarkComplete={() => { markComplete(detail.id); }}
        />}
        {detail && memberEdit && (
          <div style={{ padding: '0 24px 24px' }}>
            <button onClick={() => { setSelOtask(null); setTaskForm({ id: detail.id }); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              {rl('تعديل المهمة', 'Edit task')}
            </button>
          </div>
        )}
      </Drawer>

      {/* TASK ADD / EDIT MODAL (members) */}
      {taskForm && <TaskEditModal taskId={taskForm.id} onClose={() => setTaskForm(null)} />}

      {/* DEADLINE MODAL */}
      <Modal open={oModal?.type === 'deadline'} onClose={() => setOModal(null)} width={460}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: '#17211c', marginBottom: 16 }}>{t('ot_deadlineTitle')}</div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5b6b62', marginBottom: 6 }}>{t('ot_newDeadline')}</label>
        <input type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', marginBottom: 16 }} />
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5b6b62', marginBottom: 6 }}>{t('ot_optNote')}</label>
        <textarea value={dlNote} onChange={(e) => setDlNote(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setOModal(null)} style={{ border: '1px solid #e2e6df', background: '#fff', color: '#5b6b62', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{rl('إلغاء', 'Cancel')}</button>
          <button onClick={saveDeadline} disabled={!dlDate} style={{ border: 'none', background: dlDate ? '#1e4634' : '#a9b3ab', color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: dlDate ? 'pointer' : 'default', fontFamily: 'inherit' }}>{t('ot_save')}</button>
        </div>
      </Modal>

      {/* DIRECTIVE MODAL */}
      <Modal open={oModal?.type === 'directive'} onClose={() => setOModal(null)} width={460}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: '#17211c', marginBottom: 16 }}>{t('ot_directiveTitle')}</div>
        <textarea value={dirNote} onChange={(e) => setDirNote(e.target.value)} rows={4} placeholder={t('ot_directivePh')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setOModal(null)} style={{ border: '1px solid #e2e6df', background: '#fff', color: '#5b6b62', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{rl('إلغاء', 'Cancel')}</button>
          <button onClick={saveDirective} disabled={!dirNote.trim()} style={{ border: 'none', background: dirNote.trim() ? '#1e4634' : '#a9b3ab', color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: dirNote.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>{t('ot_save')}</button>
        </div>
      </Modal>
    </Fade>
  );
}

/* ---- Task detail drawer body ---- */
function TaskDetail({ task, canEdit, onClose, onEditDeadline, onAddDirective, onRequestUpdate, onMarkComplete }: {
  task: OfficeTask;
  canEdit: boolean;
  onClose: () => void;
  onEditDeadline: () => void;
  onAddDirective: () => void;
  onRequestUpdate: () => void;
  onMarkComplete: () => void;
}) {
  const { t, tr, dl } = useI18n();
  const [bg, fg] = OTS[task.status] || ['#eceeeb', '#6d7973'];
  const directives = task.directives || [];
  const isDone = task.status === 'مكتمل';

  const dateCard = (label: string, value: string) => (
    <div style={{ flex: 1, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 12, padding: '11px 13px' }}>
      <div style={{ fontSize: 10.5, color: '#8a938c', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c' }}>{value ? dl(value) : '—'}</div>
    </div>
  );

  return (
    <div>
      {/* header */}
      <div style={{ background: '#f4f6f2', padding: '20px 22px', borderBottom: '1px solid #eef1ec' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 12px', background: '#eef3f0', color: '#2b5c44' }}>{tr(task.label)}</span>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e6eae4', borderRadius: 9, cursor: 'pointer', color: '#5b6b62' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ fontSize: 16.5, fontWeight: 700, color: '#17211c', lineHeight: 1.5, marginBottom: 12 }}>{tr(task.title)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar name={task.owner} size={26} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#3c4a42' }}>{tr(task.owner)}</span>
          </span>
          <span style={{ fontSize: 11.5, color: '#8a938c' }}>{tr(task.dept)}</span>
          <span style={{ marginInlineStart: 'auto', fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: bg, color: fg }}>{tr(task.status)}</span>
        </div>
      </div>

      {/* body */}
      <div style={{ padding: '18px 22px 26px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {dateCard(t('ot_startDate'), task.start)}
          {dateCard(t('ot_endDate'), task.end)}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5b6b62', marginBottom: 7 }}>{t('ot_desc')}</div>
          <div style={{ fontSize: 12.5, color: '#3c4a42', lineHeight: 1.7 }}>{tr(task.desc) || '—'}</div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5b6b62', marginBottom: 7 }}>{t('ot_attachments')}</div>
          {task.attachments && task.attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {task.attachments.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 10, padding: '9px 12px' }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#5b6b62" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3H14l5 5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V4.5A1.5 1.5 0 0 1 6.5 3Z" /><path d="M14 3v4a1 1 0 0 0 1 1h4" /></svg>
                  <span style={{ fontSize: 12, color: '#3c4a42', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr(f)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9aa39b' }}>{t('ot_noAttachments')}</div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5b6b62', marginBottom: 7 }}>{t('ot_updateLog')}</div>
          {directives.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {directives.map((dv, i) => (
                <div key={i} style={{ background: '#fbf7ee', border: '1px solid #f0e4c4', borderRadius: 11, padding: '10px 13px' }}>
                  <div style={{ fontSize: 12, color: '#3c4a42', lineHeight: 1.6 }}>{tr(dv.text)}</div>
                  <div style={{ fontSize: 10.5, color: '#a9791f', fontWeight: 600, marginTop: 5 }}>{dl(dv.date)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9aa39b' }}>{t('ot_noDirectives')}</div>
          )}
        </div>

        {/* actions */}
        {canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid #f2f4f0', paddingTop: 16 }}>
            <button onClick={onEditDeadline} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>{t('ot_editDeadline')}
            </button>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={onAddDirective} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#fbf3df', color: '#a9791f', border: '1px solid #f0e4c4', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>{t('ot_addDirective')}
              </button>
              <button onClick={onRequestUpdate} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f4f6f2', color: '#5b6b62', border: '1px solid #e6eae4', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>{t('ot_requestUpdate')}
              </button>
            </div>
            {!isDone && (
              <button onClick={onMarkComplete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#e2f0e8', color: '#2e7d55', border: '1px solid #cbe6d6', borderRadius: 10, padding: '11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{t('ot_markComplete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Task add/edit modal (office members): all task components ---- */
function TaskEditModal({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const existing = taskId ? data.otasks.find((x) => x.id === taskId) : null;
  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    title: existing.title, label: existing.label || '', dept: existing.dept || '',
    owner: existing.owner, status: existing.status, start: existing.start || '',
    end: existing.end || '', desc: existing.desc || '',
  } : {
    title: '', label: 'مهمة', dept: 'مكتب رئيس القطاع', owner: cu.name,
    status: 'قيد التنفيذ', start: '', end: '', desc: '',
  });
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const ownerNames = Array.from(new Set([...data.members.map((m) => m.name), ...(f.owner ? [f.owner] : [])]));
  const STATUSES = ['لم يبدأ', 'قيد التنفيذ', 'يحتاج توجيه', 'متأخر', 'مكتمل'];

  const save = (send: boolean) => {
    const title = (f.title || '').trim();
    if (!title) { showToast(rl('يرجى إدخال عنوان المهمة', 'Please enter the task title')); return; }
    mutate((d) => {
      let r: (typeof d.otasks)[number] & Record<string, unknown>;
      if (existing) r = d.otasks.find((x) => x.id === taskId)! as never;
      else {
        r = { id: 'ot' + Date.now(), attachments: [], directives: [], reviewed: false, notes: '', due: '', lastUpdate: '' } as never;
        d.otasks.unshift(r as never);
        r._mowner = cu.id;
      }
      if (!r) return;
      r.title = title; r.label = f.label; r.dept = f.dept; r.owner = f.owner;
      r.status = f.status; r.start = f.start; r.end = f.end; r.due = f.end;
      r.desc = f.desc; r.lastUpdate = rl('اليوم', 'Today');
      if (send) { r._mrev = true; r._mret = ''; r._mowner = r._mowner || cu.id; }
      const log = (r._mlog as unknown[] | undefined) || [];
      log.unshift({ at: rl('الآن', 'Just now'), to: send ? 'بانتظار مراجعة رئيس القطاع' : f.status, sent: !!send, by: cu.name });
      r._mlog = log;
    });
    showToast(send ? rl('تم الحفظ والإرسال لمراجعة رئيس القطاع', 'Saved and sent for Sector Head review') : rl('تم حفظ المهمة', 'Task saved'));
    onClose();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;

  return (
    <Modal open onClose={onClose} width={560}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? rl('تعديل المهمة', 'Edit task') : rl('مهمة جديدة', 'New task')}</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>{rl('تُحفظ في نفس السجل الذي يراه رئيس القطاع.', 'Saved to the same record the Sector Head sees.')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('عنوان المهمة', 'Task title')}</Label><input value={f.title} onChange={setI('title')} style={inputStyle} /></div>
        <div><Label>{rl('التصنيف', 'Label')}</Label><input value={f.label} onChange={setI('label')} style={inputStyle} /></div>
        <div><Label>{rl('الإدارة / الجهة', 'Department')}</Label><input value={f.dept} onChange={setI('dept')} style={inputStyle} /></div>
        <div><Label>{rl('المسؤول', 'Owner')}</Label><Dropdown value={f.owner} options={ownerNames.map((n) => ({ v: n, label: tr(n) }))} onChange={set('owner')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('الحالة', 'Status')}</Label><Dropdown value={f.status} options={STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={set('status')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('تاريخ البدء', 'Start date')}</Label><DateField value={f.start} onChange={set('start')} /></div>
        <div><Label>{rl('الموعد النهائي (فارغ = بدون موعد)', 'Deadline (empty = none)')}</Label><DateField value={f.end} onChange={set('end')} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('الوصف', 'Description')}</Label><textarea value={f.desc} onChange={setI('desc')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ', 'Save')}</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ وإرسال لرئيس القطاع', 'Save & send to Sector Head')}</button>
      </div>
    </Modal>
  );
}
