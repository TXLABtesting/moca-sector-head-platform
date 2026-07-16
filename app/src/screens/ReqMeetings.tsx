import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useToast } from '../components/Toast';
import { Dropdown } from '../components/Dropdown';
import { Fade, Modal } from '../components/ui';
import { DateField } from '../components/DateField';
import { FileUploadField } from '../components/FileUploadField';
import { AttachmentDownload } from '../components/AttachmentDownload';
import {
  parseProposed, timeRange, timeLabel, ymdKey, outlookUrl,
  type ProposedParts,
} from '../shared/helpers';
import { AR_MONTHS, AR_DAYS, EN_DAYS } from '../shared/constants';
import type { ReqMeeting } from '../data/types';

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TODAY_KEY = '2026-07-06';

/** Pill (rounded status label) colours — [bg, fg]. */
const PILL: Record<string, [string, string]> = {
  'مسودة': ['#eceeeb', '#6d7973'],
  'بانتظار الاعتماد': ['#fbf0d6', '#a9791f'],
  'معتمد': ['#e2f0e8', '#2e7d55'],
  'تم اقتراح موعد آخر': ['#e6eef6', '#3a6ea5'],
  'ملغي': ['#f0eeeb', '#8a8078'],
};

const HATCH = (a: string, b: string) =>
  `repeating-linear-gradient(45deg,${a},${a} 5px,${b} 5px,${b} 10px)`;

interface ChipStyle { bg: string; title: string; time: string; bar: string; dec: string }
/** Calendar chip styling by status: approved = solid green, others = hatched/shaded. */
const CHIP_STYLE: Record<string, ChipStyle> = {
  'مسودة': { bg: HATCH('#f2f3f0', '#e8eae5'), title: '#6d7973', time: '#8a938c', bar: '#b7bdb4', dec: 'none' },
  'معتمد': { bg: '#1f8a5b', title: '#ffffff', time: '#d7f0e2', bar: '#0f6b42', dec: 'none' },
  'بانتظار الاعتماد': { bg: HATCH('#fdf6e6', '#f6ead0'), title: '#7a5a12', time: '#a9791f', bar: '#e9c877', dec: 'none' },
  'تم اقتراح موعد آخر': { bg: HATCH('#eef3f9', '#dde8f4'), title: '#2f5f8f', time: '#2f6aa8', bar: '#3a6ea5', dec: 'none' },
  'ملغي': { bg: HATCH('#f3f2f0', '#e8e6e2'), title: '#8a8078', time: '#8a8078', bar: '#b7afb0', dec: 'line-through' },
};

interface Chip {
  id: string; subject: string; time: string;
  cardBg: string; titleColor: string; timeColor: string; bar: string; titleDec: string;
}

type CalMode = 'day' | 'week' | 'month';
type ModalKind = null | 'propose' | 'cancel';

