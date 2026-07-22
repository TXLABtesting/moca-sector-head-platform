import { useRef, useState } from 'react';
import { Modal } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { DateField } from '../../components/DateField';
import { FileUploadField } from '../../components/FileUploadField';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import { triggerDownload } from '../../shared/fileGen';
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, kvLookup, excelSerialToDate } from '../reportcenter/templateIO';
import type { Meeting, MeetingAction } from '../../data/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TASK_STATUSES = ['مفتوح', 'قيد التنفيذ', 'مكتمل', 'متأخر'];

/* ---------------- minutes template (download) + import (auto-fill) ----------------
   One sheet, sectioned: meeting info (key/value), attendees, absentees, topics,
   decisions, resulting tasks (table), and Sector-Head notes — mirroring every
   field of the form so an uploaded template fills it completely. */
const MIN_INFO: [string, string][] = [
  ['موضوع الاجتماع', 'اجتماع لجنة تطوير الخدمات'],
  ['تاريخ الاجتماع', '22 يوليو 2026'],
  ['وقت الاجتماع', '10:00 ص - 11:00 ص'],
  ['الجهة / الإدارة المعنية', 'مكتب رئيس القطاع'],
  ['مكان الاجتماع أو رابطه', 'قاعة الاجتماعات - الطابق 12'],
  ['ملخص الاجتماع', 'استعراض مستجدات المشاريع واعتماد الخطة'],
];
const MIN_ACTION_HEAD = ['المهمة', 'المسؤول', 'تاريخ الإنجاز', 'الحالة', 'نسبة الإنجاز %', 'مشاركون إضافيون'];
function minutesTemplateRows(): string[][] {
  const blanks = (n: number, w: number) => Array.from({ length: n }, () => Array.from({ length: w }, () => ''));
  return [
    ['محضر اجتماع — قالب الإدخال'], [],
    ['١) بيانات الاجتماع'], ['الحقل', 'القيمة'], ...MIN_INFO.map(([k, v]) => [k, v]), [],
    ['٢) الحضور (اسم لكل صف)'], ['الاسم'], ['أحمد المنصوري'], ['فاطمة الحمادي'], ...blanks(4, 1), [],
    ['٣) الغياب (اسم لكل صف)'], ['الاسم'], ['سعيد النعيمي'], ...blanks(4, 1), [],
    ['٤) أبرز المواضيع التي نوقشت'], ['الموضوع'], ['مراجعة مؤشرات الأداء للربع الحالي'], ...blanks(5, 1), [],
    ['٥) القرارات والتوصيات'], ['القرار / التوصية'], ['اعتماد خطة العمل للربع القادم'], ...blanks(5, 1), [],
    ['٦) المهام الناتجة عن الاجتماع'], MIN_ACTION_HEAD,
    ['إعداد تقرير المتابعة', 'أحمد المنصوري', '30 يوليو 2026', 'قيد التنفيذ', '20', 'فاطمة الحمادي'],
    ...blanks(6, 6), [],
    ['٧) ملاحظات رئيس القطاع'], ['الملاحظات', ''],
  ];
}
const dlMinutesXlsx = () => triggerDownload(makeXlsx(minutesTemplateRows(), 'محضر الاجتماع'), 'Meeting_Minutes_Template.xlsx');
const dlMinutesDocx = () => triggerDownload(makeDocx(
  wP('قالب محضر اجتماع', { bold: true, size: 36 }) + wP('') +
  wP('١) بيانات الاجتماع', { bold: true, size: 26 }) + wTbl(['الحقل', 'القيمة'], MIN_INFO.map(([k]) => [k, 'اكتب هنا'])) + wP('') +
  wP('٢) الحضور — اسم لكل سطر', { bold: true, size: 26 }) + wP('…') +
  wP('٣) الغياب — اسم لكل سطر', { bold: true, size: 26 }) + wP('…') +
  wP('٤) أبرز المواضيع التي نوقشت', { bold: true, size: 26 }) + wP('…') +
  wP('٥) القرارات والتوصيات', { bold: true, size: 26 }) + wP('…') +
  wP('٦) المهام الناتجة', { bold: true, size: 26 }) + wTbl(MIN_ACTION_HEAD, [['', '', '', '', '', '']]) + wP('') +
  wP('٧) ملاحظات رئيس القطاع', { bold: true, size: 26 }) + wP('…')
), 'Meeting_Minutes_Template.docx');

