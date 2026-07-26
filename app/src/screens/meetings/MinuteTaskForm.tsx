import { useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { DateField } from '../../components/DateField';
import { FileUploadField } from '../../components/FileUploadField';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import type { MinuteTask } from '../../data/types';
import { MT_STATUSES } from './mtShared';
import { triggerDownload } from '../../shared/fileGen';
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, excelSerialToDate } from '../reportcenter/templateIO';

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
const secHead = (t: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px' }}>
    <span style={{ width: 5, height: 16, borderRadius: 4, background: '#1e4634' }} />
    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#17211c' }}>{t}</span>
  </div>
);

/* ---------- template + bulk import (columns match the ministry's tracking sheet) ---------- */
const TASK_COLS = [
  'تاريخ انعقاد الاجتماع', 'اسم أو موضوع الاجتماع', 'الإدارة المسؤولة', 'التوصيات والمهام',
  'المسؤول عن التنفيذ', 'المتطلبات المسبقة', 'الدعم المطلوب من رئيس القطاع', 'الميزانية المطلوبة',
  'حالة الإنجاز', 'تاريخ الإنجاز المتوقع', 'الاعتماديات', 'الملاحظات',
];
const TASK_EXAMPLES = [
  ['9 يونيو 2026', 'اجتماع القطاع الأسبوعي', 'إدارة الخدمات الذكية والبنية الرقمية', 'إعداد عرض تقديمي شامل عن الوضع الحالي للفواتير', 'محمد الياسي', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'قيد التنفيذ', '20 يونيو 2026', 'لا يوجد', ''],
  ['9 يونيو 2026', 'اجتماع القطاع الأسبوعي', 'إدارة الشؤون الإدارية', 'مراجعة قاعدة بيانات متابعة المهام وتحديث تواريخ الاستحقاق', 'سماح أبو شرخ', 'لا يوجد', 'موافقة على المنهجية', 'لا يوجد', 'لم يبدأ', '25 يونيو 2026', 'لا يوجد', 'يُتابع أسبوعياً'],
];
const dlTaskTemplateDocx = () => triggerDownload(makeDocx(
  wP('قالب إدخال مهام محاضر الاجتماعات', { bold: true, size: 34 }) + wP('املأ صفاً واحداً لكل مهمة — يمكن إضافة عدة صفوف ثم رفع الملف لاستيرادها دفعةً واحدة.') + wP('') + wTbl(TASK_COLS, TASK_EXAMPLES)
), 'Minute_Tasks_Template.docx');
const dlTaskTemplateXlsx = () => triggerDownload(makeXlsx([TASK_COLS, ...TASK_EXAMPLES], 'مهام المحاضر'), 'Minute_Tasks_Template.xlsx');

interface ParsedTask { mDate: string; meeting: string; dept: string; task: string; owner: string; prerequisite: string; support: string; budget: string; status: string; due: string; dependencies: string; notes: string }

// header → field detection (order matters: more specific dates before the generic meeting match)
const FIELD_PATTERNS: [keyof ParsedTask, RegExp][] = [
  ['mDate', /تاريخ.*(انعقاد|الاجتماع)/],
  ['due', /تاريخ.*(الإنجاز|الاستحقاق)|الموعد|المتوقع/],
  ['meeting', /(اسم|موضوع).*اجتماع|^.*الاجتماع/],
  ['dept', /الإدارة/],
  ['task', /التوصيات|المهام|القرارات|الإجراءات|المهمة/],
  ['owner', /المسؤول|المكلّ?ف|التنفيذ/],
  ['prerequisite', /المتطلبات|prerequisite/i],
  ['support', /الدعم|رئيس القطاع/],
  ['budget', /الميزانية|التكلفة/],
  ['status', /الحالة|حالة/],
  ['dependencies', /الاعتماديات|dependencies/i],
  ['notes', /الملاحظات|ملاحظات|توضيحات/],
];
const normStatus = (s: string): string => {
  const v = (s || '').trim();
  const hit = MT_STATUSES.find((st) => v.includes(st));
  if (hit) return hit;
  if (/مستمر|جار/.test(v)) return 'قيد التنفيذ';
  if (/مكتمل|منجز|تم/.test(v)) return 'مكتمل';
  return 'لم يبدأ';
};
function detectCols(headerRow: string[]): Partial<Record<keyof ParsedTask, number>> {
  const map: Partial<Record<keyof ParsedTask, number>> = {}; const used = new Set<string>();
  headerRow.forEach((h, i) => {
    const norm = (h || '').replace(/\s+/g, ' ').trim();
    if (!norm) return;
    for (const [field, re] of FIELD_PATTERNS) {
      if (used.has(field)) continue;
      if (re.test(norm)) { map[field] = i; used.add(field); break; }
    }
  });
  return map;
}
function parseTasks(tables: string[][][]): ParsedTask[] {
  let best = { score: 0, ti: -1, ri: -1, map: {} as Partial<Record<keyof ParsedTask, number>> };
  tables.forEach((t, ti) => t.forEach((row, ri) => {
    const map = detectCols(row); const score = Object.keys(map).length;
    if (score > best.score) best = { score, ti, ri, map };
  }));
  if (best.score < 4 || best.map.task == null) return [];
  const table = tables[best.ti]; const map = best.map;
  const get = (row: string[], k: keyof ParsedTask) => (map[k] != null ? (row[map[k]!] || '').trim() : '');
  const out: ParsedTask[] = [];
  for (let i = best.ri + 1; i < table.length; i++) {
    const row = table[i];
    const task = get(row, 'task');
    if (!task || /^-+$/.test(task)) continue;
    out.push({
      mDate: excelSerialToDate(get(row, 'mDate')), meeting: get(row, 'meeting'), dept: get(row, 'dept'),
      task, owner: get(row, 'owner'), prerequisite: get(row, 'prerequisite'), support: get(row, 'support'),
      budget: get(row, 'budget'), status: normStatus(get(row, 'status')), due: excelSerialToDate(get(row, 'due')),
      dependencies: get(row, 'dependencies'), notes: get(row, 'notes'),
    });
  }
  return out;
}

