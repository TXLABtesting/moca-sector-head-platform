import { useRef, useState } from 'react';
import { Modal, Badge } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { DateField } from '../../components/DateField';
import { FileUploadField } from '../../components/FileUploadField';
import { AttachmentDownload } from '../../components/AttachmentDownload';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import { can } from '../../domain/permissions';
import { triggerDownload } from '../../shared/fileGen';
import { REGST } from './shared';
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, kvLookup, excelSerialToDate } from './templateIO';
import type { RegReport } from '../../data/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const REG_STATUSES = ['—', 'معتمد', 'تم التسليم', 'بانتظار الاعتماد', 'لم يستلم', 'قيد المراجعة', 'مدمج', 'غير مطلوب'];
const FREQS = ['شهري', 'ربع سنوي', 'نصف سنوي', 'سنوي', 'حسب الحاجة'];
const MONTH_FIELDS: { k: 'jan' | 'feb' | 'mar' | 'apr' | 'may'; ar: string }[] = [
  { k: 'jan', ar: 'يناير' }, { k: 'feb', ar: 'فبراير' }, { k: 'mar', ar: 'مارس' }, { k: 'apr', ar: 'أبريل' }, { k: 'may', ar: 'مايو' },
];
const WSTC: Record<string, [string, string]> = {
  'مسودة': ['#eceeeb', '#6d7973'],
  'بانتظار مراجعة رئيس القطاع': ['#fbf0d6', '#a9791f'],
  'معتمد': ['#e2f0e8', '#2e7d55'],
  'أعيد للتعديل': ['#f7e6e4', '#b0433b'],
};

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
const secHead = (t: string, warn?: boolean) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px' }}>
    <span style={{ width: 5, height: 16, borderRadius: 4, background: '#1e4634' }} />
    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#17211c' }}>{t}</span>
    {warn && <span style={{ fontSize: 10, fontWeight: 800, color: '#a9791f', background: '#fbf2df', borderRadius: 20, padding: '2px 10px' }}>يحتاج مراجعة — لم يُتعرف عليه من الملف</span>}
  </div>
);

/* ---------------- template (Word + Excel) ---------------- */
const TPL_ROWS: [string, string][] = [
  ['الحقل', 'القيمة'],
  ['عنوان التقرير', ''],
  ['نوع التقرير', ''],
  ['الإدارة', ''],
  ['المسؤول', ''],
  ['الدورية', 'شهري'],
  ['موعد الاستحقاق', ''],
  ['حالة يناير', '—'],
  ['حالة فبراير', '—'],
  ['حالة مارس', '—'],
  ['حالة أبريل', '—'],
  ['حالة مايو', '—'],
  ['ملاحظات', ''],
];
const dlRegTemplateDocx = () => triggerDownload(makeDocx(
  wP('قالب سجل التقارير — بيانات تقرير', { bold: true, size: 36 }) + wP('') + wTbl(['الحقل', 'القيمة'], TPL_ROWS.slice(1).map(([a, b]) => [a, b || 'اكتب هنا']))
), 'Reports_Register_Template.docx');
const dlRegTemplateXlsx = () => triggerDownload(makeXlsx(TPL_ROWS, 'قالب السجل'), 'Reports_Register_Template.xlsx');