interface ParsedMinutes {
  title?: string; date?: string; time?: string; entity?: string; location?: string; summary?: string; chairNotes?: string;
  attendees?: string[]; absentees?: string[]; keyPoints?: string[]; decisions?: string[];
  actions?: MeetingAction[];
}
/** Read a filled minutes template (the sectioned sheet above) back into the form. */
function parseMinutesFile(tables: string[][][]): ParsedMinutes {
  const out: ParsedMinutes = {};
  const kv = (re: RegExp) => kvLookup(tables, re);
  out.title = kv(/^موضوع الاجتماع/);
  out.date = (() => { const v = kv(/^تاريخ الاجتماع/); return v ? excelSerialToDate(v) : undefined; })();
  out.time = kv(/^وقت الاجتماع/);
  out.entity = kv(/^الجهة/);
  out.location = kv(/^مكان الاجتماع/);
  out.summary = kv(/^ملخص الاجتماع/);
  out.chairNotes = kv(/^الملاحظات|^ملاحظات رئيس القطاع/);

  const table = tables.slice().sort((a, b) => b.length - a.length)[0] || [];
  const cell = (r: string[], i: number) => (r && r[i] ? r[i].trim() : '');
  const findRow = (re: RegExp) => table.findIndex((r) => re.test(cell(r, 0)));
  const SECTIONS = [/^١?\)?\s*بيانات/, /الحضور/, /الغياب/, /المواضيع/, /القرارات/, /المهام/, /ملاحظات رئيس/];
  const nextSectionAfter = (start: number) => {
    for (let i = start + 1; i < table.length; i++) if (SECTIONS.some((re) => re.test(cell(table[i], 0)))) return i;
    return table.length;
  };
  // A single-column list: rows after the section's column-header until the next section.
  const list = (sectionRe: RegExp, headerRe: RegExp): string[] => {
    const s = findRow(sectionRe); if (s < 0) return [];
    const end = nextSectionAfter(s);
    const res: string[] = [];
    for (let i = s + 1; i < end; i++) {
      const v = cell(table[i], 0);
      if (!v || headerRe.test(v)) continue;
      res.push(v);
    }
    return res;
  };
  const att = list(/^٢?\)?\s*الحضور|الحضور/, /^الاسم$/);
  const abs = list(/الغياب/, /^الاسم$/);
  const kps = list(/المواضيع/, /^الموضوع$/);
  const decs = list(/القرارات/, /^(القرار|القرار \/ التوصية)$/);
  if (att.length) out.attendees = att;
  if (abs.length) out.absentees = abs;
  if (kps.length) out.keyPoints = kps;
  if (decs.length) out.decisions = decs;

  // Actions table.
  const as = findRow(/المهام/);
  if (as >= 0) {
    const end = nextSectionAfter(as);
    const acts: MeetingAction[] = [];
    for (let i = as + 1; i < end; i++) {
      const r = table[i];
      const text = cell(r, 0);
      if (!text || /^المهمة$/.test(text)) continue;
      acts.push({
        id: '', text, owner: cell(r, 1), due: excelSerialToDate(cell(r, 2)) || cell(r, 2),
        status: TASK_STATUSES.find((s) => cell(r, 3).includes(s)) || 'قيد التنفيذ',
        prog: parseInt(cell(r, 4), 10) || 0,
        participants: cell(r, 5) ? cell(r, 5).split(/[،,;]+/).map((x) => x.trim()).filter(Boolean) : [],
      });
    }
    if (acts.length) out.actions = acts;
  }
  return out;
}
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
const secHead = (t: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px' }}>
    <span style={{ width: 5, height: 16, borderRadius: 4, background: '#1e4634' }} />
    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#17211c' }}>{t}</span>
  </div>
);

