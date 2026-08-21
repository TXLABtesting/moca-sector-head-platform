import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { triggerDownload } from '../shared/fileGen';
import { makeXlsx, fileToBlocks, parseBulk, alias, pick, excelSerialToDate } from './reportcenter/templateIO';
import { Fade, Drawer, Avatar, Badge, Modal } from '../components/ui';
import { APP_TODAY } from '../shared/today';
import { Dropdown } from '../components/Dropdown';
import { MobileFilters } from '../components/MobileFilters';
import { DateField } from '../components/DateField';
import { useToast } from '../components/Toast';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useI18n } from '../i18n/i18n';
import { parseAr } from '../shared/helpers';
import type { Leave, LeaveCat } from '../data/types';
import { FileUploadField } from '../components/FileUploadField';
import { AttachmentDownload } from '../components/AttachmentDownload';

const DAY = 86400000;
const AR_MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
// Department managers roster (code-defined so they always appear in the person
// picker regardless of the shared-DB contents). Treated as the "manager" category.
const DEPT_MANAGERS = ['علي عيسى', 'محمد الياسي', 'شما المري', 'مريم البلوشي', 'شيماء خماس', 'حصة الحوسني', 'عبدالرحمن البلوشي'];
const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** status -> [pill bg, pill fg] */
const STC: Record<string, [string, string]> = {
  'معتمدة': ['#e2f0e8', '#2e7d55'],
  'بانتظار الاعتماد': ['#fbf0d6', '#a9791f'],
  'مرفوضة': ['#f7e6e4', '#b0433b'],
  'مخططة': ['#eef3f6', '#2f6aa8'],
  'منتهية': ['#eceae6', '#8a8078'],
  'ملغاة': ['#eceeeb', '#9aa39b'],
};
/** status -> timeline bar colour */
const BARC: Record<string, string> = {
  'معتمدة': '#2e7d55',
  'بانتظار الاعتماد': '#a9791f',
  'مرفوضة': '#b0433b',
  'مخططة': '#8a8078',
  'منتهية': '#b4b0a8',
  'ملغاة': '#b4b0a8',
};

const activeForConflict = (lv: Leave) => lv.status === 'معتمدة' || lv.status === 'بانتظار الاعتماد';
const TODAY = APP_TODAY;
/** phase -> [pill bg, pill fg] */
const PHC: Record<string, [string, string]> = {
  'قادمة': ['#eef3f6', '#2f6aa8'],
  'جارية': ['#e2f0e8', '#2e7d55'],
  'منتهية': ['#eceae6', '#8a8078'],
  'ملغاة': ['#f0eeeb', '#9a8a86'],
};

interface Parsed { lv: Leave; s: Date; e: Date }

