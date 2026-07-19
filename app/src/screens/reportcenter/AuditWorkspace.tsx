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
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, PLACEHOLDER, excelSerialToDate } from './templateIO';
import { audBullets } from './shared';
import type { AuditArea, AuditRep, AuditObsLog } from '../../data/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const OBS_STATUSES = ['متأخر', 'قيد التنفيذ', 'مغلق'];
const FREQS = ['دوري', 'حسب الحاجة'];
const AUDIT_UNITS = [
  'إدارة الشؤون الإدارية', 'إدارة الخدمات المالية', 'إدارة خدمات الموارد البشرية',
  'إدارة العقود والمشتريات', 'إدارة الخدمات والبنية التحتية', 'مركز التجربة المتكاملة',
];
const STC: Record<string, [string, string]> = {
  'مسودة': ['#eceeeb', '#6d7973'],
  'بانتظار مراجعة رئيس القطاع': ['#fbf0d6', '#a9791f'],
  'قيد المتابعة': ['#fbf0d6', '#a9791f'],
  'معتمد': ['#e2f0e8', '#2e7d55'],
  'أعيد للتعديل': ['#f7e6e4', '#b0433b'],
};
const OBSC: Record<string, [string, string]> = {
  'مغلق': ['#e2f0e8', '#2e7d55'],
  'قيد التنفيذ': ['#fbf0d6', '#a9791f'],
  'متأخر': ['#f7e6e4', '#b0433b'],
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

/** Bullets editor: add / edit / delete / reorder. */
function Bullets({ items, onChange, addLabel }: { items: string[]; onChange: (v: string[]) => void; addLabel: string }) {
  const setAt = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= items.length) return;
    const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; onChange(a);
  };
  const btn: React.CSSProperties = { flex: 'none', width: 26, height: 26, border: '1px solid #e2e6df', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#5b6b62', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#1e4634' }} />
          <input value={it} onChange={(e) => setAt(i, e.target.value)} style={inputStyle} />
          <button type="button" onClick={() => move(i, -1)} title="أعلى" style={btn}>↑</button>
          <button type="button" onClick={() => move(i, 1)} title="أسفل" style={btn}>↓</button>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} title="حذف" style={{ ...btn, color: '#b0433b' }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{addLabel}
      </button>
    </div>
  );
}

/** Join editable bullets back into the string format audBullets() splits. */
const joinBullets = (arr: string[]): string => {
  const a = arr.map((x) => x.trim()).filter(Boolean);
  return a.length <= 1 ? (a[0] || '') : a.map((x, i) => `${i + 1}. ${x}`).join(' ');
};
const splitBullets = (s: string): string[] => {
  const b = audBullets(s);
  return b.length === 1 && b[0] === '—' ? [] : b;
};

/* ================= templates ================= */
const TEMPLATE_NAME = 'Followup_Audit_Report_Template.docx';

function buildAuditTemplateDocx(): Blob {
  const ph = 'اكتب هنا';
  const bullets = (n: number) => Array.from({ length: n }, () => wP('- ' + ph)).join('');
  const body =
    wP('قالب ملاحظة — تقرير المتابعة - مكتب التدقيق', { bold: true, size: 36 }) +
    wP('') +
    wTbl(['الحقل', 'القيمة'], [
      ['الوحدة التنظيمية', ph],
      ['عنوان الملاحظة', ph],
      ['المسؤول عن المعالجة', ph],
      ['الحالة', 'قيد التنفيذ'],
      ['تاريخ التنفيذ', ph],
    ]) +
    wP('ملاحظة التدقيق الداخلي', { bold: true, size: 28 }) + bullets(3) +
    wP('آلية إغلاق الملاحظة', { bold: true, size: 28 }) + bullets(3) +
    wP('ملاحظات', { bold: true, size: 28 }) + wP(ph);
  return makeDocx(body);
}

const downloadAuditTemplate = () => triggerDownload(buildAuditTemplateDocx(), TEMPLATE_NAME);

/** Excel version of the template — same labels the parser reads back. */
const XLSX_TEMPLATE_NAME = 'Followup_Audit_Report_Template.xlsx';
function buildAuditTemplateXlsx(): Blob {
  return makeXlsx([
    ['الحقل', 'القيمة'],
    ['الوحدة التنظيمية', ''],
    ['عنوان الملاحظة', ''],
    ['المسؤول عن المعالجة', ''],
    ['الحالة', 'قيد التنفيذ'],
    ['تاريخ التنفيذ', ''],
    ['ملاحظة التدقيق الداخلي 1', ''],
    ['ملاحظة التدقيق الداخلي 2', ''],
    ['ملاحظة التدقيق الداخلي 3', ''],
    ['آلية إغلاق الملاحظة 1', ''],
    ['آلية إغلاق الملاحظة 2', ''],
    ['آلية إغلاق الملاحظة 3', ''],
    ['ملاحظات', ''],
  ], 'قالب الملاحظة');
}
const downloadAuditTemplateXlsx = () => triggerDownload(buildAuditTemplateXlsx(), XLSX_TEMPLATE_NAME);