function BulletsEditor({ items, onChange, addLabel }: { items: string[]; onChange: (v: string[]) => void; addLabel: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#1e4634' }} />
          <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} style={inputStyle} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} title="حذف" style={{ flex: 'none', width: 26, height: 26, border: '1px solid #e2e6df', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#b0433b', fontSize: 12 }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{addLabel}
      </button>
    </div>
  );
}

/** People picker: dropdown add + removable chips + free-text add for external guests. */
function PeoplePicker({ list, onChange, pool, placeholder, accent }: {
  list: string[]; onChange: (v: string[]) => void; pool: string[]; placeholder: string; accent?: 'red';
}) {
  const { tr } = useI18n();
  const [free, setFree] = useState('');
  const color = accent === 'red' ? '#b0433b' : '#1e4634';
  const bg = accent === 'red' ? '#fdf3f2' : '#eef5f0';
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Dropdown value="" options={pool.filter((n) => !list.includes(n)).map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => { if (v) onChange([...list, v]); }} opt={{ block: true, size: 'sm', placeholder }} />
        </div>
        <input value={free} onChange={(e) => setFree(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && free.trim()) { onChange([...list, free.trim()]); setFree(''); } }} placeholder="اسم خارجي…" style={{ ...inputStyle, flex: 1 }} />
        <button type="button" onClick={() => { if (free.trim()) { onChange([...list, free.trim()]); setFree(''); } }} style={{ flex: 'none', background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 10, padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إضافة</button>
      </div>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
          {list.map((n) => (
            <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid ' + color, background: bg, color, borderRadius: 20, padding: '4px 9px', fontSize: 11.5, fontWeight: 700 }}>
              {tr(n)}
              <button type="button" onClick={() => onChange(list.filter((x) => x !== n))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full meeting-minutes form: everything the Sector Head later sees in the
 *  minute's detail page, saved to the SAME meetings record (no duplicates). */
export function MinutesForm({ meetingId, onClose }: { meetingId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const existing = meetingId ? data.meetings.find((m) => m.id === meetingId) : null;
  const pool = Array.from(new Set([...data.members.map((m) => m.name), ...data.sectorManagers.map((m) => m.name)]));

  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    title: existing.title, date: existing.date, time: existing.time || '', location: existing.location || '',
    entity: existing.entity || '', summary: existing.summary || '', chairNotes: existing.chairNotes || '',
  } : { title: '', date: '', time: '', location: '', entity: 'مكتب رئيس القطاع', summary: '', chairNotes: '' });
  const [attendees, setAttendees] = useState<string[]>(() => (existing?.attendees || []).map((a) => a.name));
  const [absentees, setAbsentees] = useState<string[]>(() => (existing?.absentees || []).map((a) => a.name));
  const [keyPoints, setKeyPoints] = useState<string[]>(() => existing?.keyPoints ? [...existing.keyPoints] : []);
  const [decisions, setDecisions] = useState<string[]>(() => existing?.decisions ? [...existing.decisions] : []);
  const [actions, setActions] = useState<MeetingAction[]>(() => existing?.actions ? existing.actions.map((a) => ({ ...a, participants: a.participants ? [...a.participants] : [] })) : []);
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : (existing?.attachment ? [existing.attachment] : []));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setAct = (i: number, k: keyof MeetingAction, v: unknown) => setActions((p) => p.map((a, j) => (j === i ? { ...a, [k]: v } : a)) as MeetingAction[]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedFrom, setParsedFrom] = useState('');
  const onUpload = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      if (!blocks) { showToast('تعذّرت قراءة الملف تلقائياً — أُرفق دون تعبئة'); setAtts((p) => [...p, file.name]); return; }
      const p = parseMinutesFile(blocks.tables);
      setF((prev) => ({
        ...prev,
        title: p.title ?? prev.title, date: p.date ?? prev.date, time: p.time ?? prev.time,
        entity: p.entity ?? prev.entity, location: p.location ?? prev.location,
        summary: p.summary ?? prev.summary, chairNotes: p.chairNotes ?? prev.chairNotes,
      }));
      if (p.attendees) setAttendees(p.attendees);
      if (p.absentees) setAbsentees(p.absentees);
      if (p.keyPoints) setKeyPoints(p.keyPoints);
      if (p.decisions) setDecisions(p.decisions);
      if (p.actions) setActions(p.actions.map((a) => ({ ...a, id: '', participants: a.participants || [] })));
      setParsedFrom(file.name);
      showToast('قُرئ المحضر وعُبّئت الحقول — راجع البيانات قبل الحفظ');
    } catch {
      showToast('تعذّرت قراءة الملف تلقائياً — أُرفق دون تعبئة');
      setAtts((p) => [...p, file.name]);
    }
  };

  const save = (send: boolean) => {
    const title = (f.title || '').trim();
    if (!title) { showToast('يرجى إدخال موضوع الاجتماع'); return; }
    if (!f.date) { showToast('يرجى اختيار تاريخ الاجتماع'); return; }
    const cleanActions = actions.filter((a) => (a.text || '').trim()).map((a) => ({ ...a, id: a.id || 'a' + Math.floor(Math.random() * 1e9), lastUpdate: 'الآن — ' + cu.name }));
    mutate((d) => {
      let m: Meeting & { _mstatus?: string; _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] };
      if (existing) m = d.meetings.find((x) => x.id === meetingId)! as never;
      else {
        m = { id: 'mtg' + Math.floor(Math.random() * 1e9), title: '', date: '', owner: cu.name, status: 'مسودة', summary: '', attendees: [], keyPoints: [], decisions: [], actions: [] };
        d.meetings.unshift(m);
        m._mowner = cu.id;
      }
      if (!m) return;
      m.title = title; m.date = f.date; m.time = (f.time || '').trim(); m.location = (f.location || '').trim();
      m.entity = (f.entity || '').trim(); m.summary = (f.summary || '').trim();
      m.attendees = attendees.filter(Boolean).map((name) => ({ name }));
      m.absentees = absentees.filter(Boolean).map((name) => ({ name }));
      m.keyPoints = keyPoints.filter((x) => x.trim());
      m.decisions = decisions.filter((x) => x.trim());
      m.actions = cleanActions;
      m.attachments = atts; m.attachment = atts[0] || m.attachment;
      m.chairNotes = (f.chairNotes || '').trim();
      if (send) {
        m.status = 'بانتظار اعتماد رئيس القطاع'; m._mstatus = 'بانتظار اعتماد رئيس القطاع';
        m._mrev = true; m._mret = ''; m._mowner = m._mowner || cu.id;
      } else if (!m._mrev && m.status !== 'معتمد') { m.status = 'مسودة'; m._mstatus = 'مسودة'; }
      (m._mlog = m._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار اعتماد رئيس القطاع' : (existing ? 'تحديث بيانات المحضر' : 'إنشاء المحضر'), sent: !!send, by: cu.name });
    });
    showToast(send ? 'أُرسل المحضر لرئيس القطاع للمراجعة — ظاهر لديه في محاضر الاجتماعات' : 'حُفظ المحضر كمسودة');
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={780}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل محضر الاجتماع' : 'محضر اجتماع جديد'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>يُحفظ في نفس السجل الذي يراه رئيس القطاع — لا يُنشأ سجل مكرر عند التعديل.</p>

      {!existing && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
            <button type="button" onClick={dlMinutesDocx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>قالب Word
            </button>
            <button type="button" onClick={dlMinutesXlsx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>قالب Excel
            </button>
            <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.csv,.html,.htm,.txt" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 0-4 4m4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>رفع القالب المكتمل (تعبئة تلقائية)
            </button>
            <span style={{ fontSize: 10.5, color: '#7d867f' }}>يُقبل Word أو Excel — تُعرض البيانات للمراجعة قبل الحفظ.</span>
          </div>
          {parsedFrom && (
            <div style={{ margin: '8px 0 0', background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#1e4634' }}>
              قُرئت البيانات من «{parsedFrom}» — راجعها وعدّلها قبل الحفظ.
            </div>
          )}
        </>
      )}

      {secHead('بيانات الاجتماع')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>موضوع الاجتماع</Label><input value={f.title} onChange={setI('title')} style={inputStyle} /></div>
        <div><Label>تاريخ الاجتماع</Label><DateField value={f.date} onChange={(v) => setF((p) => ({ ...p, date: v }))} /></div>
        <div><Label>وقت الاجتماع</Label><input value={f.time} onChange={setI('time')} placeholder="مثال: 10:00 ص - 11:00 ص" style={inputStyle} /></div>
        <div><Label>الجهة / الإدارة المعنية</Label><input value={f.entity} onChange={setI('entity')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>مكان الاجتماع أو رابطه</Label><input value={f.location} onChange={setI('location')} placeholder="قاعة الاجتماعات - الطابق 12، أو رابط Teams" style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>ملخص الاجتماع</Label><textarea value={f.summary} onChange={setI('summary')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      </div>

      {secHead('الحضور')}
      <PeoplePicker list={attendees} onChange={setAttendees} pool={pool} placeholder="اختر حاضرًا لإضافته…" />
      {secHead('الغياب')}
      <PeoplePicker list={absentees} onChange={setAbsentees} pool={pool} placeholder="اختر غائبًا لإضافته…" accent="red" />

      {secHead('أبرز المواضيع التي نوقشت')}
      <BulletsEditor items={keyPoints} onChange={setKeyPoints} addLabel="إضافة موضوع" />
      {secHead('القرارات والتوصيات')}
      <BulletsEditor items={decisions} onChange={setDecisions} addLabel="إضافة قرار / توصية" />

      {secHead('المهام الناتجة عن الاجتماع')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((a, i) => (
          <div key={i} style={{ border: '1px solid #e6ece7', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1fr 64px 26px', gap: 8, alignItems: 'center' }}>
              <input value={a.text} onChange={(e) => setAct(i, 'text', e.target.value)} placeholder="المهمة" style={inputStyle} />
              <Dropdown value={a.owner} options={pool.map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => setAct(i, 'owner', v)} opt={{ block: true, size: 'sm', placeholder: 'المسؤول' }} />
              <Dropdown value={a.status} options={TASK_STATUSES.map((v) => ({ v, label: tr(v) }))} onChange={(v) => setAct(i, 'status', v)} opt={{ block: true, size: 'sm' }} />
              <DateField value={a.due} onChange={(v) => setAct(i, 'due', v)} />
              <input value={String(a.prog ?? '')} onChange={(e) => setAct(i, 'prog', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))} placeholder="%" style={{ ...inputStyle, textAlign: 'center', padding: '9px 6px' }} />
              <button type="button" onClick={() => setActions((p) => p.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7d867f', flex: 'none' }}>مشاركون إضافيون:</span>
              {(a.participants || []).map((n) => (
                <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #cdd8ce', background: '#f4f8f5', color: '#1e4634', borderRadius: 20, padding: '3px 8px', fontSize: 10.5, fontWeight: 700 }}>
                  {tr(n)}
                  <button type="button" onClick={() => setAct(i, 'participants', (a.participants || []).filter((x) => x !== n))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
              <div style={{ minWidth: 170 }}>
                <Dropdown value="" options={pool.filter((n) => n !== a.owner && !(a.participants || []).includes(n)).map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => { if (v) setAct(i, 'participants', [...(a.participants || []), v]); }} opt={{ block: true, size: 'sm', placeholder: 'إضافة مشارك…' }} />
              </div>
              {a.lastUpdate && <span style={{ marginInlineStart: 'auto', fontSize: 10, color: '#9aa39b' }}>آخر تحديث: {a.lastUpdate}</span>}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setActions((p) => [...p, { id: '', text: '', owner: cu.name, due: '', status: 'قيد التنفيذ', participants: [], prog: 0 }])} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>إضافة مهمة
        </button>
      </div>

      {secHead('المرفقات')}
      <FileUploadField files={atts} onChange={setAtts} />

      {secHead('ملاحظات رئيس القطاع (إن وجدت)')}
      <textarea value={f.chairNotes} onChange={setI('chairNotes')} rows={2} placeholder="تُسجَّل هنا ملاحظات رئيس القطاع المتعلقة بالمحضر…" style={{ ...inputStyle, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>حفظ</button>
      </div>
    </Modal>
  );
}