interface RegParsed {
  title?: string; type?: string; dept?: string; resp?: string; freq?: string; due?: string;
  months?: Partial<Record<'jan' | 'feb' | 'mar' | 'apr' | 'may', string>>; notes?: string;
  missing: string[];
}
function parseRegFile(tables: string[][][]): RegParsed {
  const found: RegParsed = { missing: [] };
  found.title = kvLookup(tables, /^عنوان التقرير/);
  found.type = kvLookup(tables, /^نوع التقرير/);
  found.dept = kvLookup(tables, /^الإدارة/);
  found.resp = kvLookup(tables, /^المسؤول/);
  const fr = kvLookup(tables, /^الدورية/);
  if (fr) { const f = FREQS.find((x) => fr.includes(x)); if (f) found.freq = f; }
  const due = kvLookup(tables, /^موعد الاستحقاق/);
  if (due) found.due = excelSerialToDate(due);
  const months: RegParsed['months'] = {};
  MONTH_FIELDS.forEach(({ k, ar }) => {
    const v = kvLookup(tables, new RegExp('^حالة ' + ar));
    if (v) { const st = REG_STATUSES.find((s) => s !== '—' && v.includes(s)) || (v.trim() === '—' ? '—' : undefined); if (st) months[k] = st; }
  });
  if (Object.keys(months).length) found.months = months;
  found.notes = kvLookup(tables, /^ملاحظات/);
  const KEYS: { k: keyof RegParsed; ar: string }[] = [
    { k: 'title', ar: 'عنوان التقرير' }, { k: 'type', ar: 'نوع التقرير' }, { k: 'dept', ar: 'الإدارة' },
    { k: 'resp', ar: 'المسؤول' }, { k: 'freq', ar: 'الدورية' }, { k: 'due', ar: 'موعد الاستحقاق' },
    { k: 'months', ar: 'حالات الأشهر' }, { k: 'notes', ar: 'الملاحظات' },
  ];
  found.missing = KEYS.filter((x) => found[x.k] === undefined).map((x) => x.ar);
  return found;
}