/** Build a docx pre-filled with the CURRENT report data (all its observations). */
function buildFilledReportDocx(rep: AuditRep, obs: { title: string; owner: string; status: string; due: string; notes: string; obsB: string[]; actB: string[] }[]): Blob {
  const bulletLines = (arr: string[]) => (arr.filter((x) => x.trim()).length ? arr.filter((x) => x.trim()).map((x) => wP('- ' + x)).join('') : wP('- —'));
  let body =
    wP(rep.title, { bold: true, size: 36 }) +
    wTbl(['الحقل', 'القيمة'], [
      ['الوحدة التنظيمية', rep.unit || '—'],
      ['سنة التقرير', rep.year || '—'],
      ['الفترة', rep.period || '—'],
      ['الدورية', rep.freq || '—'],
      ['المسؤول', rep.resp || '—'],
    ]);
  obs.forEach((a, i) => {
    body +=
      wP('الملاحظة ' + (i + 1), { bold: true, size: 30 }) +
      wTbl(['الحقل', 'القيمة'], [
        ['عنوان الملاحظة', a.title || '—'],
        ['المسؤول عن المعالجة', a.owner || '—'],
        ['الحالة', a.status || '—'],
        ['تاريخ التنفيذ', a.due || '—'],
      ]) +
      wP('ملاحظة التدقيق الداخلي', { bold: true, size: 26 }) + bulletLines(a.obsB) +
      wP('آلية إغلاق الملاحظة', { bold: true, size: 26 }) + bulletLines(a.actB) +
      wP('ملاحظات', { bold: true, size: 26 }) + wP(a.notes || '—');
  });
  return makeDocx(body);
}

/* ================= upload parsing ================= */
interface ObsParsed {
  unit?: string; title?: string; owner?: string; status?: string; due?: string;
  obs?: string[]; action?: string[]; notes?: string;
  missing: string[];
}

function parseObsFile(lines: string[], tables: string[][][]): ObsParsed {
  const found: ObsParsed = { missing: [] };
  // key-value table
  const kv = tables.find((t) => t.some((r) => /الوحدة التنظيمية|عنوان الملاحظة/.test((r[0] || '') + (r.join(' ')))));
  const kvVal = (label: RegExp): string | undefined => {
    if (!kv) return undefined;
    const row = kv.find((r) => label.test(r[0] || ''));
    const v = (row?.[1] || '').trim();
    return v && !PLACEHOLDER.test(v) ? v : undefined;
  };
  found.unit = kvVal(/الوحدة التنظيمية/);
  found.title = kvVal(/عنوان الملاحظة/);
  found.owner = kvVal(/المسؤول/);
  const stRaw = kvVal(/^الحالة/);
  if (stRaw) { const st = OBS_STATUSES.find((s) => stRaw.includes(s)); if (st) found.status = st; }
  found.due = kvVal(/تاريخ التنفيذ/);

  const isHead = (l: string) => /^(ملاحظة التدقيق الداخلي|آلية إغلاق الملاحظة|ملاحظات$|قالب ملاحظة)/.test(l);
  const bulletsAfter = (re: RegExp): string[] | undefined => {
    const i = lines.findIndex((l) => re.test(l));
    if (i < 0) return undefined;
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (isHead(l)) break;
      if (l.startsWith(' TABLE')) continue;
      const v = l.replace(/^[-•*]\s*/, '').trim();
      if (v && !PLACEHOLDER.test(v)) out.push(v);
    }
    return out.length ? out : undefined;
  };
  found.obs = bulletsAfter(/^ملاحظة التدقيق الداخلي/);
  found.action = bulletsAfter(/^آلية إغلاق الملاحظة/);
  const ni = lines.findIndex((l) => /^ملاحظات$/.test(l));
  if (ni >= 0) {
    const parts = lines.slice(ni + 1).filter((l) => !l.startsWith(' ') && !PLACEHOLDER.test(l) && !isHead(l));
    if (parts.length) found.notes = parts.join(' ');
  }

  // Excel-style fallback: bullets/notes live as numbered label→value rows in the sheet table
  const kvMany = (label: RegExp): string[] | undefined => {
    const out: string[] = [];
    for (const t of tables) for (const r of t) {
      if (label.test(r[0] || '')) {
        const v = (r[1] || '').trim();
        if (v && !PLACEHOLDER.test(v)) out.push(v);
      }
    }
    return out.length ? out : undefined;
  };
  if (!found.obs) found.obs = kvMany(/^ملاحظة التدقيق الداخلي/);
  if (!found.action) found.action = kvMany(/^آلية إغلاق الملاحظة/);
  if (!found.notes) { const v = kvVal(/^ملاحظات/); if (v) found.notes = v; }
  if (found.due) found.due = excelSerialToDate(found.due);

  const KEYS: { k: keyof ObsParsed; ar: string }[] = [
    { k: 'unit', ar: 'الوحدة التنظيمية' }, { k: 'title', ar: 'عنوان الملاحظة' },
    { k: 'obs', ar: 'ملاحظة التدقيق الداخلي' }, { k: 'action', ar: 'آلية إغلاق الملاحظة' },
    { k: 'owner', ar: 'المسؤول عن المعالجة' }, { k: 'status', ar: 'الحالة' },
    { k: 'due', ar: 'تاريخ التنفيذ' }, { k: 'notes', ar: 'الملاحظات' },
  ];
  found.missing = KEYS.filter((x) => found[x.k] === undefined).map((x) => x.ar);
  return found;
}

