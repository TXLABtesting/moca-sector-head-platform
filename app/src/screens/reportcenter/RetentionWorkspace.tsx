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
import type { RetReport, RetRecommendation, RetEntityRow, RetCase } from '../../data/types';
import { triggerDownload } from '../../shared/fileGen';
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, PLACEHOLDER } from './templateIO';

/* eslint-disable @typescript-eslint/no-explicit-any */

const QUARTERS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
const PRIS = ['عالية', 'متوسطة', 'منخفضة'];
const STC: Record<string, [string, string]> = {
  'مسودة': ['#eceeeb', '#6d7973'],
  'بانتظار اعتماد رئيس القطاع': ['#fbf0d6', '#a9791f'],
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

const fmt = (n: number) => n.toLocaleString('en-US');
const num = (v: string) => parseFloat(String(v).replace(/[^\d.]/g, '')) || 0;

/* ================= bullets editor (add / edit / delete / reorder) ================= */
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

/* ================= template download / parse ================= */
function buildTemplateDocx(): Blob {
  const ph = 'اكتب هنا';
  const bullets = (n: number) => Array.from({ length: n }, () => wP('- ' + ph)).join('');
  const body =
    wP('تقرير الدفعات المستبقاة', { bold: true, size: 36 }) +
    wP('السنة: 2026') + wP('الربع: الربع الثالث') +
    wP('الملخص التنفيذي', { bold: true, size: 28 }) + bullets(3) +
    wP('نقاط القوة', { bold: true, size: 28 }) + bullets(3) +
    wP('نقاط الضعف', { bold: true, size: 28 }) + bullets(3) +
    wP('مجالات التحسين', { bold: true, size: 28 }) + bullets(3) +
    wP('التوصيات', { bold: true, size: 28 }) +
    wTbl(['الملاحظة', 'التوصية', 'الأهمية'], Array.from({ length: 3 }, () => [ph, ph, ph])) +
    wP('المؤشرات والاتجاهات حسب الجهة', { bold: true, size: 28 }) +
    wTbl(['الجهة', 'العدد', 'القيمة (درهم)', 'النسبة', 'مستمر', 'غير مغلق', 'مغلق'], Array.from({ length: 4 }, () => [ph, ph, ph, ph, ph, ph, ph])) +
    wP('أعلى الحالات التي تستحق متابعة رئيس القطاع', { bold: true, size: 28 }) +
    wTbl(['رقم العقد', 'القيمة (درهم)', 'أسباب التأخر', 'الحالة'], Array.from({ length: 2 }, () => [ph, ph, ph, ph])) +
    wP('الخلاصة', { bold: true, size: 28 }) + wP(ph);
  return makeDocx(body);
}

const TEMPLATE_NAME = 'Retained_Payments_Report_Template.docx';
const TEMPLATE_XLSX = 'Retained_Payments_Report_Template.xlsx';

/** Excel version of the template — same labels/sections the parser reads back. */
function buildTemplateXlsx(): Blob {
  const rows: string[][] = [
    ['الحقل', 'القيمة'],
    ['السنة', '2026'],
    ['الربع', 'الربع الثالث'],
    ['الملخص التنفيذي 1', ''], ['الملخص التنفيذي 2', ''], ['الملخص التنفيذي 3', ''],
    ['نقاط القوة 1', ''], ['نقاط القوة 2', ''], ['نقاط القوة 3', ''],
    ['نقاط الضعف 1', ''], ['نقاط الضعف 2', ''], ['نقاط الضعف 3', ''],
    ['مجالات التحسين 1', ''], ['مجالات التحسين 2', ''], ['مجالات التحسين 3', ''],
    ['الخلاصة', ''],
    [''],
    ['الملاحظة', 'التوصية', 'الأهمية'],
    ['', '', ''], ['', '', ''], ['', '', ''],
    [''],
    ['الجهة', 'العدد', 'القيمة (درهم)', 'النسبة', 'مستمر', 'غير مغلق', 'مغلق'],
    ['', '', '', '', '', '', ''], ['', '', '', '', '', '', ''], ['', '', '', '', '', '', ''],
    [''],
    ['رقم العقد', 'القيمة (درهم)', 'أسباب التأخر', 'الحالة'],
    ['', '', '', ''], ['', '', '', ''],
  ];
  return makeXlsx(rows, 'قالب التقرير');
}

const downloadTemplate = () => triggerDownload(buildTemplateDocx(), TEMPLATE_NAME);
const downloadTemplateXlsx = () => triggerDownload(buildTemplateXlsx(), TEMPLATE_XLSX);

interface Parsed {
  year?: string; quarter?: string;
  execSummary?: string[]; strengths?: string[]; weaknesses?: string[]; improvements?: string[];
  recs?: RetRecommendation[]; entities?: RetEntityRow[]; cases?: RetCase[]; conclusion?: string;
  missing: string[];
}

function parseReportFile(lines: string[], tablesIn: string[][][]): Parsed {
  // An Excel upload arrives as ONE sheet-table: split it into sections at the
  // known header rows so the docx table logic below applies unchanged.
  const tables: string[][][] = [];
  for (const t of tablesIn) {
    const cuts: number[] = [];
    t.forEach((r, i) => {
      const j = r.join(' ');
      const isHeadRow = (/الملاحظة/.test(r[0] || '') && /التوصية/.test(j))
        || ((r[0] || '').trim() === 'الجهة' && /العدد/.test(j))
        || ((r[0] || '').trim() === 'رقم العقد');
      if (i > 0 && isHeadRow) cuts.push(i);
    });
    if (!cuts.length) { tables.push(t); continue; }
    let prev = 0;
    [...cuts, t.length].forEach((c) => { const seg = t.slice(prev, c).filter((r) => r.some((x) => (x || '').trim())); if (seg.length) tables.push(seg); prev = c; });
  }
  const found: Parsed = { missing: [] };
  // Excel-style fallback: bullet sections stored as numbered label→value rows
  const kvMany = (label: RegExp): string[] | undefined => {
    const out: string[] = [];
    for (const t of tables) for (const r of t) {
      if (label.test((r[0] || '').trim())) {
        const v = (r[1] || '').trim();
        if (v && !PLACEHOLDER.test(v)) out.push(v);
      }
    }
    return out.length ? out : undefined;
  };
  // year/quarter may live in the header table, not the paragraphs
  const all = lines.join('\n') + '\n' + tables.map((t) => t.flat().join('\n')).join('\n');
  const ym = all.match(/20\d{2}/); if (ym) found.year = ym[0];
  const qm = all.match(/الربع (الأول|الثاني|الثالث|الرابع)/); if (qm) found.quarter = 'الربع ' + qm[1];

  const HEADS: { key: keyof Parsed; re: RegExp }[] = [
    { key: 'execSummary', re: /^الملخص التنفيذي/ },
    { key: 'strengths', re: /^نقاط القوة/ },
    { key: 'weaknesses', re: /(^نقاط الضعف|^الضعف)/ },
    { key: 'improvements', re: /^مجالات التحسين/ },
    { key: 'conclusion', re: /^الخلاصة/ },
  ];
  const isHead = (l: string) => HEADS.some((h) => h.re.test(l)) || /^التوصيات|^المؤشرات|^أعلى|^نقاط القوة والضعف/.test(l);
  const bulletsAfter = (re: RegExp): string[] | undefined => {
    const i = lines.findIndex((l) => re.test(l));
    if (i < 0) return undefined;
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (isHead(l)) break;
      if (l.startsWith(' TABLE')) {
        const t = tables[parseInt(l.slice(6), 10)];
        t.flat().forEach((cell) => { const v = cell.replace(/^نقاط\s*(القوة|الضعف)\s*/, '').trim(); if (v && !PLACEHOLDER.test(v) && !/^نقاط/.test(cell)) out.push(v); });
        continue;
      }
      const v = l.replace(/^[-•*]\s*/, '').trim();
      if (v && !PLACEHOLDER.test(v)) out.push(v);
    }
    return out.length ? out : undefined;
  };

  found.execSummary = bulletsAfter(/^الملخص التنفيذي/);
  found.strengths = bulletsAfter(/^نقاط القوة$/) || (() => {
    const t = tables.find((tb) => tb[0] && /نقاط\s*القوة/.test(tb[0].join(' ')));
    if (!t) return undefined;
    const out = t.slice(1).flat().map((x) => x.trim()).filter((x) => x && !PLACEHOLDER.test(x));
    return out.length ? out : undefined;
  })();
  found.weaknesses = bulletsAfter(/^نقاط الضعف$/) || (() => {
    const t = tables.find((tb) => tb[0] && /الضعف/.test(tb[0].join(' ')));
    if (!t) return undefined;
    const out = t.slice(1).flat().map((x) => x.trim()).filter((x) => x && !PLACEHOLDER.test(x));
    return out.length ? out : undefined;
  })();
  found.improvements = bulletsAfter(/^مجالات التحسين/);
  const ci = lines.findIndex((l) => /^الخلاصة/.test(l));
  if (ci >= 0) {
    const parts = lines.slice(ci + 1).filter((l) => !l.startsWith(' ') && !PLACEHOLDER.test(l));
    if (parts.length) found.conclusion = parts.join(' ');
  }

  found.execSummary = found.execSummary || kvMany(/^الملخص التنفيذي/);
  found.strengths = found.strengths || kvMany(/^نقاط القوة/);
  found.weaknesses = found.weaknesses || kvMany(/^نقاط الضعف/);
  found.improvements = found.improvements || kvMany(/^مجالات التحسين/);
  if (!found.conclusion) {
    for (const t of tables) for (const r of t) {
      if (/^الخلاصة/.test((r[0] || '').trim())) { const v = (r[1] || '').trim(); if (v && !PLACEHOLDER.test(v)) found.conclusion = v; }
    }
  }

  for (const t of tables) {
    const head = (t[0] || []).join(' ');
    const rows = t.slice(1).filter((r) => r.some((c) => c && !PLACEHOLDER.test(c)));
    if (/التوصية/.test(head)) {
      const hi = t[0].map((h) => h.trim());
      const col = (names: string[]) => hi.findIndex((h) => names.some((n) => h.includes(n)));
      const cNote = col(['الملاحظة']), cRec = col(['التوصية']), cPri = col(['الأهمية', 'الحالة']);
      const recs = rows.map((r) => ({ note: (r[cNote] || '').trim(), rec: (r[cRec] || '').trim(), pri: PRIS.find((p) => (r[cPri] || '').includes(p)) || 'متوسطة' }))
        .filter((r) => (r.note && !PLACEHOLDER.test(r.note)) || (r.rec && !PLACEHOLDER.test(r.rec)))
        .map((r) => ({ ...r, note: PLACEHOLDER.test(r.note) ? '' : r.note, rec: PLACEHOLDER.test(r.rec) ? '' : r.rec }));
      if (recs.length) found.recs = recs;
    } else if (/الجهة/.test(head) && /العدد/.test(head)) {
      const ents = rows.filter((r) => !/الإجمالي/.test(r[0] || '') && r[0] && !PLACEHOLDER.test(r[0]))
        .map((r) => ({ entity: r[0].trim(), count: num(r[1] || ''), value: num(r[2] || ''), pct: PLACEHOLDER.test(r[3] || '') ? '' : (r[3] || '').trim(), ongoing: num(r[4] || ''), open: num(r[5] || ''), closed: num(r[6] || '') }));
      if (ents.length) found.entities = ents;
    } else if (/رقم العقد/.test(head)) {
      const cs = rows.filter((r) => r[0] && !PLACEHOLDER.test(r[0]))
        .map((r) => ({ contract: r[0].trim(), value: num(r[1] || ''), reasons: PLACEHOLDER.test(r[2] || '') ? '' : (r[2] || '').trim(), status: /غير مغلق/.test(r[3] || '') ? 'غير مغلق' : (/مغلق/.test(r[3] || '') ? 'مغلق' : 'غير مغلق') }));
      if (cs.length) found.cases = cs;
    }
  }

  const KEYS: { k: keyof Parsed; ar: string }[] = [
    { k: 'year', ar: 'السنة' }, { k: 'quarter', ar: 'الربع' }, { k: 'execSummary', ar: 'الملخص التنفيذي' },
    { k: 'strengths', ar: 'نقاط القوة' }, { k: 'weaknesses', ar: 'نقاط الضعف' }, { k: 'improvements', ar: 'مجالات التحسين' },
    { k: 'recs', ar: 'التوصيات' }, { k: 'entities', ar: 'المؤشرات حسب الجهة' }, { k: 'cases', ar: 'أعلى الحالات' }, { k: 'conclusion', ar: 'الخلاصة' },
  ];
  found.missing = KEYS.filter((x) => found[x.k] === undefined).map((x) => x.ar);
  return found;
}