/* ---------------- add / edit form ---------------- */
function RegForm({ regId, onClose }: { regId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = regId ? data.regReports.find((r) => r.id === regId) : null;
  const pool = Array.from(new Set([...data.members.map((m) => m.name), ...data.sectorManagers.map((m) => m.name)]));
  const depts = [...new Set(data.regReports.map((r) => r.dept).filter(Boolean))];
  const [f, setF] = useState<Record<string, string>>(() => existing
    ? { title: existing.title, type: existing.type, dept: existing.dept, resp: existing.resp, freq: existing.freq, due: existing.due, lastDate: existing.lastDate || '', notes: existing.notes || '', jan: existing.jan, feb: existing.feb, mar: existing.mar, apr: existing.apr, may: existing.may }
    : { title: '', type: 'الأداء المالي', dept: depts[0] || '—', resp: cu.name, freq: 'شهري', due: '7 من كل شهر', lastDate: '', notes: '', jan: '—', feb: '—', mar: '—', apr: '—', may: '—' });
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : []);
  const [missing, setMissing] = useState<string[]>([]);
  const [parsedFrom, setParsedFrom] = useState('');
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const deptOpts = [...new Set([...depts, (f.dept || '').trim()])].filter(Boolean);

  const onUpload = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      if (!blocks) { showToast('تعذّرت قراءة الملف تلقائياً — أُرفق دون تعبئة'); setAtts((p) => [...p, file.name]); return; }
      const parsed = parseRegFile(blocks.tables);
      setF((p) => ({
        ...p,
        title: parsed.title ?? p.title, type: parsed.type ?? p.type, dept: parsed.dept ?? p.dept,
        resp: parsed.resp ?? p.resp, freq: parsed.freq ?? p.freq, due: parsed.due ?? p.due,
        notes: parsed.notes ?? p.notes,
        ...(parsed.months || {}),
      }));
      setMissing(parsed.missing);
      setParsedFrom(file.name);
      setAtts((p) => (p.includes(file.name) ? p : [...p, file.name]));
      showToast('قُرئ الملف وعُبئت الحقول — راجع البيانات قبل الحفظ');
    } catch {
      showToast('تعذّرت قراءة الملف تلقائياً — أُرفق دون تعبئة');
      setAtts((p) => [...p, file.name]);
    }
  };

  const save = (send: boolean) => {
    if (!(f.title || '').trim()) { showToast('يرجى إدخال عنوان التقرير'); return; }
    mutate((d) => {
      let r: RegReport & { _mstatus?: string; _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] };
      if (existing) r = d.regReports.find((x) => x.id === regId)! as never;
      else {
        r = { id: 'rg' + Math.floor(Math.random() * 1e9), n: String(d.regReports.length + 1), title: '', type: '', due: '', freq: '', resp: '', dept: '', jan: '—', feb: '—', mar: '—', apr: '—', may: '—', lastDate: '', approval: '', notes: '' };
        d.regReports.unshift(r);
        r._mowner = cu.id;
      }
      if (!r) return;
      r.title = f.title.trim(); r.type = (f.type || '').trim(); r.dept = (f.dept || '').trim();
      r.resp = f.resp || cu.name; r.freq = f.freq; r.due = (f.due || '').trim();
      r.jan = f.jan; r.feb = f.feb; r.mar = f.mar; r.apr = f.apr; r.may = f.may;
      r.lastDate = (f.lastDate || '').trim(); r.notes = (f.notes || '').trim();
      r.attachments = atts;
      if (send) { r._mstatus = 'بانتظار مراجعة رئيس القطاع'; r._mrev = true; r._mret = ''; r._mowner = r._mowner || cu.id; }
      else if (!r._mrev && r._mstatus !== 'معتمد') r._mstatus = existing ? r._mstatus : 'مسودة';
      (r._mlog = r._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار مراجعة رئيس القطاع' : (existing ? 'تحديث بيانات التقرير' : 'إضافة التقرير للسجل'), sent: !!send, by: cu.name });
    });
    showToast(send ? 'أُرسل التقرير لرئيس القطاع للمراجعة — ظاهر لديه في سجل التقارير' : 'حُفظ التقرير في السجل');
    onClose();
  };

  const needs = (ar: string) => parsedFrom !== '' && missing.includes(ar);
  const warnStyle = (ar: string) => (needs(ar) ? { borderColor: '#e9c877', background: '#fdf9ee' } : {});

  return (
    <Modal open onClose={onClose} width={740}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل تقرير في السجل' : 'إضافة تقرير جديد للسجل'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>يُحفظ في نفس سجل التقارير الذي يراه رئيس القطاع — لا يُنشأ سجل مكرر عند التعديل.</p>

      {!existing && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
            <button type="button" onClick={dlRegTemplateDocx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب Word
            </button>
            <button type="button" onClick={dlRegTemplateXlsx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب Excel
            </button>
            <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.csv,.html,.htm,.txt" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 0-4 4m4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
              رفع القالب المكتمل (تعبئة تلقائية)
            </button>
            <span style={{ fontSize: 10.5, color: '#7d867f' }}>يُقبل Word أو Excel — تُعرض البيانات للمراجعة ولا تُحفظ مباشرة.</span>
          </div>
          {parsedFrom && (
            <div style={{ margin: '8px 0 0', background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#1e4634' }}>
              قُرئت البيانات من «{parsedFrom}» — راجعها وعدّلها قبل الحفظ.{missing.length > 0 && <span style={{ color: '#a9791f', fontWeight: 700 }}> حقول لم يُتعرف عليها: {missing.join('، ')}.</span>}
            </div>
          )}
        </>
      )}

      {secHead('بيانات التقرير')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>عنوان التقرير</Label><input value={f.title} onChange={setI('title')} style={{ ...inputStyle, ...warnStyle('عنوان التقرير') }} /></div>
        <div><Label>نوع التقرير</Label><input value={f.type} onChange={setI('type')} style={{ ...inputStyle, ...warnStyle('نوع التقرير') }} /></div>
        <div><Label>الإدارة</Label><Dropdown value={f.dept} options={deptOpts.map((u) => ({ v: u, label: tr(u) }))} onChange={(v) => setF((p) => ({ ...p, dept: v }))} opt={{ block: true, size: 'sm', popMaxWidth: '340px' }} /></div>
        <div><Label>المسؤول</Label><Dropdown value={f.resp} options={pool.map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => setF((p) => ({ ...p, resp: v }))} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>الدورية</Label><Dropdown value={f.freq} options={FREQS.map((x) => ({ v: x, label: tr(x) }))} onChange={(v) => setF((p) => ({ ...p, freq: v }))} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>موعد الاستحقاق</Label><input value={f.due} onChange={setI('due')} placeholder="مثال: 7 من كل شهر" style={{ ...inputStyle, ...warnStyle('موعد الاستحقاق') }} /></div>
        <div><Label>تاريخ آخر تسليم</Label><DateField value={f.lastDate} onChange={(v) => setF((p) => ({ ...p, lastDate: v }))} /></div>
      </div>

      {secHead('حالة التسليم الشهرية', needs('حالات الأشهر'))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }} className="rg5">
        {MONTH_FIELDS.map(({ k, ar }) => (
          <div key={k}><Label>{ar}</Label><Dropdown value={f[k]} options={REG_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setF((p) => ({ ...p, [k]: v }))} opt={{ block: true, size: 'sm' }} /></div>
        ))}
      </div>

      {secHead('ملاحظات', needs('الملاحظات'))}
      <textarea value={f.notes} onChange={setI('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

      {secHead('المرفقات')}
      <FileUploadField files={atts} onChange={setAtts} />

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>حفظ كمسودة</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إرسال لرئيس القطاع</button>
      </div>
    </Modal>
  );
}

/* ---------------- entry view ---------------- */
function RegView({ regId, onEdit, onClose }: { regId: string; onEdit: () => void; onClose: () => void }) {
  const { tr, dl } = useI18n();
  const data = useStore((s) => s.data);
  const r = data.regReports.find((x) => x.id === regId);
  if (!r) return null;
  const meta = r as RegReport & { _mstatus?: string; _mret?: string; _mlog?: { at: string; to?: string; by?: string }[] };
  const wf = meta._mret ? 'أعيد للتعديل' : (meta._mstatus || '');
  const cur = (r.may && r.may !== '—') ? r.may : (r.apr && r.apr !== '—' ? r.apr : r.mar);
  const [cb, cf] = REGST[cur] || REGST['—'];
  const box: React.CSSProperties = { background: '#f7f9f6', borderRadius: 11, padding: '10px 13px' };
  return (
    <Modal open onClose={onClose} width={640}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#17211c', flex: 1, minWidth: 220 }}>{tr(r.title)}</h3>
        <Badge bg={cb} fg={cf} style={{ fontSize: 10.5, padding: '4px 12px' }}>{tr(cur === '—' ? 'غير محدد' : cur)}</Badge>
        {wf && <Badge bg={(WSTC[wf] || ['#eceeeb', '#6d7973'])[0]} fg={(WSTC[wf] || ['#eceeeb', '#6d7973'])[1]} style={{ fontSize: 10.5, padding: '4px 12px' }}>{tr(wf)}</Badge>}
      </div>
      <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 12 }}>
        {tr(r.type)} · {tr(r.dept)} · {tr(r.freq)} · المسؤول: {tr(r.resp)} · الاستحقاق: {tr(r.due)}{r.lastDate ? ' · آخر تسليم: ' + dl(r.lastDate) : ''}
      </div>
      {!!(meta._mret && meta._mret.trim()) && (
        <div style={{ background: '#fdf3f2', border: '1.5px solid #e7b8b3', borderRadius: 11, padding: '11px 13px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#b0433b', fontWeight: 800, marginBottom: 3 }}>أُعيد للتعديل من رئيس القطاع — سبب الإرجاع</div>
          <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{meta._mret}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          تعديل التقرير
        </button>
      </div>
      {secHead('سجل التسليم الشهري')}
      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MONTH_FIELDS.map(({ k, ar }) => {
          const s = r[k] as string; const [b, fg] = REGST[s] || REGST['—'];
          return <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: '#7d867f' }}>{tr(ar)}</span><Badge bg={b} fg={fg} style={{ fontSize: 10, padding: '3px 11px' }}>{s === '—' ? '—' : tr(s)}</Badge></div>;
        })}
      </div>
      {!!(r.notes && r.notes.trim()) && (<>{secHead('ملاحظات')}<div style={{ ...box, fontSize: 12.5, color: '#2a332d', lineHeight: 1.7 }}>{tr(r.notes)}</div></>)}
      {!!(r.attachments && r.attachments.length) && (<>{secHead('المرفقات')}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{r.attachments.map((x, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 9, padding: '6px 11px 6px 6px', fontSize: 11.5, color: '#2a332d' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>{x}
            <AttachmentDownload name={x} size={22} />
          </span>))}</div></>)}
      {!!(meta._mlog && meta._mlog.length) && (<>{secHead('سجل التحديثات')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {meta._mlog.slice(0, 6).map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#fbfcfa', border: '1px solid #eef1ec', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#3c4a42', lineHeight: 1.7 }}>
              <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#c9a24b', marginTop: 6 }} />
              <span><b>{tr(e.by || '')}</b> · {tr(e.at)}{e.to ? ' — ' + tr(e.to) : ''}</span>
            </div>
          ))}
        </div></>)}
    </Modal>
  );
}