/* ================= report add/edit form ================= */
function RepForm({ repId, onClose }: { repId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = repId ? (data.auditReps || []).find((r) => r.id === repId) : null;
  const pool = Array.from(new Set([...data.members.map((m) => m.name), ...data.sectorManagers.map((m) => m.name)]));
  const [f, setF] = useState<Record<string, string>>(() => existing
    ? { title: existing.title, unit: existing.unit, year: existing.year, period: existing.period, freq: existing.freq, resp: existing.resp, notes: existing.notes || '' }
    : { title: '', unit: 'إدارة الشؤون الإدارية', year: '2026', period: '', freq: 'دوري', resp: cu.name, notes: '' });
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : []);
  // first observation of a NEW report (same fields as the observation form)
  const [o, setO] = useState<Record<string, string>>({ title: '', owner: '', status: 'قيد التنفيذ', due: '', notes: '' });
  const [obsB, setObsB] = useState<string[]>([]);
  const [actB, setActB] = useState<string[]>([]);
  const [obsAtts, setObsAtts] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [parsedFrom, setParsedFrom] = useState('');
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setOI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setO((p) => ({ ...p, [k]: e.target.value }));
  const unitOpts = [...new Set([...AUDIT_UNITS, (f.unit || '').trim()])].filter(Boolean);

  // EDIT mode: all the report's observations, editable inline
  interface ObsDraft { id: string; title: string; owner: string; status: string; due: string; notes: string; obsB: string[]; actB: string[] }
  const [obsList, setObsList] = useState<ObsDraft[]>(() => existing
    ? data.audit.filter((a) => (a.rep || 'admin2025') === repId).map((a) => ({
        id: a.id, title: a.area, owner: a.owner, status: a.status,
        due: a.due === '—' ? '' : a.due, notes: a.notes || '',
        obsB: splitBullets(a.obs), actB: splitBullets(a.action),
      }))
    : []);
  const setObs = (i: number, k: keyof ObsDraft, v: unknown) => setObsList((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)) as ObsDraft[]);
  const downloadFilled = () => {
    if (!existing) return;
    triggerDownload(
      buildFilledReportDocx({ ...existing, title: f.title || existing.title, unit: f.unit, year: f.year, period: f.period, freq: f.freq, resp: f.resp }, obsList),
      'Followup_Audit_Report_' + (f.year || existing.year) + '.docx'
    );
  };

  const onUpload = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      if (!blocks) { showToast('تعذّرت قراءة الملف تلقائياً — أُرفق دون تعبئة'); setAtts((p) => [...p, file.name]); return; }
      const parsed = parseObsFile(blocks.lines, blocks.tables);
      if (parsed.unit) setF((p) => ({ ...p, unit: parsed.unit! }));
      setO((p) => ({
        ...p,
        title: parsed.title ?? p.title, owner: parsed.owner ?? p.owner,
        status: parsed.status ?? p.status, due: parsed.due ?? p.due, notes: parsed.notes ?? p.notes,
      }));
      if (parsed.obs) setObsB(parsed.obs);
      if (parsed.action) setActB(parsed.action);
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
    if (!/^20\d{2}$/.test((f.year || '').trim())) { showToast('يرجى إدخال سنة صحيحة (مثال: 2026)'); return; }
    mutate((d) => {
      d.auditReps = d.auditReps || [];
      let r: AuditRep & { _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] };
      if (existing) r = d.auditReps.find((x) => x.id === repId)! as never;
      else {
        r = { id: 'aur' + Math.floor(Math.random() * 1e9), title: '', unit: '', year: '', period: '', freq: 'دوري', status: 'مسودة', resp: '', attachments: [], notes: '' };
        d.auditReps.unshift(r);
        r._mowner = cu.id;
      }
      if (!r) return;
      r.title = f.title.trim(); r.unit = (f.unit || '').trim(); r.year = f.year.trim();
      r.period = (f.period || '').trim(); r.freq = f.freq; r.resp = f.resp || cu.name;
      r.attachments = atts; r.notes = (f.notes || '').trim();
      r.lastUpdate = 'الآن'; r.updatedBy = cu.name;
      if (send) { r.status = 'بانتظار مراجعة رئيس القطاع'; r._mrev = true; r._mret = ''; r._mowner = r._mowner || cu.id; }
      else if (!r._mrev && r.status !== 'معتمد') r.status = existing ? r.status : 'مسودة';
      (r._mlog = r._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار مراجعة رئيس القطاع' : (existing ? 'تحديث بيانات التقرير' : 'إنشاء التقرير'), sent: !!send, by: cu.name });
      // EDIT mode: write the inline-edited observations back to the shared register
      if (existing) {
        obsList.forEach((od) => {
          const a = d.audit.find((x) => x.id === od.id);
          if (!a) return;
          const nObs = joinBullets(od.obsB); const nAct = joinBullets(od.actB);
          const nTitle = od.title.trim() || a.area; const nOwner = od.owner.trim() || a.owner;
          const nDue = (od.due || '').trim() || '—'; const nNotes = od.notes.trim();
          const changed = a.area !== nTitle || a.owner !== nOwner || a.status !== od.status
            || a.due !== nDue || (a.notes || '') !== nNotes || a.obs !== nObs || a.action !== nAct;
          if (!changed) return;
          const from = a.status;
          a.area = nTitle; a.owner = nOwner; a.due = nDue; a.notes = nNotes;
          a.obs = nObs; a.action = nAct; a.status = od.status; a.updated = 'الآن';
          (a.log = a.log || []).unshift(from !== od.status
            ? { at: 'الآن', by: cu.name, from, to: od.status, note: 'تحديث من نموذج تعديل التقرير' }
            : { at: 'الآن', by: cu.name, note: 'تحديث بيانات الملاحظة من نموذج تعديل التقرير' });
        });
      }
      // the first observation entered with a new report is saved to the shared audit register
      if (!existing && ((o.title || '').trim() || obsB.some((x) => x.trim()))) {
        d.audit.push({
          id: 'au' + Math.floor(Math.random() * 1e9), num: 'م1',
          area: (o.title || '').trim() || 'ملاحظة بدون عنوان', unit: r.unit,
          obs: joinBullets(obsB), action: joinBullets(actB),
          owner: (o.owner || '').trim() || cu.name, status: o.status || 'قيد التنفيذ', imp: 'متوسطة',
          due: (o.due || '').trim() || '—', updated: 'الآن', notes: (o.notes || '').trim(),
          rep: r.id, attachments: obsAtts,
          log: [{ at: 'الآن', by: cu.name, note: 'إضافة الملاحظة مع إنشاء التقرير' }],
        });
      }
    });
    showToast(send ? 'أُرسل التقرير لرئيس القطاع للمراجعة — ظاهر لديه في مركز التقارير' : 'حُفظ التقرير');
    onClose();
  };

  const needs = (ar: string) => parsedFrom !== '' && missing.includes(ar);

  return (
    <Modal open onClose={onClose} width={760}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل تقرير المتابعة - مكتب التدقيق' : 'إضافة تقرير جديد'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>يُحفظ في نفس السجل الذي يراه رئيس القطاع في مركز التقارير — لا يُنشأ سجل مكرر عند التعديل.</p>

      {/* template download / upload — fills the report unit and the observation data below */}
      {!existing && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
            <button type="button" onClick={downloadAuditTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب Word
            </button>
            <button type="button" onClick={downloadAuditTemplateXlsx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب Excel
            </button>
            <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.csv,.html,.htm,.txt" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 0-4 4m4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
              رفع القالب المكتمل (تعبئة تلقائية)
            </button>
            <span style={{ fontSize: 10.5, color: '#7d867f' }}>يُقبل Word أو Excel — عبّئ القالب ثم ارفعه، وتُعرض البيانات للمراجعة ولا تُحفظ مباشرة.</span>
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
        <div style={{ gridColumn: '1 / -1' }}><Label>عنوان التقرير</Label><input value={f.title} onChange={setI('title')} placeholder="مثال: تقرير المتابعة على إدارة الخدمات المالية 2026" style={inputStyle} /></div>
        <div><Label>الوحدة التنظيمية المعنية</Label><Dropdown value={f.unit} options={unitOpts.map((u) => ({ v: u, label: tr(u) }))} onChange={(v) => setF((p) => ({ ...p, unit: v }))} opt={{ block: true, size: 'sm', popMaxWidth: '340px' }} /></div>
        <div><Label>سنة التقرير</Label><input value={f.year} onChange={setI('year')} style={inputStyle} /></div>
        <div><Label>الفترة</Label><input value={f.period} onChange={setI('period')} placeholder="مثال: النصف الأول 2026" style={inputStyle} /></div>
        <div><Label>الدورية</Label><Dropdown value={f.freq} options={FREQS.map((x) => ({ v: x, label: tr(x) }))} onChange={(v) => setF((p) => ({ ...p, freq: v }))} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>حالة التقرير</Label><div style={{ ...inputStyle, background: '#f2f4f0', color: '#7d867f' }}>{existing ? tr(existing.status) : 'مسودة'} — تُدار من سير العمل</div></div>
        <div><Label>المسؤول</Label><Dropdown value={f.resp} options={pool.map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => setF((p) => ({ ...p, resp: v }))} opt={{ block: true, size: 'sm' }} /></div>
      </div>

      {/* first-observation data — same fields as the observation form */}
      {!existing && (
        <>
          {secHead('بيانات الملاحظة')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}><Label>عنوان الملاحظة</Label><input value={o.title} onChange={setOI('title')} style={{ ...inputStyle, ...(needs('عنوان الملاحظة') ? { borderColor: '#e9c877', background: '#fdf9ee' } : {}) }} /></div>
            <div><Label>المسؤول عن المعالجة</Label><input value={o.owner} onChange={setOI('owner')} placeholder="اكتب اسم المسؤول…" style={{ ...inputStyle, ...(needs('المسؤول عن المعالجة') ? { borderColor: '#e9c877', background: '#fdf9ee' } : {}) }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><Label>الحالة</Label><Dropdown value={o.status} options={OBS_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setO((p) => ({ ...p, status: v }))} opt={{ block: true, size: 'sm' }} /></div>
              <div><Label>تاريخ التنفيذ</Label><DateField value={o.due} onChange={(v) => setO((p) => ({ ...p, due: v }))} /></div>
            </div>
          </div>
          {secHead('ملاحظة التدقيق الداخلي', needs('ملاحظة التدقيق الداخلي'))}
          <Bullets items={obsB} onChange={setObsB} addLabel="إضافة نقطة" />
          {secHead('آلية إغلاق الملاحظة', needs('آلية إغلاق الملاحظة'))}
          <Bullets items={actB} onChange={setActB} addLabel="إضافة نقطة" />
          {secHead('ملاحظات على الملاحظة', needs('الملاحظات'))}
          <textarea value={o.notes} onChange={setOI('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          {secHead('مرفقات الملاحظة')}
          <FileUploadField files={obsAtts} onChange={setObsAtts} />
        </>
      )}

      {/* EDIT mode: the full report data — every observation editable in place */}
      {existing && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px', background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
            <button type="button" onClick={downloadFilled} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
              تحميل قالب محدث ببيانات التقرير الحالية
            </button>
            <span style={{ fontSize: 10.5, color: '#7d867f' }}>ملف Word يحتوي كل بيانات التقرير وملاحظاته كما هي الآن.</span>
          </div>

          {secHead('ملاحظات التقرير — تعديل مباشر (' + obsList.length + ')')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {obsList.map((od, i) => (
              <details key={od.id} open={obsList.length <= 2} style={{ border: '1px solid #e6ece7', borderRadius: 12, background: '#fbfcfa' }}>
                <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                  <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, color: '#8a6a1f', background: '#fbf3df', borderRadius: 8, padding: '3px 9px' }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{od.title || 'ملاحظة بدون عنوان'}</span>
                  <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: (OBSC[od.status] || ['#eceeeb', '#6d7973'])[0], color: (OBSC[od.status] || ['#eceeeb', '#6d7973'])[1] }}>{od.status}</span>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ gridColumn: '1 / -1' }}><Label>عنوان الملاحظة</Label><input value={od.title} onChange={(e) => setObs(i, 'title', e.target.value)} style={inputStyle} /></div>
                    <div><Label>المسؤول عن المعالجة</Label><input value={od.owner} onChange={(e) => setObs(i, 'owner', e.target.value)} style={inputStyle} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><Label>الحالة</Label><Dropdown value={od.status} options={OBS_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setObs(i, 'status', v)} opt={{ block: true, size: 'sm' }} /></div>
                      <div><Label>تاريخ التنفيذ</Label><DateField value={od.due} onChange={(v) => setObs(i, 'due', v)} /></div>
                    </div>
                  </div>
                  <div><Label>ملاحظة التدقيق الداخلي</Label><Bullets items={od.obsB} onChange={(v) => setObs(i, 'obsB', v)} addLabel="إضافة نقطة" /></div>
                  <div><Label>آلية إغلاق الملاحظة</Label><Bullets items={od.actB} onChange={(v) => setObs(i, 'actB', v)} addLabel="إضافة نقطة" /></div>
                  <div><Label>ملاحظات</Label><textarea value={od.notes} onChange={(e) => setObs(i, 'notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                </div>
              </details>
            ))}
            {obsList.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: '#9aa39b', fontSize: 12 }}>لا توجد ملاحظات على هذا التقرير بعد — أضفها من زر «إضافة ملاحظة جديدة»</div>}
          </div>
        </>
      )}

      {secHead('مرفق التقرير')}
      <FileUploadField files={atts} onChange={setAtts} />

      {secHead('ملاحظات عامة')}
      <textarea value={f.notes} onChange={setI('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>حفظ كمسودة</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إرسال لرئيس القطاع</button>
      </div>
    </Modal>
  );
}

/* ================= observation add/edit form ================= */
function ObsForm({ repId, obsId, onClose }: { repId: string; obsId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const rep = (data.auditReps || []).find((r) => r.id === repId);
  const existing = obsId ? data.audit.find((a) => a.id === obsId) : null;
  const [f, setF] = useState<Record<string, string>>(() => existing
    ? { unit: existing.unit || rep?.unit || '', title: existing.area, owner: existing.owner, status: existing.status, due: existing.due === '—' ? '' : existing.due, notes: existing.notes || '' }
    : { unit: rep?.unit || '', title: '', owner: '', status: 'قيد التنفيذ', due: '', notes: '' });
  const [obsB, setObsB] = useState<string[]>(() => existing ? splitBullets(existing.obs) : []);
  const [actB, setActB] = useState<string[]>(() => existing ? splitBullets(existing.action) : []);
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : []);
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const unitOpts = [...new Set([...AUDIT_UNITS, (f.unit || '').trim()])].filter(Boolean);

  const save = (send: boolean) => {
    if (!(f.title || '').trim()) { showToast('يرجى إدخال عنوان الملاحظة'); return; }
    mutate((d) => {
      let a: AuditArea & { _mowner?: string };
      if (existing) a = d.audit.find((x) => x.id === obsId)! as never;
      else {
        a = { id: 'au' + Math.floor(Math.random() * 1e9), num: 'م' + (d.audit.filter((x) => (x.rep || 'admin2025') === repId).length + 1), area: '', obs: '', action: '', owner: '', status: 'قيد التنفيذ', imp: 'متوسطة', due: '—', updated: 'الآن', rep: repId, log: [] };
        d.audit.push(a);
        a._mowner = cu.id;
      }
      if (!a) return;
      const prevStatus = existing ? existing.status : '';
      a.unit = (f.unit || '').trim(); a.area = f.title.trim();
      a.obs = joinBullets(obsB); a.action = joinBullets(actB);
      a.owner = (f.owner || '').trim() || cu.name;
      a.status = f.status; a.due = (f.due || '').trim() || '—';
      a.notes = (f.notes || '').trim(); a.attachments = atts;
      a.updated = 'الآن';
      (a.log = a.log || []).unshift({
        at: 'الآن', by: cu.name,
        from: prevStatus && prevStatus !== f.status ? prevStatus : undefined,
        to: prevStatus && prevStatus !== f.status ? f.status : undefined,
        note: existing ? 'تحديث بيانات الملاحظة' : 'إضافة الملاحظة',
      });
      // sending an observation sends its parent report for review
      const r = (d.auditReps || []).find((x) => x.id === repId) as (AuditRep & { _mrev?: boolean; _mret?: string; _mowner?: string; _mlog?: unknown[] }) | undefined;
      if (r) {
        r.lastUpdate = 'الآن'; r.updatedBy = cu.name;
        if (send) {
          r.status = 'بانتظار مراجعة رئيس القطاع'; r._mrev = true; r._mret = ''; r._mowner = r._mowner || cu.id;
          (r._mlog = r._mlog || []).unshift({ at: 'الآن', to: 'بانتظار مراجعة رئيس القطاع', sent: true, by: cu.name, note: 'ملاحظة: ' + f.title.trim() });
        }
      }
    });
    showToast(send ? 'أُرسل التقرير وملاحظاته لرئيس القطاع للمراجعة' : (existing ? 'حُفظت تعديلات الملاحظة' : 'أُضيفت الملاحظة للتقرير'));
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={760}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل الملاحظة' : 'إضافة ملاحظة جديدة'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>{rep ? 'ضمن: ' + rep.title : ''} — تُحفظ في نفس سجل الملاحظات الذي يراه رئيس القطاع.</p>

      {secHead('بيانات الملاحظة')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><Label>الوحدة التنظيمية المعنية</Label><Dropdown value={f.unit} options={unitOpts.map((u) => ({ v: u, label: tr(u) }))} onChange={(v) => setF((p) => ({ ...p, unit: v }))} opt={{ block: true, size: 'sm', popMaxWidth: '340px', placeholder: 'اختر الوحدة…' }} /></div>
        <div><Label>المسؤول عن المعالجة</Label><input value={f.owner} onChange={setI('owner')} placeholder="اكتب اسم المسؤول…" style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>عنوان الملاحظة</Label><input value={f.title} onChange={setI('title')} style={inputStyle} /></div>
        <div><Label>الحالة</Label><Dropdown value={f.status} options={OBS_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setF((p) => ({ ...p, status: v }))} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>تاريخ التنفيذ</Label><DateField value={f.due} onChange={(v) => setF((p) => ({ ...p, due: v }))} /></div>
      </div>

      {secHead('ملاحظة التدقيق الداخلي')}
      <Bullets items={obsB} onChange={setObsB} addLabel="إضافة نقطة" />
      {secHead('آلية إغلاق الملاحظة')}
      <Bullets items={actB} onChange={setActB} addLabel="إضافة نقطة" />

      {secHead('ملاحظات')}
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

/* ================= observation view (details + status update + change log) ================= */
function ObsView({ obsId, onEdit, onClose }: { obsId: string; onEdit: () => void; onClose: () => void }) {
  const { tr, dl } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const a = data.audit.find((x) => x.id === obsId);
  const [newStatus, setNewStatus] = useState(a?.status || 'قيد التنفيذ');
  const [note, setNote] = useState('');
  if (!a) return null;
  const [bg, fg] = OBSC[a.status] || ['#eceeeb', '#6d7973'];
  const box: React.CSSProperties = { background: '#f7f9f6', borderRadius: 11, padding: '10px 13px' };

  const applyStatus = () => {
    if (newStatus === a.status && !note.trim()) { showToast('اختر حالة جديدة أو اكتب ملاحظة للتحديث'); return; }
    mutate((d) => {
      const x = d.audit.find((y) => y.id === obsId);
      if (!x) return;
      const from = x.status;
      x.status = newStatus; x.updated = 'الآن';
      (x.log = x.log || []).unshift({ at: 'الآن', by: cu.name, from, to: newStatus, note: note.trim() || undefined });
    });
    setNote('');
    showToast('حُدّثت حالة الملاحظة وسُجّل التحديث في سجل التغييرات');
  };

  return (
    <Modal open onClose={onClose} width={680}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#17211c', lineHeight: 1.5, flex: 1, minWidth: 200 }}>{tr(a.area)}</h3>
        <Badge bg={bg} fg={fg} style={{ fontSize: 10.5, padding: '4px 12px' }}>{tr(a.status)}</Badge>
      </div>
      <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 12 }}>
        {a.num} · {tr(a.unit || a.area)} · المسؤول: {tr(a.owner)} · تاريخ التنفيذ: {dl(a.due)} · آخر تحديث: {tr(a.updated || '—')}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          تعديل الملاحظة
        </button>
      </div>

      {secHead('ملاحظة التدقيق الداخلي')}
      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {audBullets(a.obs).map((x, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#2a332d', lineHeight: 1.7 }}><span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: '#1e4634', marginTop: 7 }} />{tr(x)}</div>)}
      </div>
      {secHead('آلية إغلاق الملاحظة')}
      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {audBullets(a.action).map((x, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#2a332d', lineHeight: 1.7 }}><span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: '#2b5c44', marginTop: 7 }} />{tr(x)}</div>)}
      </div>
      {!!(a.notes && a.notes.trim()) && (<>{secHead('ملاحظات')}<div style={{ ...box, fontSize: 12.5, color: '#2a332d', lineHeight: 1.7 }}>{tr(a.notes)}</div></>)}
      {!!(a.attachments && a.attachments.length) && (<>{secHead('المرفقات')}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{a.attachments.map((x, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 9, padding: '6px 11px 6px 6px', fontSize: 11.5, color: '#2a332d' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>{x}
            <AttachmentDownload name={x} size={22} />
          </span>))}</div></>)}

      {secHead('تحديث حالة الملاحظة')}
      <div style={{ background: '#f7f9f6', border: '1px solid #e6ece7', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62' }}>الحالة الجديدة:</span>
          <Dropdown value={newStatus} options={OBS_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={setNewStatus} opt={{ size: 'sm', minWidth: '130px' }} />
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة التحديث (اختياري)…" style={inputStyle} />
        <button onClick={applyStatus} style={{ alignSelf: 'flex-start', background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>تحديث الحالة</button>
      </div>

      {secHead('سجل التغييرات')}
      {(a.log && a.log.length) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(a.log as AuditObsLog[]).map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#fbfcfa', border: '1px solid #eef1ec', borderRadius: 10, padding: '9px 12px' }}>
              <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#c9a24b', marginTop: 6 }} />
              <div style={{ fontSize: 11.5, color: '#3c4a42', lineHeight: 1.7 }}>
                <b>{tr(e.by)}</b> · {tr(e.at)}
                {e.from && e.to ? <span> — الحالة: <span style={{ color: '#b0433b' }}>{tr(e.from)}</span> ← <span style={{ color: '#2e7d55', fontWeight: 700 }}>{tr(e.to)}</span></span> : null}
                {e.note ? <div style={{ color: '#6d7973' }}>{tr(e.note)}</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : <div style={{ fontSize: 11.5, color: '#9aa39b' }}>لا توجد تحديثات مسجلة بعد</div>}
    </Modal>
  );
}

/* ================= report view (info + its observations) ================= */
function RepView({ repId, onEditRep, onAddObs, onOpenObs, onEditObs, onClose }: {
  repId: string; onEditRep: () => void; onAddObs: () => void;
  onOpenObs: (id: string) => void; onEditObs: (id: string) => void; onClose: () => void;
}) {
  const { tr, dl } = useI18n();
  const data = useStore((s) => s.data);
  const r = (data.auditReps || []).find((x) => x.id === repId);
  if (!r) return null;
  const meta = r as AuditRep & { _mret?: string };
  const st = meta._mret ? 'أعيد للتعديل' : r.status;
  const [bg, fg] = STC[st] || ['#eceeeb', '#6d7973'];
  const obs = data.audit.filter((a) => (a.rep || 'admin2025') === r.id);

  return (
    <Modal open onClose={onClose} width={780}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#17211c', flex: 1, minWidth: 220 }}>{tr(r.title)}</h3>
        <Badge bg={bg} fg={fg} style={{ fontSize: 10.5, padding: '4px 12px' }}>{tr(st)}</Badge>
      </div>
      <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 12 }}>
        {tr(r.unit)} · {r.year}{r.period ? ' · ' + tr(r.period) : ''} · {tr(r.freq)} · المسؤول: {tr(r.resp)} · آخر تحديث: {dl(r.lastUpdate || '—')} بواسطة {tr(r.updatedBy || '—')}
      </div>
      {!!(meta._mret && meta._mret.trim()) && (
        <div style={{ background: '#fdf3f2', border: '1.5px solid #e7b8b3', borderRadius: 11, padding: '11px 13px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#b0433b', fontWeight: 800, marginBottom: 3 }}>أُعيد للتعديل من رئيس القطاع — سبب الإرجاع</div>
          <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{meta._mret}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <button onClick={onEditRep} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          تعديل التقرير
        </button>
        <button onClick={onAddObs} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          إضافة ملاحظة جديدة
        </button>
      </div>
      {!!(r.notes && r.notes.trim()) && (<>{secHead('ملاحظات عامة')}<div style={{ background: '#f7f9f6', borderRadius: 11, padding: '10px 13px', fontSize: 12.5, color: '#2a332d', lineHeight: 1.7 }}>{tr(r.notes)}</div></>)}
      {!!(r.attachments && r.attachments.length) && (<>{secHead('مرفق التقرير')}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{r.attachments.map((x, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 9, padding: '6px 11px 6px 6px', fontSize: 11.5, color: '#2a332d' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>{x}
            <AttachmentDownload name={x} size={22} />
          </span>))}</div></>)}

      {secHead('ملاحظات التقرير (' + obs.length + ')')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {obs.map((a) => {
          const [ob, of] = OBSC[a.status] || ['#eceeeb', '#6d7973'];
          return (
            <div key={a.id} style={{ border: '1px solid #eef1ec', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#17211c', lineHeight: 1.5 }}>{tr(a.area)}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 3 }}>{a.num} · {tr(a.owner)} · {dl(a.due)}</div>
                </div>
                <Badge bg={ob} fg={of} style={{ fontSize: 9.5, padding: '3px 10px', flex: 'none' }}>{tr(a.status)}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onOpenObs(a.id)} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>فتح</button>
                <button onClick={() => onEditObs(a.id)} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '6px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>تعديل</button>
              </div>
            </div>
          );
        })}
        {obs.length === 0 && <div style={{ padding: 18, textAlign: 'center', color: '#9aa39b', fontSize: 12 }}>لا توجد ملاحظات بعد — أضف أول ملاحظة</div>}
      </div>
    </Modal>
  );
}

/* ================= main workspace ================= */
export function AuditWorkspace() {
  const { tr, dl } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const reports = (data.auditReps || []).slice().sort((a, b) => (b.year || '').localeCompare(a.year || ''));
  const manage = cu.type !== 'chair' && (can(cu, 'auditReports', 'add') || can(cu, 'auditReports', 'edit'));

  const [openRep, setOpenRep] = useState<string | null>(null);
  const [repForm, setRepForm] = useState<{ id: string | null } | null>(null);
  const [obsForm, setObsForm] = useState<{ repId: string; obsId: string | null } | null>(null);
  const [openObs, setOpenObs] = useState<string | null>(null);

  const obsCount = (repId: string) => data.audit.filter((a) => (a.rep || 'admin2025') === repId);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 21, fontWeight: 800, color: '#17211c' }}>تقرير المتابعة - مكتب التدقيق</h1>
          <p style={{ margin: 0, fontSize: 12.5, color: '#7d867f' }}>إدارة التقارير الدورية وتقارير الحاجة وملاحظاتها — سجل مشترك واحد يظهر لرئيس القطاع فوراً.</p>
        </div>
        {manage && (
          <div className="page-head-action" style={{ flex: 'none' }}>
            <button onClick={() => setRepForm({ id: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              إضافة تقرير جديد
            </button>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.14)' }}>
        <div className="trow thead" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.1fr 70px 90px 1.1fr 1fr 250px', gap: 10, padding: '11px 16px', background: '#f7f9f6', borderBottom: '1px solid #eef1ec', fontSize: 11, fontWeight: 700, color: '#7d867f' }}>
          <div>التقرير</div><div>الوحدة</div><div>السنة</div><div>الدورية</div><div>الحالة</div><div>آخر تحديث</div><div />
        </div>
        {reports.map((r) => {
          const meta = r as AuditRep & { _mret?: string };
          const st = meta._mret ? 'أعيد للتعديل' : r.status;
          const [bg, fg] = STC[st] || ['#eceeeb', '#6d7973'];
          const o = obsCount(r.id);
          return (
            <div key={r.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.1fr 70px 90px 1.1fr 1fr 250px', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f2f4f0', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45 }}>{tr(r.title)}</div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{o.length} ملاحظة · {o.filter((a) => a.status === 'مغلق').length} مغلقة</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{tr(r.unit)}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#17211c' }}>{r.year}</div>
              <div style={{ fontSize: 11.5, color: '#3c4a42' }}>{tr(r.freq)}</div>
              <div><Badge bg={bg} fg={fg} style={{ fontSize: 10, padding: '4px 11px' }}>{tr(st)}</Badge></div>
              <div style={{ fontSize: 11, color: '#5b6b62' }}>{dl(r.lastUpdate || '—')}<div style={{ color: '#9aa39b' }}>{tr(r.updatedBy || '—')}</div></div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => setOpenRep(r.id)} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>فتح</button>
                {manage && <button onClick={() => setRepForm({ id: r.id })} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>تعديل</button>}
                {manage && <button onClick={() => setObsForm({ repId: r.id, obsId: null })} style={{ background: '#fbf3df', color: '#8a6a1f', border: '1px solid #ecdcae', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إضافة ملاحظة جديدة</button>}
              </div>
            </div>
          );
        })}
        {reports.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9aa39b', fontSize: 12.5 }}>لا توجد تقارير بعد</div>}
      </div>

      {openRep && !obsForm && !openObs && (
        <RepView repId={openRep}
          onEditRep={() => setRepForm({ id: openRep })}
          onAddObs={() => setObsForm({ repId: openRep, obsId: null })}
          onOpenObs={(id) => setOpenObs(id)}
          onEditObs={(id) => setObsForm({ repId: openRep, obsId: id })}
          onClose={() => setOpenRep(null)} />
      )}
      {openObs && !obsForm && (
        <ObsView obsId={openObs}
          onEdit={() => { const a = data.audit.find((x) => x.id === openObs); setObsForm({ repId: a?.rep || 'admin2025', obsId: openObs }); }}
          onClose={() => setOpenObs(null)} />
      )}
      {repForm && <RepForm repId={repForm.id} onClose={() => setRepForm(null)} />}
      {obsForm && <ObsForm repId={obsForm.repId} obsId={obsForm.obsId} onClose={() => setObsForm(null)} />}
    </div>
  );
}