/** Add/edit a meeting-minutes task in the SAME shared record the chair sees.
 *  Supports bulk import from the ministry template (one row per task). */
export function MinuteTaskForm({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = taskId ? data.mtasks.find((x) => x.id === taskId) : null;
  const pool = Array.from(new Set([...data.members.map((m) => m.name), ...data.sectorManagers.map((m) => m.name)]));

  const meetingOpts = useMemo(() => {
    const m = new Map<string, { mDate: string; dept: string }>();
    data.mtasks.forEach((tk) => { if (!m.has(tk.meeting)) m.set(tk.meeting, { mDate: tk.mDate, dept: tk.dept }); });
    data.meetings.forEach((mt) => { if (!m.has(mt.title)) m.set(mt.title, { mDate: mt.date, dept: mt.entity || 'مكتب رئيس القطاع' }); });
    return m;
  }, [data.mtasks, data.meetings]);

  const [meeting, setMeeting] = useState(existing?.meeting || '');
  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    task: existing.task, desc: existing.desc || '', dept: existing.dept, mDate: existing.mDate === '—' ? '' : existing.mDate,
    due: existing.due === '—' ? '' : existing.due, status: existing.status, prog: String(existing.prog ?? ''),
    prerequisite: existing.prerequisite === 'لا يوجد' ? '' : existing.prerequisite, support: existing.support === 'لا يوجد' ? '' : existing.support,
    budget: existing.budget === 'لا يوجد' ? '' : existing.budget, dependencies: existing.dependencies === 'لا يوجد' ? '' : existing.dependencies,
    notes: existing.notes || '',
  } : { task: '', desc: '', dept: '', mDate: '', due: '', status: 'لم يبدأ', prog: '', prerequisite: '', support: '', budget: '', dependencies: '', notes: '' });
  const [owner, setOwner] = useState(existing?.owner || cu.name);
  const [participants, setParticipants] = useState<string[]>(() => existing?.participants ? [...existing.participants] : []);
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : []);
  const [bulk, setBulk] = useState<ParsedTask[] | null>(null);
  const [parsedFrom, setParsedFrom] = useState('');
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const meetingList = [...new Set([...meetingOpts.keys(), ...(meeting && !meetingOpts.has(meeting) ? [meeting] : [])])];

  const pickMeeting = (title: string) => {
    setMeeting(title);
    const info = meetingOpts.get(title);
    if (info && !existing) setF((p) => ({ ...p, dept: p.dept || info.dept, mDate: p.mDate || info.mDate }));
  };

  const onUpload = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      const tasks = blocks ? parseTasks(blocks.tables) : [];
      if (!tasks.length) { showToast('تعذّر التعرّف على مهام في الملف — تأكد من مطابقته للقالب'); return; }
      setParsedFrom(file.name);
      if (tasks.length === 1) {
        const t = tasks[0]; setBulk(null);
        if (t.meeting) setMeeting(t.meeting);
        setF((p) => ({ ...p, task: t.task, dept: t.dept || p.dept, mDate: t.mDate || p.mDate, due: t.due || p.due, status: t.status || p.status, prerequisite: t.prerequisite, support: t.support, budget: t.budget, dependencies: t.dependencies, notes: t.notes }));
        if (t.owner && pool.includes(t.owner)) setOwner(t.owner);
        showToast('قُرئت مهمة واحدة من الملف — راجع البيانات قبل الحفظ');
      } else {
        setBulk(tasks);
        showToast('تم العثور على ' + tasks.length + ' مهمة في الملف');
      }
    } catch {
      showToast('تعذّرت قراءة الملف');
    }
  };

  const makeTask = (t: ParsedTask): MinuteTask & { _mowner: string; _mlog: unknown[] } => ({
    id: 'mtk' + Math.floor(Math.random() * 1e9), mDate: t.mDate || '—', meeting: t.meeting || meeting || '—', dept: t.dept || '—',
    task: t.task, desc: '', owner: t.owner || cu.name, participants: [], support: t.support || 'لا يوجد', prerequisite: t.prerequisite || 'لا يوجد',
    budget: t.budget || 'لا يوجد', dependencies: t.dependencies || 'لا يوجد', status: t.status || 'لم يبدأ', due: t.due || '—', prog: 0,
    lastUpdate: 'الآن — ' + cu.name, attachments: [], notes: t.notes || '', directives: [], reviewed: false,
    _mowner: cu.id, _mlog: [{ at: 'الآن', to: 'استيراد من ملف', by: cu.name }],
  });

  const importAll = (send: boolean) => {
    if (!bulk || !bulk.length) return;
    mutate((d) => {
      bulk.forEach((t) => {
        const tk = makeTask(t) as MinuteTask & { _mrev?: boolean; _mret?: string; _mowner: string; _mlog: unknown[] };
        if (send) { tk._mrev = true; tk._mret = ''; (tk._mlog[0] as { to: string; sent?: boolean }).to = 'بانتظار اعتماد رئيس القطاع'; (tk._mlog[0] as { sent?: boolean }).sent = true; }
        d.mtasks.unshift(tk);
      });
    });
    showToast((send ? 'أُرسلت ' : 'أُضيفت ') + bulk.length + ' مهمة إلى سجل مهام المحاضر');
    onClose();
  };

  const save = (send: boolean) => {
    if (!meeting) { showToast('يرجى اختيار الاجتماع / المحضر المرتبط أولاً'); return; }
    if (!(f.task || '').trim()) { showToast('يرجى إدخال عنوان المهمة'); return; }
    const info = meetingOpts.get(meeting);
    mutate((d) => {
      let tk: MinuteTask & { _mrev?: boolean; _mret?: string; _mowner?: string; _mlog?: unknown[] };
      if (existing) tk = d.mtasks.find((x) => x.id === taskId)! as never;
      else {
        tk = { id: 'mtk' + Math.floor(Math.random() * 1e9), mDate: '', meeting: '', dept: '', task: '', owner: cu.name, support: 'لا يوجد', prerequisite: 'لا يوجد', budget: 'لا يوجد', dependencies: 'لا يوجد', status: 'لم يبدأ', due: '—', notes: '', directives: [], reviewed: false };
        d.mtasks.unshift(tk);
        tk._mowner = cu.id;
      }
      if (!tk) return;
      tk.meeting = meeting;
      tk.mDate = (f.mDate || '').trim() || info?.mDate || tk.mDate || '—';
      tk.dept = (f.dept || '').trim() || info?.dept || '—';
      tk.task = f.task.trim(); tk.desc = (f.desc || '').trim();
      tk.owner = owner || cu.name; tk.participants = participants.filter(Boolean);
      tk.due = (f.due || '').trim() || '—'; tk.status = f.status || 'لم يبدأ';
      tk.prog = Math.max(0, Math.min(100, parseInt(f.prog, 10) || 0));
      tk.prerequisite = (f.prerequisite || '').trim() || 'لا يوجد';
      tk.support = (f.support || '').trim() || 'لا يوجد';
      tk.budget = (f.budget || '').trim() || 'لا يوجد';
      tk.dependencies = (f.dependencies || '').trim() || 'لا يوجد';
      tk.attachments = atts; tk.notes = (f.notes || '').trim();
      tk.lastUpdate = 'الآن — ' + cu.name;
      if (send) { tk._mrev = true; tk._mret = ''; tk._mowner = tk._mowner || cu.id; }
      (tk._mlog = tk._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار اعتماد رئيس القطاع' : (existing ? 'تحديث بيانات المهمة' : 'إنشاء المهمة'), sent: !!send, by: cu.name });
    });
    showToast(send ? 'أُرسلت المهمة لرئيس القطاع للمراجعة — ظاهرة لديه في مهام المحاضر' : (existing ? 'حُفظت تعديلات المهمة' : 'حُفظت المهمة'));
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={720}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل مهمة المحضر' : 'إضافة مهمة جديدة'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>تُحفظ في نفس سجل مهام المحاضر الذي يراه رئيس القطاع — لا يُنشأ سجل مكرر عند التعديل.</p>

      {!existing && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
            <button type="button" onClick={dlTaskTemplateDocx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب Word
            </button>
            <button type="button" onClick={dlTaskTemplateXlsx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب Excel
            </button>
            <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.csv,.html,.htm,.txt" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 0-4 4m4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
              رفع القالب المكتمل (مهمة أو أكثر)
            </button>
            <span style={{ fontSize: 10.5, color: '#7d867f' }}>يقبل صفاً واحداً أو عدة صفوف — كل صف = مهمة. Word أو Excel.</span>
          </div>

          {bulk && bulk.length > 1 && (
            <div style={{ margin: '8px 0 4px', background: '#eef3f0', border: '1px solid #cfe0d5', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e4634' }}>تم العثور على {bulk.length} مهمة في «{parsedFrom}»</div>
                <button type="button" onClick={() => { setBulk(null); setParsedFrom(''); }} style={{ background: 'transparent', border: 'none', color: '#7d867f', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>إلغاء الاستيراد</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                {bulk.map((t, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e6ece7', borderRadius: 9, padding: '8px 11px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#17211c', lineHeight: 1.5 }}>{i + 1}. {t.task}</div>
                    <div style={{ fontSize: 10.5, color: '#7d867f', marginTop: 2 }}>{[t.meeting, t.owner || '—', t.status, t.due].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => importAll(false)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '9px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إضافة ({bulk.length})</button>
              </div>
            </div>
          )}
          {parsedFrom && !bulk && (
            <div style={{ margin: '8px 0 0', background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#1e4634' }}>قُرئت مهمة واحدة من «{parsedFrom}» — راجعها وعدّلها أدناه قبل الحفظ.</div>
          )}
        </>
      )}

      {secHead('الاجتماع / المحضر المرتبط')}
      <Dropdown value={meeting} options={meetingList.map((tt) => ({ v: tt, label: tr(tt) }))} onChange={pickMeeting} opt={{ block: true, size: 'sm', placeholder: 'اختر الاجتماع أو المحضر المرتبط…' }} />

      {secHead('بيانات المهمة')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><Label>تاريخ انعقاد الاجتماع</Label><DateField value={f.mDate} onChange={(v) => setF((p) => ({ ...p, mDate: v }))} /></div>
        <div><Label>الجهة / الإدارة المسؤولة</Label><input value={f.dept} onChange={setI('dept')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>التوصيات والمهام (المطلوب تنفيذه)</Label><textarea value={f.task} onChange={setI('task')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>وصف إضافي (اختياري)</Label><textarea value={f.desc} onChange={setI('desc')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div><Label>المسؤول عن التنفيذ</Label><input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="اكتب اسم المسؤول…" style={inputStyle} /></div>
        <div><Label>تاريخ الإنجاز المتوقع</Label><DateField value={f.due} onChange={(v) => setF((p) => ({ ...p, due: v }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px', gap: 10 }}>
          <div><Label>حالة الإنجاز</Label><Dropdown value={f.status} options={MT_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setF((p) => ({ ...p, status: v }))} opt={{ block: true, size: 'sm' }} /></div>
          <div><Label>الإنجاز %</Label><input value={f.prog} onChange={setI('prog')} placeholder="%" style={{ ...inputStyle, textAlign: 'center' }} /></div>
        </div>
        <div><Label>الميزانية المطلوبة</Label><input value={f.budget} onChange={setI('budget')} placeholder="التكلفة التقديرية إن وجدت" style={inputStyle} /></div>
      </div>

      {secHead('المتطلبات والاعتماديات')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><Label>المتطلبات المسبقة</Label><textarea value={f.prerequisite} onChange={setI('prerequisite')} rows={2} placeholder="ما يجب توفره قبل البدء" style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div><Label>الدعم المطلوب من رئيس القطاع</Label><textarea value={f.support} onChange={setI('support')} rows={2} placeholder="أي موافقات أو توجيهات مطلوبة" style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>الاعتماديات (المهام أو الجهات المرتبطة)</Label><input value={f.dependencies} onChange={setI('dependencies')} style={inputStyle} /></div>
      </div>

      {secHead('مشاركون إضافيون')}
      <div>
        <Dropdown value="" options={pool.filter((n) => n !== owner && !participants.includes(n)).map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => { if (v) setParticipants((p) => [...p, v]); }} opt={{ block: true, size: 'sm', placeholder: 'إضافة مشارك…' }} />
        {participants.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
            {participants.map((n) => (
              <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e4634', background: '#eef5f0', color: '#1e4634', borderRadius: 20, padding: '4px 9px', fontSize: 11.5, fontWeight: 700 }}>
                {tr(n)}
                <button type="button" onClick={() => setParticipants((p) => p.filter((x) => x !== n))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {secHead('المرفقات')}
      <FileUploadField files={atts} onChange={setAtts} />

      {secHead('ملاحظات')}
      <textarea value={f.notes} onChange={setI('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>حفظ</button>
      </div>
    </Modal>
  );
}