export function ReqMeetings() {
  const { lang, t, tr, dl } = useI18n();
  const reqMeetings = useStore((s) => s.data.reqMeetings);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const { showToast } = useToast();

  // Final approval / permanent cancellation are chair-only; members with edit
  // rights manage the meeting lifecycle (create → send → re-time → Outlook).
  const isChair = cu.type === 'chair';
  const chairDecide = isChair;
  const memberManage = !isChair && can(cu, 'meetings', 'edit');
  const canAddMeeting = can(cu, 'meetings', 'add');
  const L = lang === 'en';
  const rl = (a: string, b: string) => (L ? b : a);

  const [tableView, setTableView] = useState(false);
  const [calMode, setCalMode] = useState<CalMode>('week');
  const [calAnchor, setCalAnchor] = useState('2026-07-06');
  const [popupId, setPopupId] = useState<string | null>(null);
  const [popupEdit, setPopupEdit] = useState(false);
  const [mtForm, setMtForm] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '', time: '', timeEnd: '', note: '' });

  const closePopup = () => { setPopupId(null); setPopupEdit(false); };
  const { params } = useNav();
  useEffect(() => {
    const t = params.selMeeting as string | undefined;
    if (t) { setPopupId(t); setPopupEdit(false); }
  }, [params.selMeeting]);

  // ---- actions (persisted via mutate) ----
  function approveMeeting(id: string) {
    const m = reqMeetings.find((r) => r.id === id);
    mutate((d) => {
      const x = d.reqMeetings.find((r) => r.id === id);
      if (x) { x.status = 'معتمد'; x.decision = 'تم الاعتماد'; }
    });
    if (m) { try { window.open(outlookUrl(m), '_blank'); } catch { /* noop */ } }
    showToast(t('rm_approvedToast'));
  }
  function cancelMeeting(id: string) {
    mutate((d) => {
      const x = d.reqMeetings.find((r) => r.id === id);
      if (x) { x.status = 'ملغي'; x.decision = 'إلغاء'; x.notes = ''; }
    });
    showToast(t('rm_cancelledToast'));
  }
  function sendForReview(id: string) {
    mutate((d) => {
      const m = d.reqMeetings.find((r) => r.id === id);
      if (!m) return;
      m.status = 'بانتظار الاعتماد'; m.decision = '';
      (m as ReqMeeting & { _mowner?: string })._mowner = (m as ReqMeeting & { _mowner?: string })._mowner || cu.id;
    });
    showToast(rl('أُرسل الاجتماع لرئيس القطاع للمراجعة', 'Meeting sent to the Sector Head for review'));
  }
  function acceptNewTime(id: string) {
    mutate((d) => {
      const m = d.reqMeetings.find((r) => r.id === id);
      if (!m) return;
      const datePart = m.newDate || m.proposed.split(' - ')[0];
      const timePart = m.newTime || m.proposed.split(' - ').slice(1).join(' - ');
      m.proposed = datePart + (timePart ? ' - ' + timePart : '');
      m.status = 'بانتظار الاعتماد'; m.decision = 'تم تحديث الموعد';
      m.newDate = ''; m.newTime = ''; m.notes = '';
    });
    showToast(rl('تم تحديث موعد الاجتماع وإعادة إرساله للاعتماد', 'Meeting time updated and resent for approval'));
  }
  function openModal(kind: Exclude<ModalKind, null>, id: string) {
    setForm({ date: '', time: '', timeEnd: '', note: '' });
    setSelId(id);
    setModal(kind);
  }
  function saveRm() {
    const f = form;
    const id = selId;
    mutate((d) => {
      const m = d.reqMeetings.find((r) => r.id === id);
      if (!m) return;
      if (modal === 'propose') {
        m.status = 'تم اقتراح موعد آخر';
        m.decision = 'اقتراح موعد آخر';
        m.newDate = f.date || '';
        m.newTime = (f.time || '') + (f.time && f.timeEnd ? ' - ' + f.timeEnd : '');
        m.notes = f.note || '';
      } else {
        m.status = 'ملغي';
        m.decision = 'إلغاء';
        m.notes = f.note || '';
      }
    });
    setModal(null);
  }

  // ---- decorate a meeting for popup / table ----
  function dec(m: ReqMeeting) {
    const pp = parseProposed(m.proposed);
    const proposedDisp = pp && !pp.hasEnd
      ? dl(m.proposed) + ' – ' + timeLabel(pp.endH, pp.endMin)
      : dl(m.proposed);
    const [bg, fg] = PILL[m.status] || ['#eceeeb', '#6d7973'];
    return {
      id: m.id,
      subject: tr(m.subject),
      attendees: tr(m.attendees),
      basis: tr(m.basis),
      proposedDisp,
      statusLabel: tr(m.status),
      decisionLabel: m.decision ? tr(m.decision) : '—',
      notesDisp: m.notes || '—',
      newDateDisp: m.newDate ? dl(m.newDate) : '',
      bg, fg,
      isPending: m.status === 'بانتظار الاعتماد',
      isApproved: m.status === 'معتمد',
      isDraft: m.status === 'مسودة',
      isProposed: m.status === 'تم اقتراح موعد آخر',
      hasNew: !!m.newDate,
      locationDisp: m.location ? tr(m.location) : '',
      linkDisp: m.link || '',
      agendaList: m.agenda || [],
      _raw: m,
    };
  }

  // ---- calendar chip ----
  function chip(m: ReqMeeting): Chip {
    const c = CHIP_STYLE[m.status] || { bg: '#eef1ec', title: '#17211c', time: '#5b6b62', bar: '#9aa39b', dec: 'none' };
    const p = parseProposed(m.proposed);
    return {
      id: m.id, subject: tr(m.subject), time: p ? timeRange(p) : '',
      cardBg: c.bg, titleColor: c.title, timeColor: c.time, bar: c.bar, titleDec: c.dec,
    };
  }

  const monthName = (mi: number) => (L ? EN_MONTHS[mi] : AR_MONTHS[mi]);
  const dName = (wd: number) => (L ? EN_DAYS[wd] : AR_DAYS[wd]);

  const parsed = reqMeetings
    .map((m) => ({ m, p: parseProposed(m.proposed) }))
    .filter((x): x is { m: ReqMeeting; p: ProposedParts } => !!x.p);

  // ---- Outlook-style calendar layout ----
  const [cay, cam, cad] = calAnchor.split('-').map(Number);
  const anchor = new Date(cay, cam - 1, cad);
  const slotHours = [8, 9, 10, 11, 12, 13, 14, 15];

  let calTitle = '';
  let calDays: { dayName: string; dayNum: number; isToday: boolean; headBg: string; numColor: string }[] = [];
  let calRows: { timeLabel: string; cells: { meetings: Chip[] }[] }[] = [];
  const calWeeks: { days: { dayNum: number; inMonth: boolean; isToday: boolean; meetings: Chip[]; cellBg: string; numColor: string }[] }[] = [];
  let calGridCols = '64px 1fr';

  if (calMode === 'month') {
    const first = new Date(cay, anchor.getMonth(), 1);
    const startWd = (first.getDay() + 6) % 7; // Mon = 0
    const gridStart = new Date(first);
    gridStart.setDate(1 - startWd);
    calTitle = monthName(anchor.getMonth()) + ' ' + cay;
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 5; d++) {
        const cur = new Date(gridStart);
        cur.setDate(gridStart.getDate() + w * 7 + d);
        const key = ymdKey(cur);
        const inM = cur.getMonth() === anchor.getMonth();
        const isT = key === TODAY_KEY;
        const dayMs = parsed.filter((x) => x.p.key === key).map((x) => chip(x.m));
        days.push({
          dayNum: cur.getDate(), inMonth: inM, isToday: isT, meetings: dayMs,
          cellBg: inM ? (isT ? '#eef4f0' : '#fff') : '#fafafa',
          numColor: inM ? (isT ? '#1f8a5b' : '#17211c') : '#c7c2ba',
        });
      }
      calWeeks.push({ days });
    }
  } else {
    let startDt: Date, nDays: number;
    if (calMode === 'day') { startDt = new Date(anchor); nDays = 1; }
    else {
      const wd = (anchor.getDay() + 6) % 7;
      startDt = new Date(anchor);
      startDt.setDate(anchor.getDate() - wd);
      nDays = 5;
    }
    const dayList: Date[] = [];
    for (let i = 0; i < nDays; i++) {
      const cur = new Date(startDt);
      cur.setDate(startDt.getDate() + i);
      dayList.push(cur);
    }
    const endDt = dayList[dayList.length - 1];
    if (calMode === 'day') {
      calTitle = dName(startDt.getDay()) + ' ' + startDt.getDate() + ' ' + monthName(startDt.getMonth()) + ' ' + startDt.getFullYear();
    } else {
      calTitle = startDt.getDate() + ' ' + monthName(startDt.getMonth()) + ' – ' + endDt.getDate() + ' ' + monthName(endDt.getMonth()) + ' ' + endDt.getFullYear();
    }
    calDays = dayList.map((cur) => {
      const isT = ymdKey(cur) === TODAY_KEY;
      return {
        dayName: dName(cur.getDay()), dayNum: cur.getDate(), isToday: isT,
        headBg: isT ? '#eef4f0' : 'transparent',
        numColor: isT ? '#1f8a5b' : '#17211c',
      };
    });
    calRows = slotHours.map((h) => ({
      timeLabel: timeLabel(h, 0),
      cells: dayList.map((cur) => {
        const key = ymdKey(cur);
        const ms = parsed.filter((x) => x.p.key === key && x.p.h === h).map((x) => chip(x.m));
        return { meetings: ms };
      }),
    }));
    const colW = calMode === 'day' ? '1fr' : 'repeat(' + calDays.length + ',1fr)';
    calGridCols = '64px ' + colW;
  }

  const calMonthHeaders = L
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    : ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  function calShift(delta: number) {
    const [y, mo, d] = calAnchor.split('-').map(Number);
    const dt = new Date(y, mo - 1, d);
    if (calMode === 'day') dt.setDate(dt.getDate() + delta);
    else if (calMode === 'month') dt.setMonth(dt.getMonth() + delta);
    else dt.setDate(dt.getDate() + delta * 7);
    setCalAnchor(ymdKey(dt));
  }

  // ---- date / time options for the "propose another time" pickers ----
  const rmDateOpts = (() => {
    const out: { v: string; label: string }[] = [];
    const d = new Date(2026, 6, 6);
    let n = 0;
    while (out.length < 22) {
      const wd = d.getDay();
      if (wd >= 1 && wd <= 5) {
        const lbl = dName(wd) + ' ' + d.getDate() + ' ' + monthName(d.getMonth()) + ' ' + d.getFullYear();
        out.push({ v: d.getDate() + ' ' + AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(), label: lbl });
      }
      d.setDate(d.getDate() + 1);
      if (++n > 60) break;
    }
    return out;
  })();
  const rmTimeOpts = (() => {
    const out: { v: string; label: string }[] = [];
    for (let h = 8; h <= 16; h++) {
      for (const mm of [0, 30]) {
        if (h === 16 && mm > 0) break;
        out.push({ v: timeLabel(h, mm), label: timeLabel(h, mm) });
      }
    }
    return out;
  })();
  const DASH = [{ v: '', label: '—' }];

  const popupMeeting = popupId ? reqMeetings.find((r) => r.id === popupId) : null;
  const pd = popupMeeting ? dec(popupMeeting) : null;

  // ---- style helpers ----
  const modeBtn = (on: boolean): CSSProperties => ({
    border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', background: on ? '#ffffff' : 'transparent', color: on ? '#1f4a37' : '#7d867f',
  });
  const toggleBtn = (on: boolean): CSSProperties => ({
    border: '1px solid #e2e6df', borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    background: on ? '#1f4a37' : '#fff', color: on ? '#fff' : '#3c4a42',
  });

  const tableCols = '2.4fr 1.4fr 1.6fr 1.3fr 1.1fr 1.1fr 1.4fr';

  return (
    <Fade>
      {/* PAGE HEADER: title on the start side, add button opposite */}
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('الاجتماعات', 'Meetings')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('طلبات الاجتماعات وتقويمها — من الإنشاء حتى الاعتماد', 'Meeting requests and calendar — from creation to approval')}</p>
        </div>
        {canAddMeeting && (
          <div className="page-head-action" style={{ flex: 'none' }}>
            <button onClick={() => setMtForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة اجتماع', 'New meeting')}
            </button>
          </div>
        )}
      </div>

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: '#eef1ec', borderRadius: 11, padding: 4 }}>
          <button onClick={() => calShift(-1)} style={{ width: 34, height: 34, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', color: '#3c4a42', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
          <button onClick={() => setCalAnchor('2026-07-06')} style={{ border: 'none', background: '#ffffff', borderRadius: 8, padding: '0 15px', fontSize: 12.5, fontWeight: 600, color: '#1f4a37', cursor: 'pointer' }}>{t('cal_today')}</button>
          <button onClick={() => calShift(1)} style={{ width: 34, height: 34, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', color: '#3c4a42', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
          </button>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#17211c', flex: 1, minWidth: 160 }}>{calTitle}</div>
        <div style={{ display: 'flex', gap: 4, background: '#eef1ec', borderRadius: 11, padding: 4 }}>
          <button onClick={() => setCalMode('day')} style={modeBtn(calMode === 'day')}>{t('cal_day')}</button>
          <button onClick={() => setCalMode('week')} style={modeBtn(calMode === 'week')}>{t('cal_workweek')}</button>
          <button onClick={() => setCalMode('month')} style={modeBtn(calMode === 'month')}>{t('cal_month')}</button>
        </div>
        <button onClick={() => setTableView(true)} style={toggleBtn(tableView)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>{t('cal_asTable')}
        </button>
        <button onClick={() => setTableView(false)} style={toggleBtn(!tableView)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>{t('cal_asCalendar')}
        </button>
      </div>

      {/* CALENDAR */}
      {!tableView && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="cal-scroll" style={{ flex: 1, minWidth: 300, background: '#ffffff', border: '1px solid #eef1ec', borderRadius: 18, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 40px -18px rgba(23,40,32,.14)', overflow: 'hidden' }}>
            {calMode !== 'month' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: calGridCols, background: '#f7f9f6', borderBottom: '1px solid #eef1ec' }}>
                  <div style={{ padding: '12px 0' }} />
                  {calDays.map((d, i) => (
                    <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderInlineStart: '1px solid #eef1ec', background: d.headBg }}>
                      <div style={{ fontSize: 11, color: '#8a938c', fontWeight: 600 }}>{d.dayName}</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: d.numColor, marginTop: 2 }}>{d.dayNum}</div>
                    </div>
                  ))}
                </div>
                {calRows.map((r, ri) => (
                  <div key={ri} style={{ display: 'grid', gridTemplateColumns: calGridCols, borderBottom: '1px solid #f4f6f2', minHeight: 64 }}>
                    <div style={{ padding: '6px 8px', fontSize: 10.5, color: '#9aa39b', textAlign: 'center' }}>{r.timeLabel}</div>
                    {r.cells.map((c, ci) => (
                      <div key={ci} style={{ borderInlineStart: '1px solid #f4f6f2', padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.meetings.map((m) => (
                          <div key={m.id} onClick={() => setPopupId(m.id)} style={{ cursor: 'pointer', background: m.cardBg, borderInlineStart: '3px solid ' + m.bar, borderRadius: 7, padding: '6px 8px' }}>
                            <div style={{ fontSize: 10, color: m.timeColor, fontWeight: 700, marginBottom: 2 }}>{m.time}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: m.titleColor, textDecoration: m.titleDec, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.subject}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: '#f7f9f6', borderBottom: '1px solid #eef1ec' }}>
                  {calMonthHeaders.map((h, i) => (
                    <div key={i} style={{ padding: '11px 8px', textAlign: 'center', fontSize: 11.5, color: '#8a938c', fontWeight: 600, borderInlineStart: '1px solid #eef1ec' }}>{h}</div>
                  ))}
                </div>
                {calWeeks.map((w, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
                    {w.days.map((d, di) => (
                      <div key={di} style={{ minHeight: 96, borderInlineStart: '1px solid #f4f6f2', borderBottom: '1px solid #f4f6f2', padding: 6, background: d.cellBg }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: d.numColor, marginBottom: 4, textAlign: 'center' }}>{d.dayNum}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {d.meetings.map((m) => (
                            <div key={m.id} onClick={() => setPopupId(m.id)} style={{ cursor: 'pointer', background: m.cardBg, borderInlineStart: '3px solid ' + m.bar, borderRadius: 5, padding: '3px 6px' }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: m.timeColor }}>{m.time}</div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: m.titleColor, textDecoration: m.titleDec, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{m.subject}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* TABLE */}
      {tableView && (
        <div style={{ background: '#ffffff', border: '1px solid #eef1ec', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 40px -18px rgba(23,40,32,.14)', overflow: 'hidden' }}>
          <div className="trow" style={{ display: 'grid', gridTemplateColumns: tableCols, gap: 12, padding: '13px 20px', background: '#f7f9f6', borderBottom: '1px solid #eef1ec', fontSize: 11.5, fontWeight: 600, color: '#7d867f' }}>
            <div>{t('rm_subject')}</div><div>{t('rm_attendees')}</div><div>{t('rm_basis')}</div><div>{t('rm_proposed')}</div><div>{t('rm_status')}</div><div>{t('rm_decision')}</div><div>{t('rm_notes')}</div>
          </div>
          {reqMeetings.map((raw) => {
            const m = dec(raw);
            return (
              <div key={m.id} onClick={() => setPopupId(m.id)} className="trow" style={{ display: 'grid', gridTemplateColumns: tableCols, gap: 12, padding: '13px 20px', borderBottom: '1px solid #f2f4f0', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: '#2a332d', lineHeight: 1.4 }}>{m.subject}</div>
                <div style={{ fontSize: 11.5, color: '#5b6b62', lineHeight: 1.4 }}>{m.attendees}</div>
                <div style={{ fontSize: 11.5, color: '#5b6b62', lineHeight: 1.4 }}>{m.basis}</div>
                <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{m.proposedDisp}</div>
                <div><span style={{ fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '4px 9px', background: m.bg, color: m.fg }}>{m.statusLabel}</span></div>
                <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{m.decisionLabel}</div>
                <div style={{ fontSize: 11, color: '#8a938c', lineHeight: 1.4 }}>{m.notesDisp}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL POPUP (side drawer) */}
      {pd && createPortal(
        <div onClick={closePopup} style={{ position: 'fixed', inset: 0, background: 'rgba(23,33,28,.4)', zIndex: 96, display: 'flex', justifyContent: 'flex-start', animation: 'ovBg .2s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 452, maxWidth: '94%', height: '100%', background: '#ffffff', boxShadow: '-8px 0 40px rgba(23,33,28,.18)', display: 'flex', flexDirection: 'column', animation: 'slideInX .28s ease', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0ec' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: pd.bg, color: pd.fg }}>{pd.statusLabel}</span>
                <button onClick={closePopup} style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15 }}>✕</button>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#17211c', lineHeight: 1.5 }}>{pd.subject}</h2>
              {pd.isPending && chairDecide && !popupEdit && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  <button onClick={() => approveMeeting(pd.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{rl('اعتماد', 'Approve')}
                  </button>
                  <button onClick={() => openModal('propose', pd.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef3f6', border: '1px solid #d8e4ee', color: '#2f6aa8', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{rl('اقتراح موعد آخر', 'Propose another time')}
                  </button>
                  <button onClick={() => cancelMeeting(pd.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7e6e4', border: '1px solid #f0d3cf', color: '#b0433b', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>{rl('إلغاء الاجتماع', 'Cancel meeting')}
                  </button>
                </div>
              )}
              {memberManage && !popupEdit && (pd.isDraft || pd.isPending || pd.isProposed) && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setPopupEdit(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>{rl('تعديل الاجتماع', 'Edit meeting')}
                    </button>
                    {pd.isDraft && (
                      <button onClick={() => sendForReview(pd.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>{rl('إرسال لرئيس القطاع', 'Send to Sector Head')}
                      </button>
                    )}
                    {pd.isProposed && pd.hasNew && (
                      <button onClick={() => acceptNewTime(pd.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef3f6', border: '1px solid #d8e4ee', color: '#2f6aa8', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{rl('تحديث الموعد وإعادة الإرسال', 'Update time & resend')}
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 10.5, color: '#9aa39b', lineHeight: 1.6 }}>
                    {rl('الاعتماد النهائي وإلغاء الاجتماع صلاحية رئيس القطاع فقط.', 'Final approval and permanent cancellation are Sector Head-only.')}
                  </div>
                </div>
              )}
            </div>
            {popupEdit && memberManage ? (
              <div style={{ padding: '20px 24px' }}>
                <MeetingFormFields key={pd.id} meetingId={pd.id} onDone={() => setPopupEdit(false)} onCancel={() => setPopupEdit(false)} />
              </div>
            ) : (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
                  <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('الموعد المقترح', 'Proposed time')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{pd.proposedDisp}</div>
                </div>
                <div style={{ flex: 1, minWidth: 150, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
                  <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('الاعتماد', 'Decision')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{pd.decisionLabel}</div>
                </div>
              </div>
              {pd.hasNew && (
                <div style={{ background: '#eef3f6', border: '1px solid #d8e4ee', borderRadius: 11, padding: '11px 13px' }}>
                  <div style={{ fontSize: 10.5, color: '#2f6aa8', marginBottom: 3 }}>{rl('الموعد الجديد المقترح', 'New proposed time')}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2f6aa8' }}>{pd.newDateDisp}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 5 }}>{rl('الحضور', 'Attendees')}</div>
                <div style={{ fontSize: 13, color: '#2a332d', lineHeight: 1.6 }}>{pd.attendees}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 5 }}>{rl('الطلب بناءً على', 'Requested based on')}</div>
                <div style={{ fontSize: 13, color: '#2a332d', lineHeight: 1.6 }}>{pd.basis}</div>
              </div>
              {(pd.locationDisp || pd.linkDisp) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {pd.locationDisp && (
                    <div style={{ flex: 1, minWidth: 150, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
                      <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('مكان الاجتماع', 'Location')}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{pd.locationDisp}</div>
                    </div>
                  )}
                  {pd.linkDisp && (
                    <div style={{ flex: 1, minWidth: 150, background: '#f7f9f6', borderRadius: 11, padding: '11px 13px' }}>
                      <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{rl('رابط الاجتماع الافتراضي', 'Online meeting link')}</div>
                      <a href={pd.linkDisp} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: '#2f6aa8', wordBreak: 'break-all' }}>{pd.linkDisp}</a>
                    </div>
                  )}
                </div>
              )}
              {pd.agendaList.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 6 }}>{rl('جدول الأعمال والمرفقات', 'Agenda & attachments')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pd.agendaList.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 9, padding: '8px 11px', fontSize: 12, color: '#2a332d' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a}</span>
                        <AttachmentDownload name={a} size={24} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 5 }}>{rl('ملاحظات', 'Notes')}</div>
                <div style={{ fontSize: 13, color: '#2a332d', lineHeight: 1.6 }}>{pd.notesDisp}</div>
              </div>
              {pd.isApproved && (
                <button onClick={() => { try { window.open(outlookUrl(pd._raw), '_blank'); } catch { /* noop */ } }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: 11, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginTop: 'auto' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></svg>{rl('إضافة إلى تقويم Outlook', 'Add to Outlook calendar')}
                </button>
              )}
            </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* NEW MEETING MODAL */}
      {mtForm && (
        <Modal open onClose={() => setMtForm(false)} width={620}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{rl('اجتماع جديد', 'New meeting')}</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>{rl('يُدار الاجتماع من الإنشاء حتى تسجيل مخرجاته — والاعتماد النهائي لرئيس القطاع.', 'Managed from creation to outcomes — final approval stays with the Sector Head.')}</p>
          <MeetingFormFields meetingId={null} onDone={() => setMtForm(false)} onCancel={() => setMtForm(false)} />
        </Modal>
      )}

      {/* PROPOSE / CANCEL MODAL */}
      {modal && createPortal(
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(23,33,28,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'ovBg .2s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: 18, width: 440, maxWidth: '100%', animation: 'ovCard .25s ease' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #eef0ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{modal === 'propose' ? t('rm_proposeTitle') : t('rm_cancelTitle')}</h2>
              <button onClick={() => setModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15 }}>✕</button>
            </div>
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {modal === 'propose' && (
                <>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <label style={{ fontSize: 12, color: '#5b6b62', fontWeight: 500, display: 'block', marginBottom: 6 }}>{t('rm_newDate')}</label>
                      <Dropdown value={form.date} options={DASH.concat(rmDateOpts)} onChange={(v) => setForm((f) => ({ ...f, date: v }))} opt={{ block: true, bg: '#f7f8f6', popMaxWidth: '340px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#5b6b62', fontWeight: 500, display: 'block', marginBottom: 6 }}>{t('rm_newTime')}</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: 10.5, color: '#9aa39b', fontWeight: 600, marginBottom: 4 }}>{t('rm_from')}</div>
                        <Dropdown value={form.time} options={DASH.concat(rmTimeOpts)} onChange={(v) => setForm((f) => ({ ...f, time: v }))} opt={{ block: true, bg: '#f7f8f6' }} />
                      </div>
                      <span style={{ color: '#9aa39b', fontWeight: 700, marginTop: 16 }}>–</span>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: 10.5, color: '#9aa39b', fontWeight: 600, marginBottom: 4 }}>{t('rm_to')}</div>
                        <Dropdown value={form.timeEnd} options={DASH.concat(rmTimeOpts)} onChange={(v) => setForm((f) => ({ ...f, timeEnd: v }))} opt={{ block: true, bg: '#f7f8f6' }} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#5b6b62', fontWeight: 500, display: 'block', marginBottom: 6 }}>{t('rm_optNote')}</label>
                    <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} style={{ width: '100%', border: '1px solid #e2e6df', borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                </>
              )}
              {modal === 'cancel' && (
                <div>
                  <label style={{ fontSize: 12, color: '#5b6b62', fontWeight: 500, display: 'block', marginBottom: 6 }}>{t('rm_cancelReason')}</label>
                  <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} style={{ width: '100%', border: '1px solid #e2e6df', borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #eef0ec', display: 'flex', gap: 10 }}>
              <button onClick={saveRm} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('rm_save')}</button>
              <button onClick={() => setModal(null)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#5b6b62', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Fade>
  );
}

/* ---- Meeting lifecycle form (meeting coordinator): subject, attendees,
   requesting entity, proposed date/time, location or online link, agenda
   uploads — saved as draft or sent to the Sector Head for review.
   Rendered inline inside the detail drawer for edits, or in a modal when
   creating a new meeting. ---- */
function MeetingFormFields({ meetingId, onDone, onCancel }: { meetingId: string | null; onDone: () => void; onCancel: () => void }) {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const existing = meetingId ? data.reqMeetings.find((r) => r.id === meetingId) : null;
  const [f, setF] = useState<Record<string, string>>(() => {
    if (existing) {
      const pp = parseProposed(existing.proposed);
      const dm = existing.proposed.match(/(\d+\s+\S+\s+\d{4})/);
      return {
        subject: existing.subject, attendees: existing.attendees, basis: existing.basis,
        date: dm ? dm[1] : '', from: pp ? timeLabel(pp.h, pp.min) : '', to: pp && pp.hasEnd ? timeLabel(pp.endH, pp.endMin) : '',
        location: existing.location || '', link: existing.link || '', note: existing.notes || '',
      };
    }
    return { subject: '', attendees: '', basis: '', date: '', from: '10:00 ص', to: '11:00 ص', location: '', link: '', note: '' };
  });
  const [agenda, setAgenda] = useState<string[]>(() => (existing?.agenda ? [...existing.agenda] : []));
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const timeOpts = (() => {
    const out: { v: string; label: string }[] = [{ v: '', label: '—' }];
    for (let h = 8; h <= 16; h++) for (const mm of [0, 30]) {
      if (h === 16 && mm > 0) break;
      out.push({ v: timeLabel(h, mm), label: timeLabel(h, mm) });
    }
    return out;
  })();

  const save = (send: boolean) => {
    const subject = (f.subject || '').trim();
    if (!subject) { showToast(rl('يرجى إدخال موضوع الاجتماع', 'Please enter the meeting subject')); return; }
    if (!f.date) { showToast(rl('يرجى اختيار تاريخ الاجتماع', 'Please pick the meeting date')); return; }
    const proposed = f.date + ' - ' + (f.from || '10:00 ص') + (f.to ? ' - ' + f.to : '');
    mutate((d) => {
      let m: ReqMeeting & { _mowner?: string };
      if (existing) m = d.reqMeetings.find((r) => r.id === meetingId)! as never;
      else {
        m = { id: 'rm' + Math.floor(Math.random() * 1e9), subject: '', attendees: '', basis: '', proposed: '', status: 'مسودة', decision: '', notes: '' };
        d.reqMeetings.unshift(m);
        m._mowner = cu.id;
      }
      if (!m) return;
      m.subject = subject; m.attendees = (f.attendees || '').trim() || '—'; m.basis = (f.basis || '').trim() || '—';
      m.proposed = proposed;
      m.location = (f.location || '').trim(); m.link = (f.link || '').trim();
      m.agenda = agenda; m.notes = (f.note || '').trim();
      if (send) { m.status = 'بانتظار الاعتماد'; m.decision = ''; m.newDate = ''; m.newTime = ''; m._mowner = m._mowner || cu.id; }
    });
    showToast(send
      ? rl('أُرسل الاجتماع لرئيس القطاع للمراجعة — ظاهر في تقويمه الآن', 'Meeting sent to the Sector Head — now on their calendar')
      : rl('تم حفظ الاجتماع', 'Meeting saved'));
    onDone();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('موضوع الاجتماع', 'Meeting subject')}</Label><input value={f.subject} onChange={setI('subject')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('الحضور', 'Attendees')}</Label><input value={f.attendees} onChange={setI('attendees')} placeholder={rl('مثال: محمد الشرهان، وئام، علي', 'e.g. Mohammed, Weam, Ali')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('الجهة الطالبة / بناءً على', 'Requesting entity / based on')}</Label><input value={f.basis} onChange={setI('basis')} style={inputStyle} /></div>
        <div><Label>{rl('تاريخ الاجتماع', 'Meeting date')}</Label><DateField value={f.date} onChange={set('date')} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Label>{rl('من', 'From')}</Label><Dropdown value={f.from} options={timeOpts} onChange={set('from')} opt={{ block: true, size: 'sm' }} /></div>
          <div style={{ flex: 1 }}><Label>{rl('إلى', 'To')}</Label><Dropdown value={f.to} options={timeOpts} onChange={set('to')} opt={{ block: true, size: 'sm' }} /></div>
        </div>
        <div><Label>{rl('مكان الاجتماع', 'Location')}</Label><input value={f.location} onChange={setI('location')} placeholder={rl('قاعة الاجتماعات - الطابق 12', 'Meeting room — floor 12')} style={inputStyle} /></div>
        <div><Label>{rl('رابط الاجتماع الافتراضي (اختياري)', 'Online meeting link (optional)')}</Label><input value={f.link} onChange={setI('link')} placeholder="https://teams.microsoft.com/…" dir="ltr" style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>{rl('جدول الأعمال والمرفقات', 'Agenda & attachments')}</Label>
          <FileUploadField files={agenda} onChange={setAgenda} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('ملاحظات', 'Notes')}</Label><textarea value={f.note} onChange={setI('note')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{existing && existing.status !== 'مسودة' ? rl('حفظ', 'Save') : rl('حفظ كمسودة', 'Save as draft')}</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إرسال لرئيس القطاع للمراجعة', 'Send to Sector Head for review')}</button>
      </div>
    </>
  );
}