export function TeamLeaves() {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const users = useStore((s) => s.users);
  const { showToast } = useToast();
  const leaves = data.leaves;

  // ---- permissions
  const canApprove = can(cu, 'leaves', 'approve');
  const canNote = can(cu, 'leaves', 'note');
  const canReview = can(cu, 'leaves', 'review');
  // Leave planners manage records end-to-end; official approval stays with the chair.
  const canManage = cu.type !== 'chair' && (can(cu, 'leaves', 'add') || can(cu, 'leaves', 'edit'));

  // ---- state
  const [view, setView] = useState<'timeline' | 'table'>('timeline');
  const [fCat, setFCat] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fType, setFType] = useState('');
  const [fMonth, setFMonth] = useState('');
  const [search, setSearch] = useState('');
  const [onlyConflict, setOnlyConflict] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingDates, setEditingDates] = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [fPhase, setFPhase] = useState('');
  const [lvForm, setLvForm] = useState(false);

  // ---- bulk import (one leave per row) ----
  const LV_STATUS = ['بانتظار الاعتماد', 'معتمدة', 'مرفوضة', 'مخططة', 'منتهية'];
  const LV_COLS = [
    { field: 'person', match: alias('الموظف', 'الاسم', 'الشخص') },
    { field: 'cat', match: alias('التصنيف', 'الفئة'), norm: (v: string) => (v.includes('مدير') ? 'manager' : 'office') },
    { field: 'role', match: alias('الدور', 'الوظيفة', 'المسمى') },
    { field: 'dept', match: alias('الإدارة', 'القسم') },
    { field: 'type', match: alias('نوع الإجازة', 'النوع') },
    { field: 'start', match: alias('تاريخ البداية', 'البداية', 'من'), norm: excelSerialToDate },
    { field: 'end', match: alias('تاريخ النهاية', 'النهاية', 'إلى'), norm: excelSerialToDate },
    { field: 'days', match: alias('عدد الأيام', 'الأيام') },
    { field: 'status', match: alias('الحالة'), norm: pick(LV_STATUS, 'مخططة') },
    { field: 'backup', match: alias('البديل') },
    { field: 'notes', match: alias('ملاحظات') },
  ];
  const LV_HEADERS = ['الموظف', 'التصنيف', 'الدور', 'الإدارة', 'نوع الإجازة', 'تاريخ البداية', 'تاريخ النهاية', 'عدد الأيام', 'الحالة', 'البديل', 'ملاحظات'];
  const LV_EXAMPLE = ['محمد الياسي', 'مكتب', 'منسق', 'إدارة الشؤون الإدارية', 'سنوية', '1 أغسطس 2026', '10 أغسطس 2026', '10', 'مخططة', 'موزة المرزوقي', 'صف مثال — احذفه'];
  const bulkRef = useRef<HTMLInputElement>(null);
  const dlLeaveBulk = () => triggerDownload(makeXlsx([LV_HEADERS, LV_EXAMPLE], 'الإجازات'), 'Team_Leaves_Bulk_Template.xlsx');
  const onBulk = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      const rows = blocks ? parseBulk(blocks.tables, LV_COLS, (r) => !!r.person) : [];
      if (!rows.length) { showToast(rl('لم يُعثر على إجازات في الملف — تأكد من مطابقة الأعمدة للقالب', 'No leaves found — check the template columns')); return; }
      mutate((d) => {
        rows.forEach((r, i) => {
          // Auto-calculate leave days from the two dates when the column is
          // blank (e.g. a template formula that wasn't cached).
          let days = parseInt(r.days, 10) || 0;
          if (!days) {
            const s = parseAr(r.start || ''), e = parseAr(r.end || '');
            if (s && e && +e >= +s) days = Math.round((+e - +s) / 86400000) + 1;
          }
          const rec = {
            id: 'lv' + Date.now() + i, person: r.person, cat: (r.cat as LeaveCat) || 'office',
            role: r.role || '', dept: r.dept || '', type: r.type || 'سنوية',
            start: r.start || '', end: r.end || '', days,
            status: r.status || 'مخططة', backup: r.backup || '—', notes: r.notes || '', _mowner: cu.id,
          } as unknown as Leave;
          d.leaves.unshift(rec);
        });
      });
      showToast(rl('تم استيراد ', 'Imported ') + rows.length + rl(' إجازة', ' leaves'));
    } catch {
      showToast(rl('تعذّر استيراد الملف', 'Import failed'));
    }
  };
  const [lvEdit, setLvEdit] = useState(false);

  const CATL: Record<LeaveCat, string> = {
    manager: rl('مدراء الوحدات التنظيمية', 'Unit managers'),
    office: rl('فريق المكتب', 'Office team'),
  };
  const monName = (m: number) => (lang === 'en' ? EN_MON[m] : AR_MON[m]);

  // ---- parse + conflicts
  const parsed: Parsed[] = leaves
    .map((lv) => ({ lv, s: parseAr(lv.start), e: parseAr(lv.end) }))
    .filter((x): x is Parsed => !!x.s && !!x.e);
  const pmap: Record<string, Parsed> = {};
  parsed.forEach((p) => { pmap[p.lv.id] = p; });

  const act = parsed.filter((x) => activeForConflict(x.lv));
  const conflictWith: Record<string, string[]> = {};
  const conflicts: { text: string; overlap: string }[] = [];
  for (let i = 0; i < act.length; i++) {
    for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      if (a.lv.cat === b.lv.cat && a.s <= b.e && b.s <= a.e) {
        (conflictWith[a.lv.id] = conflictWith[a.lv.id] || []).push(b.lv.person);
        (conflictWith[b.lv.id] = conflictWith[b.lv.id] || []).push(a.lv.person);
        const os = new Date(Math.max(+a.s, +b.s)), oe = new Date(Math.min(+a.e, +b.e));
        conflicts.push({
          text: rl(a.lv.person + ' و ' + b.lv.person + ' — تداخل في فترة الإجازة', a.lv.person + ' & ' + b.lv.person + ' — overlapping leave'),
          overlap: os.getDate() + ' ' + monName(os.getMonth()) + ' ↔ ' + oe.getDate() + ' ' + monName(oe.getMonth()),
        });
      }
    }
  }

  // ---- available months (from data)
  const monthMap: Record<string, { y: number; m: number }> = {};
  parsed.forEach((p) => {
    for (let t = +p.s; t <= +p.e; t += DAY) {
      const d = new Date(t);
      monthMap[d.getFullYear() + '-' + d.getMonth()] = { y: d.getFullYear(), m: d.getMonth() };
    }
  });
  const monthKeys = Object.keys(monthMap).sort((a, b) => {
    const A = monthMap[a], B = monthMap[b];
    return A.y - B.y || A.m - B.m;
  });
  const monthInRange = (p: Parsed): boolean => {
    if (!fMonth) return true;
    const { y, m } = monthMap[fMonth];
    const mStart = +new Date(y, m, 1), mEnd = +new Date(y, m + 1, 0);
    return +p.s <= mEnd && mStart <= +p.e;
  };

  // ---- phase (upcoming / ongoing / completed / cancelled)
  const phaseOf = (lv: Leave): string => {
    if (lv.status === 'ملغاة' || lv.status === 'مرفوضة') return 'ملغاة';
    const p = pmap[lv.id];
    if (!p) return '';
    if (+p.e < +TODAY) return 'منتهية';
    if (+p.s > +TODAY) return 'قادمة';
    return 'جارية';
  };

  // ---- filter
  const q = search.trim();
  const match = (lv: Leave): boolean => {
    if (fCat && lv.cat !== fCat) return false;
    if (fStatus && lv.status !== fStatus) return false;
    if (fType && lv.type !== fType) return false;
    if (fPhase && phaseOf(lv) !== fPhase) return false;
    if (q && !(lv.person.includes(q) || lv.role.includes(q) || lv.dept.includes(q))) return false;
    if (onlyConflict && !(conflictWith[lv.id] && conflictWith[lv.id].length)) return false;
    if (fMonth) { const p = pmap[lv.id]; if (!p || !monthInRange(p)) return false; }
    return true;
  };

  // ---- timeline window (over month-scoped set, else all)
  const windowSet = (fMonth ? parsed.filter(monthInRange) : parsed);
  const hasWindow = windowSet.length > 0;
  const minS = hasWindow ? Math.min(...windowSet.map((x) => +x.s)) : 0;
  const maxE = hasWindow ? Math.max(...windowSet.map((x) => +x.e)) : 0;
  const d0 = minS - DAY;
  const span = hasWindow ? Math.round((maxE + DAY - d0) / DAY) + 1 : 1;
  const dayW = 100 / span;
  const idxOf = (t: number) => Math.round((t - d0) / DAY);

  // ticks + gridlines (weekly)
  const ticks: { label: string; style: CSSProperties }[] = [];
  const gridlines: CSSProperties[] = [];
  for (let i = 0; i < span; i += 7) {
    const dt = new Date(d0 + i * DAY);
    ticks.push({
      label: dt.getDate() + ' ' + monName(dt.getMonth()),
      style: { position: 'absolute', top: 0, left: i * dayW + '%', fontSize: 10, color: '#9aa39b', whiteSpace: 'nowrap', transform: 'translateX(-2px)' },
    });
    gridlines.push({ position: 'absolute', top: 0, bottom: 0, left: i * dayW + '%', width: 1, background: '#f1f3ef' });
  }

  // conflict bands (days with >=2 active same-category overlaps)
  const bands: CSSProperties[] = [];
  let runStart = -1;
  for (let i = 0; i < span; i++) {
    const day = d0 + i * DAY;
    let cm = 0, co = 0;
    for (const x of act) { if (+x.s <= day && day <= +x.e) { if (x.lv.cat === 'manager') cm++; else co++; } }
    const isC = cm >= 2 || co >= 2;
    if (isC && runStart < 0) runStart = i;
    if ((!isC || i === span - 1) && runStart >= 0) {
      const endI = isC ? i : i - 1;
      bands.push({ position: 'absolute', top: 0, bottom: 0, left: runStart * dayW + '%', width: (endI - runStart + 1) * dayW + '%', background: '#f3d9d2', opacity: 0.55 });
      runStart = -1;
    }
  }

  // today line (from the single source)
  const today = APP_TODAY;
  const tIdx = idxOf(+today);
  const hasToday = tIdx >= 0 && tIdx < span;
  const todayStyle: CSSProperties = { position: 'absolute', top: 0, bottom: 0, left: (tIdx + 0.5) * dayW + '%', width: 2, background: '#1e4634', opacity: 0.5, zIndex: 3 };

  // ---- decorate
  const dec = (lv: Leave) => {
    const [bg, fg] = STC[lv.status] || STC['مخططة'];
    const cw = conflictWith[lv.id] || [];
    const ph = phaseOf(lv);
    const [phBg, phFg] = PHC[ph] || ['#eef1ec', '#6d7973'];
    return {
      lv,
      phase: ph, phaseLabel: ph ? tr(ph) : '', phBg, phFg,
      bg, fg,
      statusLabel: tr(lv.status),
      catLabel: CATL[lv.cat] || lv.cat,
      period: dl(lv.start) + ' – ' + dl(lv.end),
      backupDisp: (lv.backup && lv.backup !== '—') ? lv.backup : rl('لا يوجد بديل معيّن', 'No backup assigned'),
      hasConflict: cw.length > 0,
      conflictWith: cw.join('، '),
    };
  };

  // timeline rows grouped: office on top, managers below
  const tlGroups = ([
    { cat: 'office' as LeaveCat, accent: '#a9791f' },
    { cat: 'manager' as LeaveCat, accent: '#1e4634' },
  ]).map((g) => {
    const rows = windowSet
      .filter((x) => x.lv.cat === g.cat && match(x.lv))
      .sort((a, b) => +a.s - +b.s)
      .map((x) => {
        const lv = x.lv;
        const li = idxOf(+x.s), ri = idxOf(+x.e);
        const w = Math.max((ri - li + 1) * dayW, dayW * 1.4);
        const conflict = (conflictWith[lv.id] || []).length > 0;
        const barStyle: CSSProperties = {
          position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: li * dayW + '%', width: w + '%',
          height: 24, borderRadius: 7, background: BARC[lv.status] || BARC['مخططة'], color: '#fff',
          display: 'flex', alignItems: 'center', padding: '0 9px', fontSize: 10.5, fontWeight: 600,
          cursor: 'pointer', zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,.12)',
          ...(conflict ? { outline: '2px solid #b0433b', outlineOffset: 1 } : {}),
        };
        return { ...dec(lv), li, ri, barStyle, barText: x.s.getDate() + '–' + x.e.getDate() + ' ' + monName(x.e.getMonth()) };
      });
    return { cat: g.cat, accent: g.accent, label: CATL[g.cat], count: rows.length, rows };
  }).filter((g) => g.count > 0);

  // table rows
  const tableRows = leaves.filter(match).map(dec);

  // ---- kpis
  const pend = leaves.filter((l) => l.status === 'بانتظار الاعتماد').length;
  const appr = leaves.filter((l) => l.status === 'معتمدة').length;
  const AC = '#1e4634', NB = '#e8ebe6';
  const noFilters = !fStatus && !onlyConflict && !fCat && !fType;
  const clearAll = () => { setFStatus(''); setFCat(''); setFType(''); setSearch(''); setFMonth(''); setOnlyConflict(false); setFPhase(''); };
  const kpis = [
    { label: rl('إجمالي الطلبات', 'Total requests'), value: leaves.length, icon: '∑', bg: '#eef1ec', fg: '#1e4634', border: noFilters ? AC : NB, action: clearAll },
    { label: rl('بانتظار الاعتماد', 'Pending'), value: pend, icon: '⏱', bg: '#fbf0d6', fg: '#a9791f', border: fStatus === 'بانتظار الاعتماد' ? AC : NB, action: () => { setFStatus(fStatus === 'بانتظار الاعتماد' ? '' : 'بانتظار الاعتماد'); setOnlyConflict(false); } },
    { label: rl('معتمدة', 'Approved'), value: appr, icon: '✓', bg: '#e2f0e8', fg: '#2e7d55', border: fStatus === 'معتمدة' ? AC : NB, action: () => { setFStatus(fStatus === 'معتمدة' ? '' : 'معتمدة'); setOnlyConflict(false); } },
    { label: rl('تعارضات', 'Conflicts'), value: conflicts.length, icon: '!', bg: '#f6e5df', fg: '#b0433b', border: onlyConflict ? AC : NB, action: () => { setOnlyConflict(!onlyConflict); setFStatus(''); setView('timeline'); } },
  ];

  // ---- dropdown option lists
  const opt = (arr: string[]) => arr.map((v) => ({ v, label: tr(v) }));
  const catOpts = [{ v: '', label: rl('كل الفئات', 'All groups') }, { v: 'manager', label: CATL.manager }, { v: 'office', label: CATL.office }];
  const statusOpts = [{ v: '', label: rl('كل الحالات', 'All statuses') }, ...opt(['بانتظار الاعتماد', 'معتمدة', 'مرفوضة', 'مخططة', 'منتهية'])];
  const typeOpts = [{ v: '', label: rl('كل الأنواع', 'All types') }, ...opt(['سنوية', 'طارئة', 'مرضية'])];
  const monthOpts = [{ v: '', label: rl('كل الأشهر', 'All months') }, ...monthKeys.map((k) => ({ v: k, label: monName(monthMap[k].m) + ' ' + monthMap[k].y }))];
  const phaseOpts = [{ v: '', label: rl('كل المراحل', 'All phases') }, ...opt(['قادمة', 'جارية', 'منتهية', 'ملغاة'])];

  // ---- side panel actions
  const closePanel = () => { setSelId(null); setEditingDates(false); setNoteDraft(''); setLvEdit(false); };
  const { params } = useNav();
  useEffect(() => {
    const t = params.selLeave as string | undefined;
    if (t) { setSelId(t); setLvEdit(false); }
  }, [params.selLeave]);
  const openPanel = (id: string) => { setSelId(id); setEditingDates(false); setNoteDraft(''); };
  const doApprove = (id: string) => { mutate((d) => { const lv = d.leaves.find((l) => l.id === id); if (lv) lv.status = 'معتمدة'; }); showToast(rl('تم اعتماد الإجازة', 'Leave approved')); };
  const doReject = (id: string) => {
    mutate((d) => {
      const lv = d.leaves.find((l) => l.id === id);
      if (lv) { lv.status = 'مرفوضة'; const r = noteDraft.trim(); if (r) lv.notes = 'سبب الرفض: ' + r + (lv.notes ? (' — ' + lv.notes) : ''); }
    });
    setNoteDraft('');
    showToast(rl('تم رفض الإجازة', 'Leave rejected'));
  };
  const doNote = (id: string) => {
    const v = noteDraft.trim(); if (!v) return;
    mutate((d) => { const lv = d.leaves.find((l) => l.id === id); if (lv) lv.notes = (lv.notes && lv.notes !== '') ? (lv.notes + ' — ' + v) : v; });
    setNoteDraft('');
    showToast(rl('تمت إضافة ملاحظة', 'Note added'));
  };
  const doSetBackup = (id: string, v: string) => { mutate((d) => { const lv = d.leaves.find((l) => l.id === id); if (lv) lv.backup = v; }); showToast(rl('تم تعيين البديل', 'Backup assigned')); };
  const doSaveDates = (id: string) => {
    mutate((d) => { const lv = d.leaves.find((l) => l.id === id); if (lv) { lv.start = editStart.trim() || lv.start; lv.end = editEnd.trim() || lv.end; } });
    setEditingDates(false);
    showToast(rl('تم تعديل تاريخ الإجازة', 'Leave dates updated'));
  };
  const doReqEdit = () => showToast(rl('تم إرسال طلب تعديل فترة الإجازة', 'Edit request sent'));
  const doReviewed = (id: string) => { mutate((d) => { const lv = d.leaves.find((l) => l.id === id) as (Leave & { reviewed?: boolean }) | undefined; if (lv) lv.reviewed = true; }); showToast(rl('تم وضع علامة تمت المراجعة', 'Marked reviewed')); };

  const selLv = selId ? leaves.find((l) => l.id === selId) || null : null;

  // toolbar tab style
  const tab = (on: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '8px 15px',
    fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit',
    background: on ? '#1e4634' : 'transparent', color: on ? '#fff' : '#5b6b62',
  });

  const checkChip = (on: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid ' + (on ? '#1e4634' : '#e2e6df'),
      background: on ? '#eef3f0' : '#ffffff', color: on ? '#1e4634' : '#5b6b62', borderRadius: 9,
      padding: '7px 12px', fontSize: 12, fontWeight: on ? 700 : 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 15, height: 15, flex: 'none', borderRadius: 5, border: '1.5px solid ' + (on ? '#1e4634' : '#c3ccc5'),
        background: on ? '#1e4634' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {on && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </span>
      {label}
    </button>
  );

  return (
    <Fade style={{ fontFamily: "'IBM Plex Sans Arabic',sans-serif" }}>
      {/* header: title on the start side, add button opposite */}
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 700, color: '#17211c' }}>{rl('إجازات الفريق', 'Team Leaves')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6d7973' }}>
            {rl('عرض زمني لإجازات فريق المكتب ومدراء الوحدات التنظيمية — التداخلات تظهر بوضوح على المحور الزمني.', 'A timeline of office-team and sector-manager leaves — overlaps are highlighted on the date axis.')}
          </p>
        </div>
        {canManage && (
          <div className="page-head-action" style={{ flex: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={dlLeaveBulk} title={rl('تنزيل قالب إكسيل بصف لكل إجازة', 'Template: one leave per row')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 11, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>{rl('قالب الاستيراد', 'Import template')}
            </button>
            <input ref={bulkRef} type="file" accept=".xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onBulk(f); e.target.value = ''; }} />
            <button onClick={() => bulkRef.current?.click()} title={rl('رفع ملف إكسيل يحتوي عدة إجازات دفعة واحدة', 'Upload many leaves at once')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef4ef', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 11, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9m0 0-4 4m4-4 4 4M5 3h14" /></svg>{rl('استيراد دفعة', 'Bulk import')}
            </button>
            <button onClick={() => setLvForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {rl('إضافة إجازة', 'New leave')}
            </button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="lv-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {kpis.map((k, i) => (
          <div key={i} onClick={k.action} style={{
            background: '#ffffff', border: '1px solid ' + k.border, borderRadius: 14, padding: '16px 18px',
            cursor: 'pointer', transition: 'border-color .15s,box-shadow .15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#6d7973', fontWeight: 500 }}>{k.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.fg, fontWeight: 700, fontSize: 13 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 27, fontWeight: 700, color: '#17211c', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 7, background: '#f2f4f0', borderRadius: 11, padding: 4 }}>
          <button onClick={() => setView('timeline')} style={tab(view === 'timeline')}>{rl('الجدول الزمني', 'Timeline')}</button>
          <button onClick={() => setView('table')} style={tab(view === 'table')}>{rl('جدول', 'Table')}</button>
        </div>
        <MobileFilters activeCount={(search ? 1 : 0) + (fMonth ? 1 : 0) + (fCat ? 1 : 0) + (fStatus ? 1 : 0) + (fType ? 1 : 0) + (fPhase ? 1 : 0) + (onlyConflict ? 1 : 0)}
          onClear={() => { setSearch(''); setFMonth(''); setFCat(''); setFStatus(''); setFType(''); setFPhase(''); setOnlyConflict(false); }}
          rowStyle={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={2} style={{ position: 'absolute', insetInlineStart: 11 }} strokeLinecap="round"><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={rl('بحث بالاسم أو الإدارة…', 'Search name or unit…')} style={{
              border: '1px solid #e2e6df', background: '#ffffff', borderRadius: 9, padding: '8px 12px', paddingInlineStart: 34,
              fontSize: 12.5, fontFamily: 'inherit', width: '100%', minWidth: 180, boxSizing: 'border-box', color: '#17211c',
            }} />
          </div>
          <Dropdown value={fMonth} options={monthOpts} onChange={setFMonth} opt={{ size: 'sm', minWidth: '130px' }} />
          <Dropdown value={fCat} options={catOpts} onChange={setFCat} opt={{ size: 'sm', minWidth: '140px' }} />
          <Dropdown value={fStatus} options={statusOpts} onChange={(v) => { setFStatus(v); setOnlyConflict(false); }} opt={{ size: 'sm', minWidth: '150px' }} />
          <Dropdown value={fType} options={typeOpts} onChange={setFType} opt={{ size: 'sm', minWidth: '130px' }} />
          <Dropdown value={fPhase} options={phaseOpts} onChange={setFPhase} opt={{ size: 'sm', minWidth: '130px' }} />
          {checkChip(onlyConflict, rl('التعارضات فقط', 'Conflicts only'), () => { setOnlyConflict(!onlyConflict); setFStatus(''); })}
          {checkChip(fStatus === 'بانتظار الاعتماد', rl('بانتظار الاعتماد فقط', 'Pending only'), () => { setFStatus(fStatus === 'بانتظار الاعتماد' ? '' : 'بانتظار الاعتماد'); setOnlyConflict(false); })}
        </MobileFilters>
      </div>

      {/* ===================== TIMELINE ===================== */}
      {view === 'timeline' && (
        <div style={{ background: '#ffffff', border: '1px solid #e8ebe6', borderRadius: 14, padding: '18px 20px', marginBottom: 16, overflowX: 'auto' }}>
          {/* legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16, fontSize: 11.5, color: '#6d7973' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 13, height: 13, borderRadius: 4, background: '#2e7d55' }} />{rl('معتمدة', 'Approved')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 13, height: 13, borderRadius: 4, background: '#a9791f' }} />{rl('بانتظار الاعتماد', 'Pending')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 13, height: 13, borderRadius: 4, background: '#8a8078' }} />{rl('مخططة / أخرى', 'Planned / other')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 13, height: 13, borderRadius: 4, background: '#f3d9d2', border: '1px solid #d98b7e' }} />{rl('يوم تعارض', 'Conflict day')}</div>
          </div>

          <div style={{ minWidth: 760 }}>
            {/* axis header */}
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ width: 190, flex: 'none' }} />
              <div style={{ flex: 1, position: 'relative', height: 22, direction: 'ltr' }}>
                {ticks.map((tk, i) => (<div key={i} style={tk.style}>{tk.label}</div>))}
              </div>
            </div>

            {/* groups */}
            {tlGroups.map((g) => (
              <div key={g.cat} style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 16, borderRadius: 4, background: g.accent }} />
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#17211c' }}>{g.label}</h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9aa39b' }}>{g.count}</span>
                </div>
                {g.rows.map((r) => (
                  <div key={r.lv.id} className="lv-tlrow" style={{ display: 'flex', alignItems: 'stretch', borderRadius: 9 }}>
                    {/* name */}
                    <div onClick={() => openPanel(r.lv.id)} style={{ width: 190, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', cursor: 'pointer', minWidth: 0 }}>
                      <Avatar name={r.lv.person} size={28} radius={8} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.lv.person}</div>
                        {r.hasConflict && <div style={{ fontSize: 10, fontWeight: 700, color: '#b0433b' }}>{rl('تعارض', 'Conflict')}</div>}
                      </div>
                    </div>
                    {/* track */}
                    <div style={{ flex: 1, position: 'relative', height: 38, direction: 'ltr', borderInlineStart: '1px solid #f1f3ef' }}>
                      {gridlines.map((gl, i) => (<div key={'g' + i} style={gl} />))}
                      {bands.map((bd, i) => (<div key={'b' + i} style={bd} />))}
                      {hasToday && <div style={todayStyle} />}
                      <div onClick={() => openPanel(r.lv.id)} title={r.period} style={r.barStyle}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.barText}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {tlGroups.length === 0 && (
              <div style={{ padding: 34, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{rl('لا توجد طلبات مطابقة للفلاتر', 'No requests match the filters')}</div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TABLE ===================== */}
      {view === 'table' && (
        <div style={{ background: '#ffffff', border: '1px solid #e8ebe6', borderRadius: 14, overflow: 'hidden' }}>
          <div className="lvtrow" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 0.7fr 0.9fr 1fr', padding: '12px 18px', background: '#f7f8f6', borderBottom: '1px solid #e8ebe6', fontSize: 11.5, fontWeight: 700, color: '#6d7973' }}>
            <div>{rl('الموظف', 'Employee')}</div><div>{rl('النوع', 'Type')}</div><div>{rl('الفترة', 'Period')}</div><div>{rl('الأيام', 'Days')}</div><div>{rl('الحالة', 'Status')}</div><div>{rl('البديل', 'Backup')}</div>
          </div>
          {tableRows.map((r) => (
            <div key={r.lv.id} onClick={() => openPanel(r.lv.id)} className="lvtrow" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 0.7fr 0.9fr 1fr', padding: '12px 18px', borderBottom: '1px solid #f1f3ef', fontSize: 12.5, alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <Avatar name={r.lv.person} size={30} radius={8} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.lv.person}</div>
                  <div style={{ fontSize: 11, color: '#9aa39b' }}>{r.catLabel}</div>
                </div>
              </div>
              <div style={{ color: '#3c4a42' }}>{tr(r.lv.type)}</div>
              <div style={{ color: '#3c4a42', fontSize: 12 }}>{r.period}</div>
              <div style={{ color: '#3c4a42' }}>{r.lv.days}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <Badge bg={r.bg} fg={r.fg} style={{ padding: '3px 10px' }}>{r.statusLabel}</Badge>
                {r.phase && <Badge bg={r.phBg} fg={r.phFg} style={{ padding: '2px 9px', fontSize: 9.5 }}>{r.phaseLabel}</Badge>}
              </div>
              <div style={{ color: '#6d7973', fontSize: 12 }}>{r.backupDisp}</div>
            </div>
          ))}
          {tableRows.length === 0 && (
            <div style={{ padding: 34, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{rl('لا توجد طلبات مطابقة للفلاتر', 'No requests match the filters')}</div>
          )}
        </div>
      )}

      {/* SIDE PANEL */}
      <Drawer open={!!selLv} onClose={closePanel} width={456}>
        {selLv && lvEdit && canManage && (
          <div style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button onClick={() => setLvEdit(false)} title={rl('رجوع', 'Back')} style={{ flex: 'none', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 9, cursor: 'pointer' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
              </button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{rl('تعديل الإجازة', 'Edit leave')}</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 11.5, color: '#9aa39b' }}>{selLv.person}</p>
            <LeaveFormFields key={selLv.id} leaveId={selLv.id} onDone={() => setLvEdit(false)} onCancel={() => setLvEdit(false)} />
          </div>
        )}
        {selLv && !(lvEdit && canManage) && <LeavePanel
          key={selLv.id}
          lv={selLv}
          dec={dec(selLv)}
          reviewed={!!(selLv as Leave & { reviewed?: boolean }).reviewed}
          rl={rl}
          tr={tr}
          canApprove={canApprove}
          canNote={canNote}
          canReview={canReview}
          canManage={canManage}
          onEdit={() => setLvEdit(true)}
          users={users}
          parsed={parsed}
          members={data.members.map((m) => m.name)}
          managerNames={leaves.filter((l) => l.cat === 'manager').map((l) => l.person)}
          officeNames={leaves.filter((l) => l.cat === 'office').map((l) => l.person)}
          sectorManagers={data.sectorManagers.map((m) => m.name)}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          editingDates={editingDates}
          setEditingDates={setEditingDates}
          editStart={editStart}
          editEnd={editEnd}
          setEditStart={setEditStart}
          setEditEnd={setEditEnd}
          onClose={closePanel}
          onApprove={() => doApprove(selLv.id)}
          onReject={() => doReject(selLv.id)}
          onNote={() => doNote(selLv.id)}
          onSetBackup={(v) => doSetBackup(selLv.id, v)}
          onSaveDates={() => doSaveDates(selLv.id)}
          onReqEdit={doReqEdit}
          onReviewed={() => doReviewed(selLv.id)}
        />}
      </Drawer>

      {lvForm && (
        <Modal open onClose={() => setLvForm(false)} width={620}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{rl('إجازة جديدة', 'New leave record')}</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>{rl('تخطيط داخلي للإجازات — الاعتماد الرسمي والأرصدة عبر Oracle من اختصاص الموارد البشرية.', 'Internal planning only — official approval, balances and Oracle stay with HR.')}</p>
          <LeaveFormFields leaveId={null} onDone={() => setLvForm(false)} onCancel={() => setLvForm(false)} />
        </Modal>
      )}
    </Fade>
  );
}

// ============================= SIDE PANEL =============================
interface PanelProps {
  lv: Leave;
  dec: ReturnType<() => { bg: string; fg: string; statusLabel: string; catLabel: string; period: string; backupDisp: string; hasConflict: boolean; conflictWith: string; phase: string; phaseLabel: string; phBg: string; phFg: string }>;
  reviewed: boolean;
  rl: (a: string, b: string) => string;
  tr: (s: string | null | undefined) => string;
  canApprove: boolean;
  canNote: boolean;
  canReview: boolean;
  canManage: boolean;
  onEdit: () => void;
  users: { id: string; name: string }[];
  parsed: Parsed[];
  members: string[];
  managerNames: string[];
  officeNames: string[];
  sectorManagers: string[];
  noteDraft: string;
  setNoteDraft: (s: string) => void;
  editingDates: boolean;
  setEditingDates: (b: boolean) => void;
  editStart: string;
  editEnd: string;
  setEditStart: (s: string) => void;
  setEditEnd: (s: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onNote: () => void;
  onSetBackup: (v: string) => void;
  onSaveDates: () => void;
  onReqEdit: () => void;
  onReviewed: () => void;
}

function LeavePanel(p: PanelProps) {
  const { lv, dec, rl, tr } = p;
  const isPending = lv.status === 'بانتظار الاعتماد';

  // workflow metadata carried on the shared record
  const meta = lv as Leave & { _mret?: string; _mowner?: string; _mlog?: { at: string; to?: string; note?: string; by?: string; chair?: boolean }[] };
  const log = meta._mlog || [];
  const last = log[0];
  const chairName = rl('رئيس القطاع', 'Sector Head');
  const ownerName = p.users.find((u) => u.id === meta._mowner)?.name;
  const sourceDisp = ownerName ? rl('إدخال يدوي — ', 'Manual entry — ') + tr(ownerName) : rl('بيانات النظام', 'System data');
  const lastBy = last ? (last.by ? tr(last.by) : (last.chair ? chairName : sourceDisp)) : '';

  // substitute pool: exclude self + anyone on an overlapping active leave in same category
  const ss = parseAr(lv.start), se = parseAr(lv.end);
  const busy: Record<string, boolean> = {};
  for (const x of p.parsed) {
    if (x.lv.id !== lv.id && activeForConflict(x.lv) && x.lv.cat === lv.cat && ss && se && x.s <= se && ss <= x.e) busy[x.lv.person] = true;
  }
  const seen: Record<string, boolean> = {};
  const pool: string[] = [];
  const add = (n: string) => { if (n && !seen[n]) { seen[n] = true; pool.push(n); } };
  if (lv.cat === 'manager') { p.managerNames.forEach(add); p.sectorManagers.forEach(add); }
  else { p.members.forEach(add); p.officeNames.forEach(add); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0ec' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Avatar name={lv.person} size={44} radius={12} />
            <div>
              <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: '#17211c' }}>{lv.person}</h2>
              <div style={{ fontSize: 12, color: '#8a8078' }}>{lv.role}</div>
            </div>
          </div>
          <button onClick={p.onClose} style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15 }}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge bg={dec.bg} fg={dec.fg} style={{ fontSize: 11, padding: '4px 12px' }}>{dec.statusLabel}</Badge>
          {dec.phase && <Badge bg={dec.phBg} fg={dec.phFg} style={{ fontSize: 11, padding: '4px 12px' }}>{dec.phaseLabel}</Badge>}
          <Badge bg="#f2f4f0" fg="#6d7973" style={{ fontSize: 11, padding: '4px 12px', fontWeight: 600 }}>{dec.catLabel}</Badge>
          {dec.hasConflict && <Badge bg="#f6e5df" fg="#b0433b" style={{ fontSize: 11, padding: '4px 12px' }}>{rl('تعارض', 'Conflict')}</Badge>}
          {p.reviewed && <Badge bg="#e2f0e8" fg="#2e7d55" style={{ fontSize: 11, padding: '4px 12px' }}>{rl('تمت المراجعة', 'Reviewed')}</Badge>}
        </div>
      </div>

      {/* body */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {!!(meta._mret && meta._mret.trim()) && (
          <div style={{ background: '#fdf3f2', border: '1.5px solid #e7b8b3', borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#b0433b', marginBottom: 4, fontWeight: 800 }}>{rl('أُعيدت للتعديل من رئيس القطاع — سبب الإرجاع', 'Returned by the Sector Head — reason')}</div>
            <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{meta._mret}</div>
          </div>
        )}
        {dec.hasConflict && (
          <div style={{ background: '#fdf3ef', border: '1px solid #f0d8ce', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#b0433b', marginBottom: 4, fontWeight: 700 }}>{rl('يتعارض مع', 'Conflicts with')}</div>
            <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{dec.conflictWith}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 130, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('نوع الإجازة', 'Leave type')}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{tr(lv.type)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 130, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('عدد الأيام', 'Days')}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{lv.days} {rl('أيام', 'days')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 130, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('تاريخ البداية', 'Start date')}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{tr(lv.start)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 130, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('تاريخ النهاية', 'End date')}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{tr(lv.end)}</div>
          </div>
        </div>
        {/* period + edit dates */}
        <div style={{ background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b' }}>{rl('الفترة', 'Period')}</div>
            {!p.editingDates && !p.canManage && !p.canApprove && (
              <button onClick={() => { p.setEditStart(lv.start); p.setEditEnd(lv.end); p.setEditingDates(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ffffff', border: '1px solid #e2e6df', color: '#1f4a37', borderRadius: 8, padding: '4px 9px', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                {rl('طلب تعديل الفترة', 'Edit dates')}
              </button>
            )}
          </div>
          {!p.editingDates && <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{dec.period}</div>}
          {p.editingDates && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <label style={{ flex: 1, fontSize: 10, color: '#9aa39b' }}>{rl('من', 'From')}
                  <DateField value={p.editStart} onChange={p.setEditStart} style={{ marginTop: 3, background: '#ffffff', borderRadius: 8, padding: '7px 9px', fontSize: 12 }} />
                </label>
                <label style={{ flex: 1, fontSize: 10, color: '#9aa39b' }}>{rl('إلى', 'To')}
                  <DateField value={p.editEnd} onChange={p.setEditEnd} style={{ marginTop: 3, background: '#ffffff', borderRadius: 8, padding: '7px 9px', fontSize: 12 }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                <button onClick={p.onSaveDates} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {rl('حفظ', 'Save')}
                </button>
                <button onClick={() => p.setEditingDates(false)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#7d867f', borderRadius: 8, padding: '7px 14px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
              </div>
            </>
          )}
        </div>
        <div><div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 4 }}>{rl('الإدارة', 'Unit')}</div><div style={{ fontSize: 12.5, color: '#2a332d', lineHeight: 1.6 }}>{lv.dept}</div></div>
        <div><div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 4 }}>{rl('البديل المعيّن', 'Assigned backup')}</div><div style={{ fontSize: 12.5, color: '#2a332d', lineHeight: 1.6 }}>{dec.backupDisp}</div></div>
        {!!(lv.attachments && lv.attachments.length) && (
          <div>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 6 }}>{rl('المرفقات الداعمة', 'Supporting attachments')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lv.attachments.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 9, padding: '8px 11px', fontSize: 12, color: '#2a332d' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a}</span>
                  <AttachmentDownload name={a} size={24} />
                </div>
              ))}
            </div>
          </div>
        )}
        {!!(lv.chairNotes && lv.chairNotes.trim()) && (
          <div style={{ background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#1e4634', marginBottom: 4, fontWeight: 700 }}>{rl('ملاحظات وتوجيهات رئيس القطاع', 'Sector Head comments & instructions')}</div>
            <div style={{ fontSize: 12.5, color: '#2b4a3a', lineHeight: 1.7 }}>{lv.chairNotes}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('مصدر المعلومة', 'Information source')}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c', lineHeight: 1.6 }}>{sourceDisp}</div>
          </div>
          <div style={{ flex: 1, minWidth: 150, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('آخر تحديث', 'Last update')}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c', lineHeight: 1.6 }}>
              {last ? tr(last.at) + ' — ' + lastBy : rl('لا توجد تحديثات بعد', 'No updates yet')}
            </div>
          </div>
        </div>
        {log.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 6 }}>{rl('سجل التغييرات', 'Change log')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {log.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: e.chair ? '#fbf7ee' : '#f4f8f5', border: '1px solid ' + (e.chair ? '#efe3c9' : '#dfeae2'), borderRadius: 10, padding: '8px 11px' }}>
                  <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', marginTop: 5, background: e.chair ? '#c9a24b' : '#2e7d55' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#17211c' }}>{tr(e.to || '')}</div>
                    {e.note && <div style={{ fontSize: 11, color: '#5b6b62', lineHeight: 1.6 }}>{e.note}</div>}
                    <div style={{ fontSize: 9.5, color: '#9aa39b', marginTop: 2 }}>{tr(e.at)} · {e.by ? tr(e.by) : (e.chair ? chairName : sourceDisp)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!!(lv.notes && lv.notes.trim()) && (
          <div style={{ background: '#fbf7ee', border: '1px solid #efe3c9', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: '#a9791f', marginBottom: 4 }}>{rl('ملاحظات', 'Notes')}</div>
            <div style={{ fontSize: 12.5, color: '#6b5b1e', lineHeight: 1.7 }}>{lv.notes}</div>
          </div>
        )}
        {p.canNote && !p.canManage && (
          <>
            <div>
              <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 5 }}>{rl('إضافة ملاحظة / سبب رفض', 'Add note / rejection reason')}</div>
              <textarea value={p.noteDraft} onChange={(e) => p.setNoteDraft(e.target.value)} placeholder={rl('اكتب ملاحظتك هنا…', 'Write your note…')} style={{ width: '100%', minHeight: 66, resize: 'vertical', boxSizing: 'border-box', border: '1px solid #e2e6df', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', lineHeight: 1.6 }} />
            </div>
            {!p.canApprove && <div>
              <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 5 }}>{rl('تعيين بديل', 'Assign backup')}</div>
              <input list="lv-bk-panel" defaultValue={lv.backup && lv.backup !== '—' ? lv.backup : ''}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onBlur={(e) => { const v = e.target.value.trim(); const cur = lv.backup && lv.backup !== '—' ? lv.backup : ''; if (v !== cur) p.onSetBackup(v || '—'); }}
                placeholder={rl('اكتب اسم البديل…', 'Type backup name…')}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' }} />
              <datalist id="lv-bk-panel">{pool.filter((n) => n !== lv.person).map((n, i) => <option key={i} value={n} />)}</datalist>
            </div>}
          </>
        )}
      </div>

      {/* footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0ec', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, background: '#fafbf9' }}>
        {isPending && p.canApprove && (
          <>
            <button onClick={p.onApprove} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {rl('اعتماد', 'Approve')}
            </button>
            <button onClick={p.onReject} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7e6e4', border: '1px solid #f0d3cf', color: '#b0433b', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              {rl('رفض', 'Reject')}
            </button>
          </>
        )}
        {p.canNote && !p.canManage && !p.canApprove && (
          <button onClick={p.onNote} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            {rl('ملاحظة', 'Note')}
          </button>
        )}
        {p.canManage && (
          <>
            <button onClick={p.onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              {rl('تعديل', 'Edit')}
            </button>
            <button onClick={p.onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 9, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{rl('إلغاء', 'Cancel')}</button>
            <span style={{ width: '100%', fontSize: 10, color: '#9aa39b', lineHeight: 1.6 }}>
              {rl('الاعتماد الرسمي وتعديل الأرصدة ومعالجة الإجازة في Oracle من اختصاص الموارد البشرية — هذه الشاشة للتخطيط الداخلي فقط.', 'Official approval, balances and Oracle processing stay with HR — this screen is for internal planning only.')}
            </span>
          </>
        )}
        {p.canReview && !p.canManage && !p.canApprove && (
          <>
            <button onClick={p.onReqEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
              {rl('طلب تعديل الفترة', 'Request edit')}
            </button>
            <button onClick={p.onReviewed} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e2f0e8', border: '1px solid #cfe6d9', color: '#2e7d55', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {rl('تمت المراجعة', 'Reviewed')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Leave planning form (leave planner): employee or sector director,
   type, dates with auto day-count, backup, notes, chair instructions and
   supporting attachments. Conflicts are detected live; conflicted or
   review-worthy records can be sent to the Sector Head. Official approval,
   balances and Oracle processing are out of scope by design. ---- */
function LeaveFormFields({ leaveId, onDone, onCancel }: { leaveId: string | null; onDone: () => void; onCancel: () => void }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const existing = leaveId ? data.leaves.find((l) => l.id === leaveId) : null;
  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    person: existing.person, cat: existing.cat || 'office', type: existing.type, start: existing.start, end: existing.end,
    backup: existing.backup || '—', notes: existing.notes || '', chairNotes: existing.chairNotes || '',
    fstatus: existing.status,
  } : { person: '', cat: 'office', type: 'سنوية', start: '', end: '', backup: '—', notes: '', chairNotes: '', fstatus: 'مخططة' });
  const [atts, setAtts] = useState<string[]>(() => (existing?.attachments ? [...existing.attachments] : []));
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  // people pool: office team + sector directors + department managers (cat derives from the pick)
  const officeNames = data.members.map((m) => m.name);
  const sectorNames = data.sectorManagers.map((m) => m.name);
  const deptMgrNames = DEPT_MANAGERS.filter((n) => !sectorNames.includes(n) && !officeNames.includes(n));
  const managerNames = [...sectorNames, ...deptMgrNames];
  const catOfPerson = (n: string): LeaveCat => (managerNames.includes(n) ? 'manager' : 'office');
  const allPeople = [...officeNames, ...managerNames];
  // free-text name entry: type any name; known names still show as suggestions
  const onPersonChange = (v: string) => setF((p) => ({ ...p, person: v, cat: managerNames.includes(v) ? 'manager' : (officeNames.includes(v) ? 'office' : p.cat) }));

  // auto day count
  const ps = parseAr(f.start), pe = parseAr(f.end);
  const days = ps && pe && +pe >= +ps ? Math.round((+pe - +ps) / DAY) + 1 : 0;

  // live conflict detection: overlapping active leave in the same category
  const clash = (ps && pe && f.person) ? data.leaves.filter((l) => {
    if (l.id === leaveId || !activeForConflict(l)) return false;
    if (l.cat !== ((f.cat as LeaveCat) || catOfPerson(f.person))) return false;
    const s2 = parseAr(l.start), e2 = parseAr(l.end);
    return !!(s2 && e2 && s2 <= pe && ps <= e2);
  }) : [];

  const STATUS_PLAN = ['مخططة', 'منتهية', 'ملغاة'];

  const save = (send: boolean) => {
    if (!f.person) { showToast(rl('يرجى اختيار الموظف أو مدير القطاع', 'Please pick the employee or sector director')); return; }
    if (!ps || !pe || +pe < +ps) { showToast(rl('يرجى ضبط تاريخي البداية والنهاية', 'Please set valid start and end dates')); return; }
    mutate((d) => {
      let lv: Leave & { _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] };
      if (existing) lv = d.leaves.find((l) => l.id === leaveId)! as never;
      else {
        lv = { id: 'lv' + Math.floor(Math.random() * 1e9), person: '', cat: 'office', role: '', dept: '', type: '', start: '', end: '', days: 0, status: 'مخططة', backup: '—', notes: '' };
        d.leaves.unshift(lv);
        lv._mowner = cu.id;
      }
      if (!lv) return;
      lv.person = f.person;
      lv.cat = (f.cat as LeaveCat) || catOfPerson(f.person);
      const mem = d.members.find((m) => m.name === f.person);
      const mgr = d.sectorManagers.find((m) => m.name === f.person);
      lv.role = mem ? mem.role : (mgr ? mgr.role : (lv.role || (deptMgrNames.includes(f.person) ? 'مدير إدارة' : '')));
      lv.dept = mgr ? mgr.dept : (lv.dept || 'مكتب رئيس القطاع');
      lv.type = f.type; lv.start = f.start; lv.end = f.end; lv.days = days;
      lv.backup = f.backup || '—'; lv.notes = (f.notes || '').trim();
      lv.chairNotes = (f.chairNotes || '').trim();
      lv.attachments = atts;
      if (send) {
        lv.status = 'بانتظار الاعتماد';
        lv._mrev = true; lv._mret = ''; lv._mowner = lv._mowner || cu.id;
        (lv._mlog = lv._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: 'بانتظار اعتماد رئيس القطاع', note: clash.length ? rl('تعارض في الجدولة مع: ', 'Scheduling conflict with: ') + clash.map((c) => c.person).join('، ') : '', sent: true, by: cu.name });
      } else if (STATUS_PLAN.includes(f.fstatus)) {
        lv.status = f.fstatus;
      }
    });
    showToast(send
      ? rl('أُرسلت الإجازة لرئيس القطاع للمراجعة', 'Leave sent to the Sector Head for review')
      : rl('تم حفظ سجل الإجازة', 'Leave record saved'));
    onDone();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
  const lockedStatus = existing && !STATUS_PLAN.includes(existing.status);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><Label>{rl('الموظف / المدير', 'Employee / manager')}</Label>
          <input list="lv-people" value={f.person} onChange={(e) => onPersonChange(e.target.value)} placeholder={rl('اكتب الاسم…', 'Type a name…')} style={inputStyle} />
          <datalist id="lv-people">{allPeople.map((n, i) => <option key={i} value={n} />)}</datalist></div>
        <div><Label>{rl('الفئة', 'Group')}</Label>
          <Dropdown value={f.cat} options={[{ v: 'office', label: rl('فريق المكتب', 'Office team') }, { v: 'manager', label: rl('مدراء الوحدات التنظيمية', 'Unit managers') }]} onChange={set('cat')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('نوع الإجازة', 'Leave type')}</Label><Dropdown value={f.type || 'سنوية'} options={['سنوية'].map((v) => ({ v, label: tr(v) }))} onChange={set('type')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('حالة التخطيط', 'Planning status')}</Label>
          {lockedStatus
            ? <div style={{ ...inputStyle, background: '#f2f4f0', color: '#7d867f' }}>{tr(existing!.status)} — {rl('تُدار من رئيس القطاع', 'managed by the Sector Head')}</div>
            : <Dropdown value={f.fstatus} options={STATUS_PLAN.map((v) => ({ v, label: tr(v) }))} onChange={set('fstatus')} opt={{ block: true, size: 'sm' }} />}
        </div>
        <div><Label>{rl('تاريخ البداية', 'Start date')}</Label><DateField value={f.start} onChange={set('start')} /></div>
        <div><Label>{rl('تاريخ النهاية', 'End date')}</Label><DateField value={f.end} onChange={set('end')} /></div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 10, padding: '9px 12px' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1e4634" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>
          <span style={{ fontSize: 12, color: '#3c4a42' }}>{rl('عدد الأيام (محسوب تلقائياً): ', 'Days (auto-calculated): ')}</span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1e4634' }}>{days || '—'}</span>
        </div>
        {clash.length > 0 && (
          <div style={{ gridColumn: '1 / -1', background: '#fdf3ef', border: '1px solid #f0d8ce', borderRadius: 11, padding: '11px 13px' }}>
            <div style={{ fontSize: 11, color: '#b0433b', fontWeight: 800, marginBottom: 4 }}>{rl('تنبيه: تعارض في الجدولة', 'Warning: scheduling conflict')}</div>
            <div style={{ fontSize: 12, color: '#9a3a2b', lineHeight: 1.7 }}>
              {rl('تتداخل هذه الفترة مع: ', 'This period overlaps with: ')}{clash.map((c) => tr(c.person)).join('، ')} — {rl('يُنصح بإرسالها لرئيس القطاع للمراجعة.', 'sending it to the Sector Head for review is recommended.')}
            </div>
          </div>
        )}
        <div><Label>{rl('البديل / القائم بالأعمال', 'Backup / acting person')}</Label>
          <input list="lv-backup" value={f.backup === '—' ? '' : f.backup} onChange={(e) => set('backup')(e.target.value || '—')} placeholder={rl('اكتب اسم البديل… (اختياري)', 'Type backup name… (optional)')} style={inputStyle} />
          <datalist id="lv-backup">{allPeople.filter((n) => n !== f.person).map((n, i) => <option key={i} value={n} />)}</datalist></div>
        <div><Label>{rl('ملاحظات داخلية', 'Internal notes')}</Label><input value={f.notes} onChange={setI('notes')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('ملاحظات وتوجيهات رئيس القطاع', 'Sector Head comments & instructions')}</Label><textarea value={f.chairNotes} onChange={setI('chairNotes')} rows={2} placeholder={rl('تُسجَّل هنا توجيهات رئيس القطاع المتعلقة بهذه الإجازة…', 'Record the Sector Head instructions for this leave…')} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('مرفقات داعمة (إن وجدت)', 'Supporting attachments (optional)')}</Label><FileUploadField files={atts} onChange={setAtts} /></div>
      </div>
      <div style={{ marginTop: 12, fontSize: 10.5, color: '#9aa39b', lineHeight: 1.7 }}>
        {rl('هذه الشاشة للتخطيط الداخلي والاطلاع فقط — الاعتماد الرسمي وتعديل الأرصدة ومعالجة الإجازة في Oracle من اختصاص الموارد البشرية.', 'Internal planning and visibility only — official approval, leave balances and Oracle processing remain with HR.')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        {!existing && <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ', 'Save')}</button>}
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إرسال لرئيس القطاع', 'Send to Sector Head')}</button>
      </div>
    </>
  );
}