/* ================= the form ================= */
function RetForm({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = reportId ? (data.retReports || []).find((r) => r.id === reportId) : null;
  const [f, setF] = useState<Record<string, string>>(() => existing
    ? { year: existing.year, quarter: existing.quarter, date: existing.date, conclusion: existing.conclusion || '' }
    : { year: '2026', quarter: 'الربع الثالث', date: '', conclusion: '' });
  const [execS, setExecS] = useState<string[]>(() => existing?.execSummary ? [...existing.execSummary] : []);
  const [strengths, setStrengths] = useState<string[]>(() => existing?.strengths ? [...existing.strengths] : []);
  const [weaknesses, setWeaknesses] = useState<string[]>(() => existing?.weaknesses ? [...existing.weaknesses] : []);
  const [improvements, setImprovements] = useState<string[]>(() => existing?.improvements ? [...existing.improvements] : []);
  const [recs, setRecs] = useState<RetRecommendation[]>(() => existing?.recs ? existing.recs.map((r) => ({ ...r })) : []);
  const [ents, setEnts] = useState<RetEntityRow[]>(() => existing?.entities ? existing.entities.map((r) => ({ ...r })) : []);
  const [cases, setCases] = useState<RetCase[]>(() => existing?.cases ? existing.cases.map((r) => ({ ...r })) : []);
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : []);
  const [missing, setMissing] = useState<string[]>([]);
  const [parsedFrom, setParsedFrom] = useState('');

  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setRec = (i: number, k: keyof RetRecommendation, v: string) => setRecs((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const setEnt = (i: number, k: keyof RetEntityRow, v: string) => setEnts((p) => p.map((r, j) => (j === i ? { ...r, [k]: k === 'entity' || k === 'pct' ? v : num(v) } : r)) as RetEntityRow[]);
  const setCase = (i: number, k: keyof RetCase, v: string) => setCases((p) => p.map((r, j) => (j === i ? { ...r, [k]: k === 'value' ? num(v) : v } : r)) as RetCase[]);

  const totals = ents.reduce((a, r) => ({ count: a.count + r.count, value: a.value + r.value, ongoing: a.ongoing + r.ongoing, open: a.open + r.open, closed: a.closed + r.closed }), { count: 0, value: 0, ongoing: 0, open: 0, closed: 0 });

  const onUpload = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      if (!blocks) { showToast('تعذّرت قراءة الملف تلقائياً — أُرفق دون تعبئة'); setAtts((p) => [...p, file.name]); return; }
      const parsed = parseReportFile(blocks.lines, blocks.tables);
      if (parsed.year) setF((p) => ({ ...p, year: parsed.year! }));
      if (parsed.quarter) setF((p) => ({ ...p, quarter: parsed.quarter! }));
      if (parsed.execSummary) setExecS(parsed.execSummary);
      if (parsed.strengths) setStrengths(parsed.strengths);
      if (parsed.weaknesses) setWeaknesses(parsed.weaknesses);
      if (parsed.improvements) setImprovements(parsed.improvements);
      if (parsed.recs) setRecs(parsed.recs);
      if (parsed.entities) setEnts(parsed.entities);
      if (parsed.cases) setCases(parsed.cases);
      if (parsed.conclusion) setF((p) => ({ ...p, conclusion: parsed.conclusion! }));
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
    const y = (f.year || '').trim();
    if (!/^20\d{2}$/.test(y)) { showToast('يرجى إدخال سنة صحيحة (مثال: 2026)'); return; }
    const dup = (data.retReports || []).find((r) => r.id !== reportId && r.year === y && r.quarter === f.quarter);
    if (dup) { showToast('يوجد تقرير مسجّل بالفعل لـ' + f.quarter + ' ' + y + ' — لا يمكن إنشاء تقريرين لنفس الفترة'); return; }
    mutate((d) => {
      d.retReports = d.retReports || [];
      let r: RetReport & { _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] };
      if (existing) r = d.retReports.find((x) => x.id === reportId)! as never;
      else {
        r = { id: 'ret' + Math.floor(Math.random() * 1e9), year: '', quarter: '', date: '', status: 'مسودة', lastUpdate: '', updatedBy: '', execSummary: [], strengths: [], weaknesses: [], improvements: [], recs: [], entities: [], cases: [], conclusion: '' };
        d.retReports.unshift(r);
        r._mowner = cu.id;
      }
      if (!r) return;
      r.year = y; r.quarter = f.quarter; r.date = (f.date || '').trim();
      r.execSummary = execS.filter((x) => x.trim());
      r.strengths = strengths.filter((x) => x.trim());
      r.weaknesses = weaknesses.filter((x) => x.trim());
      r.improvements = improvements.filter((x) => x.trim());
      r.recs = recs.filter((x) => x.note.trim() || x.rec.trim());
      r.entities = ents.filter((x) => x.entity.trim());
      r.cases = cases.filter((x) => x.contract.trim());
      r.conclusion = (f.conclusion || '').trim();
      r.attachments = atts;
      r.lastUpdate = 'الآن'; r.updatedBy = cu.name;
      if (send) { r.status = 'بانتظار اعتماد رئيس القطاع'; r._mrev = true; r._mret = ''; r._mowner = r._mowner || cu.id; }
      else if (!r._mrev) r.status = r.status === 'معتمد' ? r.status : 'مسودة';
      (r._mlog = r._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار اعتماد رئيس القطاع' : 'حفظ كمسودة', sent: !!send, by: cu.name });
    });
    showToast(send ? 'أُرسل التقرير لرئيس القطاع للمراجعة — ظاهر لديه في مركز التقارير' : 'حُفظ التقرير كمسودة');
    onClose();
  };

  const rowBtn: React.CSSProperties = { flex: 'none', width: 26, height: 26, border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 13 };
  const addRowBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginTop: 8 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{label}
    </button>
  );
  const th: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#7d867f', textAlign: 'start', padding: '4px 2px' };
  const needs = (ar: string) => parsedFrom !== '' && missing.includes(ar);

  return (
    <Modal open onClose={onClose} width={820}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل تقرير الدفعات المستبقاة' : 'تقرير دفعات مستبقاة جديد'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>يُحفظ في نفس السجل الذي يراه رئيس القطاع في مركز التقارير.</p>

      {/* template download / upload */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
        <button type="button" onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
          تحميل قالب Word
        </button>
        <button type="button" onClick={downloadTemplateXlsx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
          تحميل قالب Excel
        </button>
        <input ref={fileRef} type="file" accept=".doc,.docx,.xlsx,.xls,.csv,.html,.htm,.txt" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 0-4 4m4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
          رفع التقرير المكتمل (تعبئة تلقائية)
        </button>
        <span style={{ fontSize: 10.5, color: '#7d867f' }}>يُقبل Word أو Excel — عبّئ القالب ثم ارفعه، وتُعرض البيانات للمراجعة ولا تُحفظ مباشرة.</span>
      </div>
      {parsedFrom && (
        <div style={{ margin: '8px 0 0', background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#1e4634' }}>
          قُرئت البيانات من «{parsedFrom}» — راجعها وعدّلها قبل الحفظ.{missing.length > 0 && <span style={{ color: '#a9791f', fontWeight: 700 }}> حقول لم يُتعرف عليها: {missing.join('، ')}.</span>}
        </div>
      )}

      {/* 1. report info */}
      {secHead('معلومات التقرير')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <div><Label>السنة</Label><input value={f.year} onChange={setI('year')} style={{ ...inputStyle, ...(needs('السنة') ? { borderColor: '#e9c877', background: '#fdf9ee' } : {}) }} /></div>
        <div><Label>الربع</Label><Dropdown value={f.quarter} options={QUARTERS.map((q) => ({ v: q, label: tr(q) }))} onChange={(v) => setF((p) => ({ ...p, quarter: v }))} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>تاريخ التقرير</Label><DateField value={f.date} onChange={(v) => setF((p) => ({ ...p, date: v }))} /></div>
        <div><Label>حالة التقرير</Label><div style={{ ...inputStyle, background: '#f2f4f0', color: '#7d867f' }}>{existing ? tr(existing.status) : 'مسودة'} — تُدار من سير العمل</div></div>
      </div>

      {secHead('الملخص التنفيذي', needs('الملخص التنفيذي'))}
      <Bullets items={execS} onChange={setExecS} addLabel="إضافة نقطة" />
      {secHead('نقاط القوة', needs('نقاط القوة'))}
      <Bullets items={strengths} onChange={setStrengths} addLabel="إضافة نقطة قوة" />
      {secHead('نقاط الضعف', needs('نقاط الضعف'))}
      <Bullets items={weaknesses} onChange={setWeaknesses} addLabel="إضافة نقطة ضعف" />
      {secHead('مجالات التحسين', needs('مجالات التحسين'))}
      <Bullets items={improvements} onChange={setImprovements} addLabel="إضافة مجال تحسين" />

      {secHead('التوصيات', needs('التوصيات'))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 110px 26px', gap: 8 }}>
          <span style={th}>الملاحظة</span><span style={th}>التوصية</span><span style={th}>مستوى الأهمية</span><span />
        </div>
        {recs.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 110px 26px', gap: 8, alignItems: 'center' }}>
            <input value={r.note} onChange={(e) => setRec(i, 'note', e.target.value)} style={inputStyle} />
            <input value={r.rec} onChange={(e) => setRec(i, 'rec', e.target.value)} style={inputStyle} />
            <Dropdown value={r.pri} options={PRIS.map((p) => ({ v: p, label: tr(p) }))} onChange={(v) => setRec(i, 'pri', v)} opt={{ block: true, size: 'sm' }} />
            <button type="button" onClick={() => setRecs((p) => p.filter((_, j) => j !== i))} style={rowBtn}>✕</button>
          </div>
        ))}
        {addRowBtn('إضافة توصية', () => setRecs((p) => [...p, { note: '', rec: '', pri: 'متوسطة' }]))}
      </div>

      {secHead('المؤشرات والاتجاهات حسب الجهة', needs('المؤشرات حسب الجهة'))}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 700, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 70px 130px 80px 70px 80px 70px 26px', gap: 7 }}>
            <span style={th}>اسم الجهة</span><span style={th}>العدد</span><span style={th}>القيمة (درهم)</span><span style={th}>النسبة</span><span style={th}>مستمر</span><span style={th}>غير مغلق</span><span style={th}>مغلق</span><span />
          </div>
          {ents.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.8fr 70px 130px 80px 70px 80px 70px 26px', gap: 7, alignItems: 'center' }}>
              <input value={r.entity} onChange={(e) => setEnt(i, 'entity', e.target.value)} style={inputStyle} />
              <input value={String(r.count || '')} onChange={(e) => setEnt(i, 'count', e.target.value)} style={inputStyle} />
              <input value={String(r.value || '')} onChange={(e) => setEnt(i, 'value', e.target.value)} style={inputStyle} />
              <input value={r.pct} onChange={(e) => setEnt(i, 'pct', e.target.value)} style={inputStyle} />
              <input value={String(r.ongoing || '')} onChange={(e) => setEnt(i, 'ongoing', e.target.value)} style={inputStyle} />
              <input value={String(r.open || '')} onChange={(e) => setEnt(i, 'open', e.target.value)} style={inputStyle} />
              <input value={String(r.closed || '')} onChange={(e) => setEnt(i, 'closed', e.target.value)} style={inputStyle} />
              <button type="button" onClick={() => setEnts((p) => p.filter((_, j) => j !== i))} style={rowBtn}>✕</button>
            </div>
          ))}
          {ents.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 70px 130px 80px 70px 80px 70px 26px', gap: 7, background: '#eef3f0', borderRadius: 9, padding: '8px 2px', fontSize: 11.5, fontWeight: 800, color: '#1e4634' }}>
              <span style={{ paddingInlineStart: 10 }}>الإجمالي (محسوب تلقائياً)</span>
              <span>{fmt(totals.count)}</span><span>{fmt(totals.value)}</span><span>—</span>
              <span>{fmt(totals.ongoing)}</span><span>{fmt(totals.open)}</span><span>{fmt(totals.closed)}</span><span />
            </div>
          )}
          {addRowBtn('إضافة جهة', () => setEnts((p) => [...p, { entity: '', count: 0, value: 0, pct: '', ongoing: 0, open: 0, closed: 0 }]))}
        </div>
      </div>

      {secHead('أعلى الحالات التي تستحق متابعة رئيس القطاع', needs('أعلى الحالات'))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 140px 1.6fr 110px 26px', gap: 8 }}>
          <span style={th}>رقم العقد</span><span style={th}>القيمة (درهم)</span><span style={th}>أسباب التأخر</span><span style={th}>الحالة</span><span />
        </div>
        {cases.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 140px 1.6fr 110px 26px', gap: 8, alignItems: 'center' }}>
            <input value={r.contract} onChange={(e) => setCase(i, 'contract', e.target.value)} style={inputStyle} />
            <input value={String(r.value || '')} onChange={(e) => setCase(i, 'value', e.target.value)} style={inputStyle} />
            <input value={r.reasons} onChange={(e) => setCase(i, 'reasons', e.target.value)} style={inputStyle} />
            <Dropdown value={r.status} options={['مغلق', 'غير مغلق'].map((v) => ({ v, label: tr(v) }))} onChange={(v) => setCase(i, 'status', v)} opt={{ block: true, size: 'sm' }} />
            <button type="button" onClick={() => setCases((p) => p.filter((_, j) => j !== i))} style={rowBtn}>✕</button>
          </div>
        ))}
        {addRowBtn('إضافة حالة', () => setCases((p) => [...p, { contract: '', value: 0, reasons: '', status: 'غير مغلق' }]))}
      </div>

      {secHead('الخلاصة', needs('الخلاصة'))}
      <textarea value={f.conclusion} onChange={setI('conclusion')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />

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

/* ================= read view ================= */
function RetView({ report, onClose }: { report: RetReport; onClose: () => void }) {
  const meta = report as RetReport & { _mret?: string; _mlog?: { at: string; to?: string; note?: string; by?: string; chair?: boolean }[] };
  const [bg, fg] = STC[meta._mret ? 'أعيد للتعديل' : report.status] || ['#eceeeb', '#6d7973'];
  const box: React.CSSProperties = { background: '#f7f9f6', borderRadius: 11, padding: '10px 13px' };
  const tcell: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#2a332d', borderBottom: '1px solid #f2f4f0', textAlign: 'start' };
  const thead: React.CSSProperties = { ...tcell, fontSize: 10.5, fontWeight: 700, color: '#7d867f', background: '#f7f9f6' };
  const totals = report.entities.reduce((a, r) => ({ count: a.count + r.count, value: a.value + r.value, ongoing: a.ongoing + r.ongoing, open: a.open + r.open, closed: a.closed + r.closed }), { count: 0, value: 0, ongoing: 0, open: 0, closed: 0 });
  return (
    <Modal open onClose={onClose} width={780}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#17211c' }}>تقرير الدفعات المستبقاة — {report.quarter} {report.year}</h3>
        <Badge bg={bg} fg={fg} style={{ fontSize: 10.5, padding: '4px 12px' }}>{meta._mret ? 'أعيد للتعديل' : report.status}</Badge>
      </div>
      <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 12 }}>تاريخ التقرير: {report.date || '—'} · آخر تحديث: {report.lastUpdate || '—'} · بواسطة: {report.updatedBy || '—'}</div>
      {!!(meta._mret && meta._mret.trim()) && (
        <div style={{ background: '#fdf3f2', border: '1.5px solid #e7b8b3', borderRadius: 11, padding: '11px 13px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#b0433b', fontWeight: 800, marginBottom: 3 }}>أُعيد للتعديل من رئيس القطاع — سبب الإرجاع</div>
          <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{meta._mret}</div>
        </div>
      )}
      {([['الملخص التنفيذي', report.execSummary], ['نقاط القوة', report.strengths], ['نقاط الضعف', report.weaknesses], ['مجالات التحسين', report.improvements]] as [string, string[]][]).map(([t, arr]) => arr.length > 0 && (
        <div key={t} style={{ marginBottom: 12 }}>
          {secHead(t)}
          <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {arr.map((x, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#2a332d', lineHeight: 1.6 }}><span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: '#1e4634', marginTop: 7 }} />{x}</div>)}
          </div>
        </div>
      ))}
      {report.recs.length > 0 && (<div style={{ marginBottom: 12 }}>{secHead('التوصيات')}
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' }}><thead><tr><th style={thead}>الملاحظة</th><th style={thead}>التوصية</th><th style={thead}>الأهمية</th></tr></thead>
          <tbody>{report.recs.map((r, i) => <tr key={i}><td style={tcell}>{r.note}</td><td style={tcell}>{r.rec}</td><td style={tcell}>{r.pri}</td></tr>)}</tbody></table></div>)}
      {report.entities.length > 0 && (<div style={{ marginBottom: 12 }}>{secHead('المؤشرات والاتجاهات حسب الجهة')}
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}><thead><tr>{['الجهة', 'العدد', 'القيمة (درهم)', 'النسبة', 'مستمر', 'غير مغلق', 'مغلق'].map((h) => <th key={h} style={thead}>{h}</th>)}</tr></thead>
          <tbody>{report.entities.map((r, i) => <tr key={i}><td style={tcell}>{r.entity}</td><td style={tcell}>{fmt(r.count)}</td><td style={tcell}>{fmt(r.value)}</td><td style={tcell}>{r.pct}</td><td style={tcell}>{fmt(r.ongoing)}</td><td style={tcell}>{fmt(r.open)}</td><td style={tcell}>{fmt(r.closed)}</td></tr>)}
            <tr>{['الإجمالي', fmt(totals.count), fmt(totals.value), '—', fmt(totals.ongoing), fmt(totals.open), fmt(totals.closed)].map((v, i) => <td key={i} style={{ ...tcell, fontWeight: 800, color: '#1e4634', background: '#eef3f0' }}>{v}</td>)}</tr></tbody></table></div></div>)}
      {report.cases.length > 0 && (<div style={{ marginBottom: 12 }}>{secHead('أعلى الحالات التي تستحق متابعة رئيس القطاع')}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['رقم العقد', 'القيمة (درهم)', 'أسباب التأخر', 'الحالة'].map((h) => <th key={h} style={thead}>{h}</th>)}</tr></thead>
          <tbody>{report.cases.map((r, i) => <tr key={i}><td style={tcell}>{r.contract}</td><td style={tcell}>{fmt(r.value)}</td><td style={tcell}>{r.reasons}</td><td style={{ ...tcell, fontWeight: 700, color: r.status === 'مغلق' ? '#2e7d55' : '#b0433b' }}>{r.status}</td></tr>)}</tbody></table></div>)}
      {report.conclusion && (<div style={{ marginBottom: 12 }}>{secHead('الخلاصة')}<div style={{ ...box, fontSize: 12.5, color: '#2a332d', lineHeight: 1.8 }}>{report.conclusion}</div></div>)}
      {!!(report.attachments && report.attachments.length) && (<div>{secHead('المرفقات')}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{report.attachments.map((a, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 9, padding: '6px 11px 6px 6px', fontSize: 11.5, color: '#2a332d' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>{a}
            <AttachmentDownload name={a} size={22} />
          </span>))}</div></div>)}
    </Modal>
  );
}

/* ================= list workspace ================= */
export function RetentionWorkspace() {
  const { tr, dl } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const reports = (data.retReports || []).slice().sort((a, b) => (b.year + QUARTERS.indexOf(b.quarter)).localeCompare(a.year + QUARTERS.indexOf(a.quarter)));

  const manage = cu.type !== 'chair' && (can(cu, 'reportCenter', 'add') || can(cu, 'reportCenter', 'edit'));
  const [viewId, setViewId] = useState<string | null>(null);
  const [formId, setFormId] = useState<{ id: string | null } | null>(null);

  const viewRep = viewId ? reports.find((r) => r.id === viewId) : null;

  return (
    <div style={{ marginTop: 22 }}>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#17211c' }}>تقارير الدفعات المستبقاة — السابقة والحالية</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#7d867f' }}>سجل مشترك واحد — كل تقرير يُنشأ أو يُعدّل هنا يظهر لرئيس القطاع فوراً.</p>
        </div>
        {manage && (
          <div className="page-head-action" style={{ flex: 'none' }}>
            <button onClick={() => setFormId({ id: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              إنشاء تقرير جديد
            </button>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.14)' }}>
        <div className="trow thead" style={{ display: 'grid', gridTemplateColumns: '90px 130px 1.4fr 1fr 1fr 190px', gap: 10, padding: '11px 16px', background: '#f7f9f6', borderBottom: '1px solid #eef1ec', fontSize: 11, fontWeight: 700, color: '#7d867f' }}>
          <div>السنة</div><div>الربع</div><div>حالة التقرير</div><div>آخر تحديث</div><div>من قام بالتحديث</div><div />
        </div>
        {reports.map((r) => {
          const meta = r as RetReport & { _mret?: string };
          const st = meta._mret ? 'أعيد للتعديل' : r.status;
          const [bg, fg] = STC[st] || ['#eceeeb', '#6d7973'];
          const editable = manage && st !== 'معتمد';
          return (
            <div key={r.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '90px 130px 1.4fr 1fr 1fr 190px', gap: 10, padding: '11px 16px', borderBottom: '1px solid #f2f4f0', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#17211c' }}>{r.year}</div>
              <div style={{ fontSize: 12.5, color: '#3c4a42' }}>{tr(r.quarter)}</div>
              <div><Badge bg={bg} fg={fg} style={{ fontSize: 10, padding: '4px 11px' }}>{tr(st)}</Badge></div>
              <div style={{ fontSize: 11.5, color: '#5b6b62' }}>{dl(r.lastUpdate || '—')}</div>
              <div style={{ fontSize: 11.5, color: '#5b6b62' }}>{tr(r.updatedBy || '—')}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setViewId(r.id)} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>فتح</button>
                {editable && (
                  <button onClick={() => setFormId({ id: r.id })} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>تعديل</button>
                )}
              </div>
            </div>
          );
        })}
        {reports.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9aa39b', fontSize: 12.5 }}>لا توجد تقارير بعد</div>}
      </div>

      {viewRep && <RetView report={viewRep} onClose={() => setViewId(null)} />}
      {formId && <RetForm reportId={formId.id} onClose={() => setFormId(null)} />}
    </div>
  );
}