/* ---------------- main workspace ---------------- */
export function RegisterWorkspace() {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const manage = cu.type !== 'chair' && (can(cu, 'reportLog', 'add') || can(cu, 'reportLog', 'edit'));

  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [formId, setFormId] = useState<{ id: string | null } | null>(null);
  const [limit, setLimit] = useState(15);

  const q = search.trim();
  const rows = data.regReports.filter((r) => !q || r.title.includes(q) || r.dept.includes(q) || r.resp.includes(q) || r.type.includes(q));
  const shown = rows.slice(0, limit);
  const cur = (r: RegReport) => (r.may && r.may !== '—') ? r.may : (r.apr && r.apr !== '—' ? r.apr : (r.mar && r.mar !== '—' ? r.mar : r.feb));

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 21, fontWeight: 800, color: '#17211c' }}>سجل التقارير</h1>
          <p style={{ margin: 0, fontSize: 12.5, color: '#7d867f' }}>إدارة تقارير السجل وحالات تسليمها الشهرية — سجل مشترك واحد يظهر لرئيس القطاع فوراً.</p>
        </div>
        {manage && (
          <div className="page-head-action" style={{ flex: 'none' }}>
            <button onClick={() => setFormId({ id: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              إضافة تقرير جديد للسجل
            </button>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: '13px 16px', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.18)', marginBottom: 14 }}>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(15); }} placeholder="ابحث باسم التقرير أو الإدارة أو المسؤول…" style={inputStyle} />
      </div>

      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.14)' }}>
        <div className="trow" style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr 1fr 0.8fr 1.1fr 1.1fr 150px', gap: 10, padding: '11px 16px', background: '#f7f9f6', borderBottom: '1px solid #eef1ec', fontSize: 11, fontWeight: 700, color: '#7d867f' }}>
          <div>التقرير</div><div>الإدارة</div><div>المسؤول</div><div>الدورية</div><div>الحالة الحالية</div><div>سير العمل</div><div />
        </div>
        {shown.map((r) => {
          const meta = r as RegReport & { _mstatus?: string; _mret?: string };
          const wf = meta._mret ? 'أعيد للتعديل' : (meta._mstatus || '');
          const c = cur(r); const [cb, cf] = REGST[c] || REGST['—'];
          const [wb, wfg] = WSTC[wf] || ['#f4f6f2', '#9aa39b'];
          return (
            <div key={r.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr 1fr 0.8fr 1.1fr 1.1fr 150px', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f2f4f0', alignItems: 'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45 }}>{tr(r.title)}<div style={{ fontSize: 10.5, color: '#9aa39b', fontWeight: 400, marginTop: 2 }}>{tr(r.type)} · {tr(r.due)}</div></div>
              <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{tr(r.dept)}</div>
              <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{tr(r.resp)}</div>
              <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{tr(r.freq)}</div>
              <div><Badge bg={cb} fg={cf} style={{ fontSize: 10, padding: '4px 11px' }}>{c === '—' ? '—' : tr(c)}</Badge></div>
              <div>{wf ? <Badge bg={wb} fg={wfg} style={{ fontSize: 10, padding: '4px 11px' }}>{tr(wf)}</Badge> : <span style={{ fontSize: 10.5, color: '#c3cbc2' }}>—</span>}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setOpenId(r.id)} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>فتح</button>
                {manage && <button onClick={() => setFormId({ id: r.id })} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>تعديل</button>}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9aa39b', fontSize: 12.5 }}>لا توجد تقارير مطابقة</div>}
        {limit < rows.length && (
          <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid #f2f4f0' }}>
            <button onClick={() => setLimit(limit + 15)} style={{ background: '#f0f2ee', color: '#1f4a37', border: '1px solid #e2e6df', borderRadius: 10, padding: '9px 20px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>عرض المزيد ({rows.length - limit})</button>
          </div>
        )}
      </div>

      {openId && !formId && <RegView regId={openId} onEdit={() => setFormId({ id: openId })} onClose={() => setOpenId(null)} />}
      {formId && <RegForm regId={formId.id} onClose={() => setFormId(null)} />}
    </div>
  );
}
