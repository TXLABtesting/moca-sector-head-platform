import { useRef, useState } from 'react';
import { Modal, Badge } from '../../components/ui';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import { can } from '../../domain/permissions';
import { triggerDownload } from '../../shared/fileGen';
import { FinancialSummary } from './FinancialSummary';
import { financeYears, finForYear, defaultFinYear } from './financeYears';
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, kvLookup } from './templateIO';
import type { FinModel, FinBigProject, FinEntity, AgingBucket } from '../../data/types';
import { wfTone } from '../../domain/approval';

/* eslint-disable @typescript-eslint/no-explicit-any */

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
const secHead = (t: string, warn?: boolean) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px' }}>
    <span style={{ width: 5, height: 16, borderRadius: 4, background: '#1e4634' }} />
    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#17211c' }}>{t}</span>
    {warn && <span style={{ fontSize: 10, fontWeight: 800, color: '#a9791f', background: '#fbf2df', borderRadius: 20, padding: '2px 10px' }}>يحتاج مراجعة — لم يُتعرف عليه من الملف</span>}
  </div>
);
const fmt = (n: number) => (n || 0).toLocaleString('en-US');
const num = (v: string) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
/** Parse a related-party value, treating (123) as −123. */
const numRel = (v: string): number => {
  const t = String(v).trim();
  if (t === '' || t === '—') return 0;
  const neg = /^\(.*\)$/.test(t);
  const n = parseFloat(t.replace(/[()]/g, '').replace(/[^\d.-]/g, '')) || 0;
  return neg ? -Math.abs(n) : n;
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* related-party editor drafts (value kept as string while editing) */
type RelRowDraft = { n: string; v: string };
type RelSecDraft = { title: string; rows: RelRowDraft[] };
type RelDraft = { from: string; to: string; sections: RelSecDraft[] };
const relDraftFrom = (rp: FinModel['related'][number]): RelDraft => {
  if (rp.sections && rp.sections.length) {
    return { from: rp.from, to: rp.to, sections: rp.sections.map((s) => ({ title: s.title, rows: s.rows.map((x) => ({ n: x.n, v: x.v == null ? '' : String(x.v) })) })) };
  }
  // legacy party with only flat items: drop them into the current-year section
  return { from: rp.from, to: rp.to, sections: REL_SECTIONS.map((t, i) => ({ title: t, rows: i === REL_SECTIONS.length - 1 ? rp.items.map((x) => ({ n: x.n, v: String(x.v) })) : [] })) };
};

/** The three standard related-party breakdown sections. */
const REL_SECTIONS = ['تفاصيل جارى التسوية', 'عقود مرحلة من العام السابق', 'أرصدة خلال العام الحالي'];
/** Flatten a related party to template rows: [from, to, section, item, value]. */
function relTemplateRows(rp: FinModel['related'][number]): string[][] {
  const secs = rp.sections && rp.sections.length ? rp.sections : [{ title: '', rows: rp.items }];
  return secs.flatMap((sec) => (sec.rows.length ? sec.rows : [{ n: '', v: 0 }]).map((r) => [rp.from, rp.to, sec.title, r.n, String(r.v ?? '')]));
}

/* ---------------- template ---------------- */
function kvRows(fm: FinModel, f?: Record<string, string>): [string, string][] {
  const g = (k: string, v: number | string) => String(f?.[k] ?? v ?? '');
  return [
    ['الفترة', g('period', fm.period)],
    ['الميزانية الإجمالية (مليون درهم)', g('budget', fm.budget)],
    ['المستخدم (مليون درهم)', g('used', fm.used)],
    ['الالتزامات', g('commit', fm.commit)],
    ['المدفوع من الالتزامات', g('commitPaid', fm.commitPaid)],
    ['التشغيلية - المتوقع', g('opexE', fm.opex.expected)],
    ['التشغيلية - المدفوع', g('opexP', fm.opex.paid)],
    ['الرأسمالية - المتوقع', g('capexE', fm.capex.expected)],
    ['الرأسمالية - المدفوع', g('capexP', fm.capex.paid)],
    ['إجمالي الأرصدة بين الجهات', g('relAll', fm.relTotals.allPeriods)],
    ['إجمالي جارى التسوية', g('relSettling', fm.relTotals.settling)],
    ['عقود مرحلة من العام السابق', g('relPrior', fm.relTotals.prior)],
    ['أرصدة العام الحالي', g('relCurrent', fm.relTotals.current)],
    ['الفوائد البنكية اليومية على الحسابات', g('biDaily', fm.bankInterest.dailyAccounts)],
    ['الفوائد البنكية على الودائع الثابتة', g('biFixed', fm.bankInterest.fixedDeposits)],
    ['الودائع الثابتة الجارية خلال الربع', g('biActive', fm.bankInterest.activeDeposits)],
  ];
}
function buildFinDocx(fm: FinModel, projects: FinBigProject[], entities: FinEntity[]): Blob {
  const body =
    wP('الملخص التنفيذي المالي', { bold: true, size: 36 }) + wP('') +
    wTbl(['الحقل', 'القيمة'], kvRows(fm)) +
    wP('المشاريع الكبرى', { bold: true, size: 28 }) +
    wTbl(['المشروع', 'المخصص (مليون درهم)', 'المدفوع (مليون درهم)'], projects.length ? projects.map((p) => [p.name, String(p.alloc), String(p.paid)]) : [['اكتب هنا', '', '']]) +
    wP('الجهات', { bold: true, size: 28 }) +
    wTbl(['الجهة', 'المخصص', 'المستخدم', 'الالتزامات', 'المدفوع', 'المستحق'], entities.length ? entities.map((e) => [e.name, String(e.alloc), String(e.used), String(e.commit), String(e.paid), String(e.due)]) : [['اكتب هنا', '', '', '', '', '']]) +
    wP('الأطراف ذات العلاقة', { bold: true, size: 28 }) +
    wTbl(['من', 'إلى', 'القسم', 'البند', 'القيمة'], fm.related.length ? fm.related.flatMap(relTemplateRows) : [['اكتب هنا', '', 'تفاصيل جارى التسوية', '', '']]);
  return makeDocx(body);
}
function buildFinXlsx(fm: FinModel, projects: FinBigProject[], entities: FinEntity[]): Blob {
  const rows: string[][] = [['الحقل', 'القيمة'], ...kvRows(fm)];
  rows.push([''], ['المشروع', 'المخصص', 'المدفوع']);
  (projects.length ? projects : [{ name: '', alloc: 0, paid: 0 }]).forEach((p) => rows.push([p.name, String(p.alloc || ''), String(p.paid || '')]));
  rows.push([''], ['الجهة', 'المخصص', 'المستخدم', 'الالتزامات', 'المدفوع', 'المستحق']);
  (entities.length ? entities : []).forEach((e) => rows.push([e.name, String(e.alloc), String(e.used), String(e.commit), String(e.paid), String(e.due)]));
  rows.push([''], ['من', 'إلى', 'القسم', 'البند', 'القيمة']);
  (fm.related.length ? fm.related : []).forEach((rp) => relTemplateRows(rp).forEach((r) => rows.push(r)));
  return makeXlsx(rows, 'الملخص المالي');
}

/* ---------------- upload parsing ---------------- */
interface FinParsed {
  period?: string; budget?: number; used?: number; commit?: number; commitPaid?: number;
  opexE?: number; opexP?: number; capexE?: number; capexP?: number;
  relAll?: number; relSettling?: number; relPrior?: number; relCurrent?: number;
  biDaily?: number; biFixed?: number; biActive?: number;
  projects?: { name: string; alloc: number; paid: number }[];
  entities?: { name: string; alloc: number; used: number; commit: number; paid: number; due: number }[];
  related?: { from: string; to: string; sections: { title: string; rows: { n: string; v: number }[] }[] }[];
  missing: string[];
}
function sliceSection(tables: string[][][], head: (r: string[]) => boolean): string[][] {
  for (const t of tables) {
    const hi = t.findIndex(head);
    if (hi < 0) continue;
    const out: string[][] = [];
    for (let i = hi + 1; i < t.length; i++) {
      const r = t[i];
      const first = (r[0] || '').trim();
      if (!first && !(r[1] || '').trim()) break;
      if (/^(المشروع|الجهة|الحقل|من)$/.test(first)) break;
      if (first) out.push(r);
    }
    if (out.length) return out;
  }
  return [];
}
function parseFinFile(tables: string[][][]): FinParsed {
  const found: FinParsed = { missing: [] };
  const kvNum = (label: RegExp): number | undefined => {
    const v = kvLookup(tables, label);
    return v === undefined ? undefined : num(v);
  };
  found.period = kvLookup(tables, /^الفترة/);
  found.budget = kvNum(/^الميزانية/);
  found.used = kvNum(/^المستخدم/);
  found.commit = kvNum(/^الالتزامات/);
  found.commitPaid = kvNum(/^المدفوع من الالتزامات/);
  found.opexE = kvNum(/^التشغيلية - المتوقع/);
  found.opexP = kvNum(/^التشغيلية - المدفوع/);
  found.capexE = kvNum(/^الرأسمالية - المتوقع/);
  found.capexP = kvNum(/^الرأسمالية - المدفوع/);
  const projRows = sliceSection(tables, (r) => /المشروع/.test(r[0] || '') && /المخصص/.test(r.join(' ')));
  if (projRows.length) found.projects = projRows.map((r) => ({ name: (r[0] || '').trim(), alloc: num(r[1] || ''), paid: num(r[2] || '') })).filter((p) => p.name && p.name !== 'اكتب هنا');
  const entRows = sliceSection(tables, (r) => /^الجهة/.test((r[0] || '').trim()) && /المخصص/.test(r.join(' ')));
  if (entRows.length) found.entities = entRows.map((r) => ({ name: (r[0] || '').trim(), alloc: num(r[1] || ''), used: num(r[2] || ''), commit: num(r[3] || ''), paid: num(r[4] || ''), due: num(r[5] || '') })).filter((e) => e.name && e.name !== 'اكتب هنا');
  found.relAll = kvNum(/^إجمالي الأرصدة بين الجهات/);
  found.relSettling = kvNum(/^إجمالي جار[ىي] التسوية/);
  found.relPrior = kvNum(/^عقود مرحلة من العام السابق/);
  found.relCurrent = kvNum(/^أرصدة العام الحالي/);
  found.biDaily = kvNum(/^الفوائد البنكية اليومية على الحسابات/);
  found.biFixed = kvNum(/^الفوائد البنكية على الودائع الثابتة/);
  found.biActive = kvNum(/^الودائع الثابتة الجارية خلال الربع/);
  const relRows = sliceSection(tables, (r) => /^من$/.test((r[0] || '').trim()) && /القيمة/.test(r.join(' ')));
  if (relRows.length) {
    // detect layout: 5-col [من, إلى, القسم, البند, القيمة] vs legacy 4-col [من, إلى, البند, القيمة]
    const withSection = relRows.some((r) => r.length >= 5 && String(r[4] ?? '').trim() !== '');
    const map = new Map<string, { from: string; to: string; secMap: Map<string, { n: string; v: number }[]> }>();
    relRows.forEach((r) => {
      const from = (r[0] || '').trim(); const to = (r[1] || '').trim();
      const secTitle = withSection ? (r[2] || '').trim() : '';
      const n = (withSection ? (r[3] || '') : (r[2] || '')).trim();
      const v = num((withSection ? r[4] : r[3]) || '');
      if (!from || !to || !n || from === 'اكتب هنا') return;
      const key = from + '|' + to;
      if (!map.has(key)) map.set(key, { from, to, secMap: new Map() });
      const secMap = map.get(key)!.secMap;
      if (!secMap.has(secTitle)) secMap.set(secTitle, []);
      secMap.get(secTitle)!.push({ n, v });
    });
    if (map.size) found.related = [...map.values()].map((p) => ({ from: p.from, to: p.to, sections: [...p.secMap.entries()].map(([title, rows]) => ({ title, rows })) }));
  }
  const KEYS: { k: keyof FinParsed; ar: string }[] = [
    { k: 'period', ar: 'الفترة' }, { k: 'budget', ar: 'الميزانية الإجمالية' }, { k: 'used', ar: 'المستخدم' },
    { k: 'commit', ar: 'الالتزامات' }, { k: 'commitPaid', ar: 'المدفوع من الالتزامات' },
    { k: 'opexE', ar: 'التشغيلية' }, { k: 'capexE', ar: 'الرأسمالية' },
    { k: 'projects', ar: 'المشاريع الكبرى' }, { k: 'entities', ar: 'الجهات' },
  ];
  found.missing = KEYS.filter((x) => found[x.k] === undefined).map((x) => x.ar);
  return found;
}

const blankFin = (year: string): FinModel => ({
  id: 'fin' + Math.floor(Math.random() * 1e9), year, period: 'حتى نهاية ' + year,
  budget: 0, used: 0, remain: 0, commit: 0, commitPaid: 0, commitDue: 0,
  opex: { expected: 0, paid: 0 }, capex: { expected: 0, paid: 0 },
  bigProjects: [], entities: [], related: [], relTotals: { allPeriods: 0, settling: 0, prior: 0, current: 0 },
  bankInterest: { dailyAccounts: 0, fixedDeposits: 0, activeDeposits: 0 }, aging: [],
});

/* ---------------- the edit / create form ---------------- */
function FinForm({ year, create, onClose }: { year: string; create: boolean; onClose: () => void }) {
  const cu = useCurrentUser();
  const finModels = useStore((s) => s.data.finModels);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = finForYear(finModels, year);
  const latest = [...finModels].sort((a, b) => b.year.localeCompare(a.year))[0];
  // source of initial values: the year's own summary when editing, else the most recent one to clone.
  const source: FinModel = existing || latest || blankFin(year);

  const [f, setF] = useState<Record<string, string>>({
    period: create ? 'حتى نهاية ' + year : source.period,
    budget: String(source.budget), used: String(source.used),
    commit: String(source.commit), commitPaid: String(source.commitPaid),
    opexE: String(source.opex.expected), opexP: String(source.opex.paid),
    capexE: String(source.capex.expected), capexP: String(source.capex.paid),
    relAll: String(source.relTotals.allPeriods), relSettling: String(source.relTotals.settling),
    relPrior: String(source.relTotals.prior), relCurrent: String(source.relTotals.current),
    biDaily: String(source.bankInterest.dailyAccounts), biFixed: String(source.bankInterest.fixedDeposits),
    biActive: String(source.bankInterest.activeDeposits),
  });
  const [rel, setRel] = useState<RelDraft[]>(() => source.related.map(relDraftFrom));
  const [projects, setProjects] = useState<FinBigProject[]>(() => source.bigProjects.map((p) => ({ ...p })));
  const [ents, setEnts] = useState<{ name: string; alloc: number; used: number; commit: number; paid: number; due: number }[]>(
    () => source.entities.map((e) => ({ name: e.name, alloc: e.alloc, used: e.used, commit: e.commit, paid: e.paid, due: e.due })));
  const [aging, setAging] = useState<AgingBucket[]>(() => clone(source.aging || []));
  const [missing, setMissing] = useState<string[]>([]);
  const [parsedFrom, setParsedFrom] = useState('');
  const [tab, setTab] = useState(0);
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const remain = num(f.budget) - num(f.used);
  const commitDue = num(f.commit) - num(f.commitPaid);

  const onUpload = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      if (!blocks) { showToast('تعذّرت قراءة الملف تلقائياً'); return; }
      const p = parseFinFile(blocks.tables);
      setF((prev) => ({
        ...prev,
        period: p.period ?? prev.period,
        budget: p.budget !== undefined ? String(p.budget) : prev.budget,
        used: p.used !== undefined ? String(p.used) : prev.used,
        commit: p.commit !== undefined ? String(p.commit) : prev.commit,
        commitPaid: p.commitPaid !== undefined ? String(p.commitPaid) : prev.commitPaid,
        opexE: p.opexE !== undefined ? String(p.opexE) : prev.opexE,
        opexP: p.opexP !== undefined ? String(p.opexP) : prev.opexP,
        capexE: p.capexE !== undefined ? String(p.capexE) : prev.capexE,
        capexP: p.capexP !== undefined ? String(p.capexP) : prev.capexP,
        relAll: p.relAll !== undefined ? String(p.relAll) : prev.relAll,
        relSettling: p.relSettling !== undefined ? String(p.relSettling) : prev.relSettling,
        relPrior: p.relPrior !== undefined ? String(p.relPrior) : prev.relPrior,
        relCurrent: p.relCurrent !== undefined ? String(p.relCurrent) : prev.relCurrent,
        biDaily: p.biDaily !== undefined ? String(p.biDaily) : prev.biDaily,
        biFixed: p.biFixed !== undefined ? String(p.biFixed) : prev.biFixed,
        biActive: p.biActive !== undefined ? String(p.biActive) : prev.biActive,
      }));
      if (p.projects) setProjects(p.projects);
      if (p.entities) setEnts(p.entities);
      if (p.related) setRel(p.related.map((rp) => ({ from: rp.from, to: rp.to, sections: rp.sections.map((s) => ({ title: s.title, rows: s.rows.map((x) => ({ n: x.n, v: String(x.v) })) })) })));
      setMissing(p.missing);
      setParsedFrom(file.name);
      showToast('قُرئ الملف وعُبئت الحقول — راجع البيانات قبل الحفظ');
    } catch {
      showToast('تعذّرت قراءة الملف تلقائياً');
    }
  };

  const save = (send: boolean) => {
    if (!(f.period || '').trim()) { showToast('يرجى إدخال الفترة'); return; }
    mutate((d) => {
      let m = d.finModels.find((x) => x.year === year) as (FinModel & { _mstatus?: string; _mrev?: boolean; _mret?: string; _mowner?: string; _mlog?: unknown[] }) | undefined;
      if (!m) {
        // create: clone the source (entities' nested breakdown, related parties, aging) then override.
        const base = clone(existing || latest || blankFin(year)) as FinModel & { _mstatus?: string; _mrev?: boolean; _mret?: string; _mowner?: string; _mlog?: unknown[] };
        m = { ...base, id: 'fin' + Math.floor(Math.random() * 1e9), year };
        m._mstatus = undefined; m._mrev = false; m._mret = ''; m._mowner = cu.id; m._mlog = [];
        d.finModels.unshift(m);
      }
      m.period = f.period.trim();
      m.budget = num(f.budget); m.used = num(f.used); m.remain = num(f.budget) - num(f.used);
      m.commit = num(f.commit); m.commitPaid = num(f.commitPaid); m.commitDue = num(f.commit) - num(f.commitPaid);
      m.opex = { ...m.opex, expected: num(f.opexE), paid: num(f.opexP), due: num(f.opexE) - num(f.opexP) };
      m.capex = { ...m.capex, expected: num(f.capexE), paid: num(f.capexP), due: num(f.capexE) - num(f.capexP) };
      m.bigProjects = projects.filter((p) => p.name.trim()).map((p) => ({ ...p, alloc: +p.alloc || 0, paid: +p.paid || 0 }));
      m.entities = ents.filter((e) => e.name.trim()).map((e) => {
        const old = source.entities.find((x) => x.name === e.name) || m!.entities.find((x) => x.name === e.name);
        return old
          ? { ...old, alloc: e.alloc, used: e.used, commit: e.commit, paid: e.paid, due: e.due }
          : { code: e.name.slice(0, 4), name: e.name, alloc: e.alloc, used: e.used, commit: e.commit, paid: e.paid, due: e.due, opex: { expected: 0, paid: 0 }, capex: { expected: 0, paid: 0 }, projects: [], overdue: 0 };
      });
      m.aging = aging.map((b) => ({ bucket: b.bucket, risk: b.risk, items: b.items.filter((it) => it.supplier.trim() || it.amount) }));
      m.relTotals = { allPeriods: num(f.relAll), settling: num(f.relSettling), prior: num(f.relPrior), current: num(f.relCurrent) };
      m.bankInterest = { dailyAccounts: num(f.biDaily), fixedDeposits: num(f.biFixed), activeDeposits: num(f.biActive) };
      m.related = rel
        .filter((rp) => rp.from.trim() && rp.to.trim())
        .map((rp) => {
          const sections = rp.sections
            .map((s) => ({ title: s.title.trim(), rows: s.rows.filter((r) => r.n.trim()).map((r) => ({ n: r.n.trim(), v: numRel(r.v) })) }))
            .filter((s) => s.rows.length);
          const items = sections.map((s) => ({ n: s.title || 'بنود', v: s.rows.reduce((a, x) => a + (x.v || 0), 0) }));
          return { from: rp.from.trim(), to: rp.to.trim(), items, sections };
        })
        .filter((rp) => rp.sections.length);
      m.lastUpdate = 'الآن'; m.updatedBy = cu.name;
      if (send) { m._mstatus = 'بانتظار اعتماد رئيس القطاع'; m._mrev = true; m._mret = ''; m._mowner = m._mowner || cu.id; }
      else if (!m._mrev && m._mstatus !== 'معتمد') m._mstatus = 'مسودة';
      (m._mlog = m._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار اعتماد رئيس القطاع' : (create ? 'إنشاء ملخص مالي لسنة ' + year : 'تحديث بيانات الملخص المالي'), sent: !!send, by: cu.name });
    });
    showToast(send ? 'أُرسل الملخص المالي لرئيس القطاع للمراجعة' : (create ? 'أُنشئ ملخص مالي لسنة ' + year : 'حُفظت بيانات الملخص المالي'));
    onClose();
  };

  const needs = (ar: string) => parsedFrom !== '' && missing.includes(ar);
  const warnStyle = (ar: string) => (needs(ar) ? { borderColor: '#e9c877', background: '#fdf9ee' } : {});
  const rowBtn: React.CSSProperties = { flex: 'none', width: 26, height: 26, border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 13 };
  const addRowBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginTop: 8 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{label}
    </button>
  );
  const th: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#7d867f', textAlign: 'start', padding: '4px 2px' };
  const setAgeItem = (bi: number, ii: number, k: keyof AgingBucket['items'][number], v: string) =>
    setAging((prev) => prev.map((b, i) => i !== bi ? b : { ...b, items: b.items.map((it, j) => j !== ii ? it : { ...it, [k]: k === 'amount' ? num(v) : v }) }));
  // related-party editor: mutate a party, a section, or a row within a section
  const updRel = (ri: number, fn: (rp: RelDraft) => RelDraft) => setRel((prev) => prev.map((x, i) => (i === ri ? fn(x) : x)));
  const setRelSecRow = (ri: number, si: number, rowi: number, k: 'n' | 'v', v: string) =>
    updRel(ri, (rp) => ({ ...rp, sections: rp.sections.map((s, j) => (j !== si ? s : { ...s, rows: s.rows.map((r, m2) => (m2 !== rowi ? r : { ...r, [k]: v })) })) }));
  const secSum = (rows: RelRowDraft[]) => rows.reduce((a, r) => a + numRel(r.v), 0);
  const relColor = { bar: '#7a4d94', tint: '#f5eef7', line: '#efe6f2' };
  const secBar: Record<string, string> = { 'تفاصيل جارى التسوية': '#c26a2b', 'عقود مرحلة من العام السابق': '#a9791f', 'أرصدة خلال العام الحالي': '#2b5c44' };

  return (
    <Modal open onClose={onClose} width={840}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{create ? 'إنشاء ملخص مالي جديد — سنة ' + year : 'تعديل بيانات الملخص التنفيذي المالي — ' + year}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>{create ? 'يبدأ بنسخة من آخر سنة — عدّل الأرقام ثم احفظ.' : 'تُحفظ في نفس السجل الذي يراه رئيس القطاع في مركز التقارير.'}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
        <button type="button" onClick={() => triggerDownload(buildFinDocx({ ...source, period: f.period }, projects, ents as never), 'Financial_Summary_Template.docx')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
          تحميل قالب Word
        </button>
        <button type="button" onClick={() => triggerDownload(buildFinXlsx({ ...source, period: f.period }, projects, ents as never), 'Financial_Summary_Template.xlsx')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
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

      {(() => {
        const tabNames = ['البيانات الرئيسية', 'الجهات والمشاريع', 'الأطراف ذات العلاقة', 'الفوائد والذمم'];
        const tabWarn = [
          ['الفترة', 'الميزانية الإجمالية', 'المستخدم', 'الالتزامات', 'المدفوع من الالتزامات', 'التشغيلية', 'الرأسمالية'],
          ['المشاريع الكبرى', 'الجهات'], [], [],
        ].map((ls) => ls.some((l) => needs(l)));
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '16px 0 10px', borderBottom: '1px solid #eef1ec' }}>
            {tabNames.map((tn, ti) => (
              <button key={ti} type="button" onClick={() => setTab(ti)} style={{ position: 'relative', background: 'transparent', border: 'none', borderBottom: tab === ti ? '2.5px solid #1e4634' : '2.5px solid transparent', color: tab === ti ? '#1e4634' : '#7d867f', fontWeight: tab === ti ? 800 : 600, fontSize: 12.5, fontFamily: 'inherit', padding: '9px 15px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {tn}
                {tabWarn[ti] && <span style={{ position: 'absolute', top: 7, insetInlineEnd: 5, width: 7, height: 7, borderRadius: '50%', background: '#e9c877' }} />}
              </button>
            ))}
          </div>
        );
      })()}

      {tab === 0 && (<>
      {secHead('البيانات الرئيسية')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>الفترة</Label><input value={f.period} onChange={setI('period')} style={{ ...inputStyle, ...warnStyle('الفترة') }} /></div>
        <div><Label>الميزانية الإجمالية (مليون درهم)</Label><input value={f.budget} onChange={setI('budget')} style={{ ...inputStyle, ...warnStyle('الميزانية الإجمالية') }} /></div>
        <div><Label>المستخدم (مليون درهم)</Label><input value={f.used} onChange={setI('used')} style={{ ...inputStyle, ...warnStyle('المستخدم') }} /></div>
        <div><Label>المتبقي (يُحسب تلقائياً)</Label><div style={{ ...inputStyle, background: '#f2f4f0', color: '#1e4634', fontWeight: 700 }}>{fmt(remain)}</div></div>
        <div><Label>الالتزامات (مليون درهم)</Label><input value={f.commit} onChange={setI('commit')} style={{ ...inputStyle, ...warnStyle('الالتزامات') }} /></div>
        <div><Label>المدفوع من الالتزامات</Label><input value={f.commitPaid} onChange={setI('commitPaid')} style={{ ...inputStyle, ...warnStyle('المدفوع من الالتزامات') }} /></div>
        <div><Label>المستحق (يُحسب تلقائياً)</Label><div style={{ ...inputStyle, background: '#f2f4f0', color: '#1e4634', fontWeight: 700 }}>{fmt(commitDue)}</div></div>
      </div>

      {secHead('التدفقات التشغيلية والرأسمالية', needs('التشغيلية') || needs('الرأسمالية'))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <div><Label>التشغيلية — المتوقع</Label><input value={f.opexE} onChange={setI('opexE')} style={inputStyle} /></div>
        <div><Label>التشغيلية — المدفوع</Label><input value={f.opexP} onChange={setI('opexP')} style={inputStyle} /></div>
        <div><Label>الرأسمالية — المتوقع</Label><input value={f.capexE} onChange={setI('capexE')} style={inputStyle} /></div>
        <div><Label>الرأسمالية — المدفوع</Label><input value={f.capexP} onChange={setI('capexP')} style={inputStyle} /></div>
      </div>
      </>)}

      {tab === 1 && (<>
      {secHead('المشاريع الكبرى', needs('المشاريع الكبرى'))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 150px 150px 26px', gap: 8 }}>
          <span style={th}>المشروع</span><span style={th}>المخصص (مليون درهم)</span><span style={th}>المدفوع (مليون درهم)</span><span />
        </div>
        {projects.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.8fr 150px 150px 26px', gap: 8, alignItems: 'center' }}>
            <input value={p.name} onChange={(e) => setProjects((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={inputStyle} />
            <input value={String(p.alloc || '')} onChange={(e) => setProjects((prev) => prev.map((x, j) => (j === i ? { ...x, alloc: num(e.target.value) } : x)))} style={inputStyle} />
            <input value={String(p.paid || '')} onChange={(e) => setProjects((prev) => prev.map((x, j) => (j === i ? { ...x, paid: num(e.target.value) } : x)))} style={inputStyle} />
            <button type="button" onClick={() => setProjects((prev) => prev.filter((_, j) => j !== i))} style={rowBtn}>✕</button>
          </div>
        ))}
        {addRowBtn('إضافة مشروع', () => setProjects((prev) => [...prev, { name: '', alloc: 0, paid: 0 }]))}
      </div>

      {secHead('الجهات', needs('الجهات'))}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 110px 110px 110px 110px 110px 26px', gap: 7 }}>
            <span style={th}>الجهة</span><span style={th}>المخصص</span><span style={th}>المستخدم</span><span style={th}>الالتزامات</span><span style={th}>المدفوع</span><span style={th}>المستحق</span><span />
          </div>
          {ents.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 110px 110px 110px 110px 110px 26px', gap: 7, alignItems: 'center' }}>
              <input value={e.name} onChange={(ev) => setEnts((prev) => prev.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} style={inputStyle} />
              {(['alloc', 'used', 'commit', 'paid', 'due'] as const).map((k) => (
                <input key={k} value={String(e[k] || '')} onChange={(ev) => setEnts((prev) => prev.map((x, j) => (j === i ? { ...x, [k]: num(ev.target.value) } : x)))} style={inputStyle} />
              ))}
              <button type="button" onClick={() => setEnts((prev) => prev.filter((_, j) => j !== i))} style={rowBtn}>✕</button>
            </div>
          ))}
          {addRowBtn('إضافة جهة', () => setEnts((prev) => [...prev, { name: '', alloc: 0, used: 0, commit: 0, paid: 0, due: 0 }]))}
        </div>
      </div>
      </>)}

      {tab === 2 && (<>
      {secHead('إجماليات الأرصدة بين الجهات')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>إجمالي الأرصدة بين الجهات</Label><input value={f.relAll} onChange={setI('relAll')} style={inputStyle} /></div>
        <div><Label>إجمالي جارى التسوية</Label><input value={f.relSettling} onChange={setI('relSettling')} style={inputStyle} /></div>
        <div><Label>عقود مرحلة من العام السابق</Label><input value={f.relPrior} onChange={setI('relPrior')} style={inputStyle} /></div>
        <div><Label>أرصدة العام الحالي</Label><input value={f.relCurrent} onChange={setI('relCurrent')} style={inputStyle} /></div>
      </div>

      {secHead('تفاصيل الأطراف ذات العلاقة')}
      <div style={{ fontSize: 11.5, color: '#7d867f', margin: '-2px 0 10px', lineHeight: 1.6 }}>
        لكل طرف، سجّل بنوده موزّعة على الأقسام. القيم بالدرهم — استخدم إشارة سالبة أو أقواس <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>(123)</span> للقيم السالبة. تُحسب الإجماليات الفرعية تلقائياً.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rel.map((rp, ri) => {
          const grand = rp.sections.reduce((a, s) => a + secSum(s.rows), 0);
          return (
          <div key={ri} style={{ border: `1px solid ${relColor.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: relColor.tint, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', flexWrap: 'wrap' }}>
              <input value={rp.from} onChange={(e) => updRel(ri, (x) => ({ ...x, from: e.target.value }))} placeholder="من" style={{ ...inputStyle, width: 140, padding: '7px 10px', fontWeight: 700 }} />
              <span style={{ color: relColor.bar, fontWeight: 800 }}>←</span>
              <input value={rp.to} onChange={(e) => updRel(ri, (x) => ({ ...x, to: e.target.value }))} placeholder="إلى" style={{ ...inputStyle, width: 140, padding: '7px 10px', fontWeight: 700 }} />
              <span style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: grand < 0 ? '#b0433b' : '#1f4a37', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace" }}>{fmt(grand)}</span>
                <button type="button" onClick={() => setRel((prev) => prev.filter((_, j) => j !== ri))} style={{ ...rowBtn, width: 'auto', color: '#8a4b6b' }}>حذف الطرف ✕</button>
              </span>
            </div>
            <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {rp.sections.map((sec, si) => (
                <div key={si} style={{ border: '1px solid #f0e6dd', borderRadius: 11, overflow: 'hidden' }}>
                  <div style={{ background: secBar[sec.title] || '#8a8f88', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px' }}>
                    <input value={sec.title} onChange={(e) => updRel(ri, (x) => ({ ...x, sections: x.sections.map((s, j) => j === si ? { ...s, title: e.target.value } : s) }))} placeholder="عنوان القسم" style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", whiteSpace: 'nowrap' }}>{fmt(secSum(sec.rows))}</span>
                    <button type="button" onClick={() => updRel(ri, (x) => ({ ...x, sections: x.sections.filter((_, j) => j !== si) }))} style={{ ...rowBtn, color: '#fff' }}>✕</button>
                  </div>
                  <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sec.rows.map((r, rowi) => (
                      <div key={rowi} style={{ display: 'grid', gridTemplateColumns: '2fr 150px 26px', gap: 8, alignItems: 'center' }}>
                        <input value={r.n} onChange={(e) => setRelSecRow(ri, si, rowi, 'n', e.target.value)} placeholder="اسم البند" style={{ ...inputStyle, direction: 'ltr', textAlign: 'start' }} />
                        <input value={r.v} onChange={(e) => setRelSecRow(ri, si, rowi, 'v', e.target.value)} placeholder="القيمة" style={{ ...inputStyle, textAlign: 'center' }} />
                        <button type="button" onClick={() => updRel(ri, (x) => ({ ...x, sections: x.sections.map((s, j) => j === si ? { ...s, rows: s.rows.filter((_, k) => k !== rowi) } : s) }))} style={rowBtn}>✕</button>
                      </div>
                    ))}
                    {addRowBtn('إضافة بند', () => updRel(ri, (x) => ({ ...x, sections: x.sections.map((s, j) => j === si ? { ...s, rows: [...s.rows, { n: '', v: '' }] } : s) })))}
                  </div>
                </div>
              ))}
              {addRowBtn('إضافة قسم', () => updRel(ri, (x) => ({ ...x, sections: [...x.sections, { title: 'قسم جديد', rows: [] }] })))}
            </div>
          </div>
          );
        })}
        {addRowBtn('إضافة طرف ذي علاقة', () => setRel((prev) => [...prev, { from: '', to: '', sections: REL_SECTIONS.map((t) => ({ title: t, rows: [] })) }]))}
      </div>
      </>)}

      {tab === 3 && (<>
      {secHead('الفوائد البنكية')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><Label>الفوائد البنكية اليومية على الحسابات</Label><input value={f.biDaily} onChange={setI('biDaily')} style={inputStyle} /></div>
        <div><Label>الفوائد البنكية على الودائع الثابتة</Label><input value={f.biFixed} onChange={setI('biFixed')} style={inputStyle} /></div>
        <div><Label>الودائع الثابتة الجارية خلال الربع</Label><input value={f.biActive} onChange={setI('biActive')} style={inputStyle} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: '#7d867f', marginBottom: 18, lineHeight: 1.6 }}>
        بطاقات «إبراز المخاطر المالية» تُحتسب تلقائياً من بيانات الجهات وأعمار الذمم والأطراف ذات العلاقة أعلاه — لا تحتاج إدخالاً منفصلاً.
      </div>

      {secHead('أعمار الذمم الدائنة')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {aging.length === 0 && <div style={{ fontSize: 12, color: '#9aa39b', background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 10, padding: '10px 13px' }}>لا توجد فئات أعمار — أضف فئة لتسجيل الذمم المتأخرة.</div>}
        {aging.map((b, bi) => (
          <div key={bi} style={{ border: '1px solid #f0e6dd', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#faf3ec', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#8a4b1e' }}>فئة {b.bucket} يوم</span>
              <input value={b.risk} onChange={(e) => setAging((prev) => prev.map((x, j) => (j === bi ? { ...x, risk: e.target.value } : x)))} placeholder="مستوى الخطورة" style={{ ...inputStyle, width: 140, padding: '6px 10px' }} />
              <button type="button" onClick={() => setAging((prev) => prev.filter((_, j) => j !== bi))} style={{ ...rowBtn, marginInlineStart: 'auto' }}>حذف الفئة ✕</button>
            </div>
            <div style={{ padding: '10px 12px', overflowX: 'auto' }}>
              <div style={{ minWidth: 760, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 1fr 120px 1fr 1fr 26px', gap: 7 }}>
                  <span style={th}>المورّد</span><span style={th}>الجهة</span><span style={th}>العقد</span><span style={th}>المبلغ</span><span style={th}>الحالة</span><span style={th}>ملاحظات</span><span />
                </div>
                {b.items.map((it, ii) => (
                  <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 1fr 120px 1fr 1fr 26px', gap: 7, alignItems: 'center' }}>
                    <input value={it.supplier} onChange={(e) => setAgeItem(bi, ii, 'supplier', e.target.value)} style={inputStyle} />
                    <input value={it.entity} onChange={(e) => setAgeItem(bi, ii, 'entity', e.target.value)} style={inputStyle} />
                    <input value={it.contract} onChange={(e) => setAgeItem(bi, ii, 'contract', e.target.value)} style={inputStyle} />
                    <input value={String(it.amount || '')} onChange={(e) => setAgeItem(bi, ii, 'amount', e.target.value)} style={inputStyle} />
                    <input value={it.status} onChange={(e) => setAgeItem(bi, ii, 'status', e.target.value)} style={inputStyle} />
                    <input value={it.notes} onChange={(e) => setAgeItem(bi, ii, 'notes', e.target.value)} style={inputStyle} />
                    <button type="button" onClick={() => setAging((prev) => prev.map((x, j) => j !== bi ? x : { ...x, items: x.items.filter((_, k) => k !== ii) }))} style={rowBtn}>✕</button>
                  </div>
                ))}
                {addRowBtn('إضافة بند', () => setAging((prev) => prev.map((x, j) => j !== bi ? x : { ...x, items: [...x.items, { supplier: '', num: '', entity: '', contract: '', amount: 0, status: '', notes: '' }] })))}
              </div>
            </div>
          </div>
        ))}
        {addRowBtn('إضافة فئة أعمار', () => setAging((prev) => [...prev, { bucket: ['0-30', '31-60', '61-90', '91-180', '181+'][prev.length] || 'جديد', risk: 'منخفض', items: [] }]))}
      </div>
      </>)}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid #eef1ec', paddingTop: 16 }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>حفظ</button>
      </div>
    </Modal>
  );
}

/* ---------------- member workspace: action header + the shared summary view ---------------- */
export function FinanceWorkspace() {
  const { tr, dl } = useI18n();
  const cu = useCurrentUser();
  const finModels = useStore((s) => s.data.finModels);
  const manage = cu.type !== 'chair' && (can(cu, 'finReports', 'add') || can(cu, 'finReports', 'edit'));
  const years = financeYears(finModels);
  const [year, setYear] = useState(defaultFinYear(finModels));
  const [form, setForm] = useState<{ year: string; create: boolean } | null>(null);

  const fm = finForYear(finModels, year);
  const meta = (fm || {}) as FinModel & { _mstatus?: string; _mret?: string };
  const wf = meta._mret ? 'أعيد للتعديل' : (meta._mstatus || 'محدّث');
  const [wb, wfg] = wfTone(wf);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#17211c' }}>الملخص التنفيذي المالي</h1>
            {fm && <Badge bg={wb} fg={wfg} style={{ fontSize: 10.5, padding: '4px 12px' }}>{tr(wf)}</Badge>}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#7d867f' }}>
            سجل مشترك واحد لكل سنة يظهر لرئيس القطاع فوراً{fm?.lastUpdate ? ' · آخر تحديث: ' + dl(fm.lastUpdate) + (fm.updatedBy ? ' بواسطة ' + tr(fm.updatedBy) : '') : ''}
          </p>
        </div>
        {manage && (
          <div className="page-head-action" style={{ flex: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {fm
              ? <button onClick={() => setForm({ year, create: false })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  تعديل بيانات الملخص
                </button>
              : <button onClick={() => setForm({ year, create: true })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  إنشاء ملخص لسنة {year}
                </button>}
          </div>
        )}
      </div>
      {!!(fm && meta._mret && meta._mret.trim()) && (
        <div style={{ background: '#fdf3f2', border: '1.5px solid #e7b8b3', borderRadius: 11, padding: '11px 13px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#b0433b', fontWeight: 800, marginBottom: 3 }}>أُعيد للتعديل من رئيس القطاع — سبب الإرجاع</div>
          <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{meta._mret}</div>
        </div>
      )}
      <FinancialSummary year={year} onYearChange={setYear} />
      {form && <FinForm year={form.year} create={form.create} onClose={() => setForm(null)} />}
    </div>
  );
}
