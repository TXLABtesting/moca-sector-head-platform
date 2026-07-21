import { useRef, useState, type CSSProperties } from 'react';
import { Fade, Modal } from '../components/ui';
import { WorkflowBanner } from '../components/WorkflowBanner';
import { MobileFilters } from '../components/MobileFilters';
import { Dropdown } from '../components/Dropdown';
import { DateField } from '../components/DateField';
import { FileUploadField } from '../components/FileUploadField';
import { AttachmentDownload } from '../components/AttachmentDownload';
import { useToast } from '../components/Toast';
import { triggerDownload } from '../shared/fileGen';
import { wP, wTbl, makeDocx, makeXlsx, fileToBlocks, kvLookup, excelSerialToDate } from './reportcenter/templateIO';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useI18n } from '../i18n/i18n';
import { CS, PR } from '../shared/constants';
import { parseAr, arPlural } from '../shared/helpers';
import type { Correspondence as Corr } from '../data/types';

const CORR_STATUSES = ['قيد المتابعة', 'بانتظار رد', 'بانتظار اعتماد', 'تم الإرسال', 'تم الاستلام', 'مكتمل', 'مغلق'];
const DOC_TYPES = ['رسالة', 'قرار', 'قرار وزاري', 'مذكرة داخلية', 'تعميم'];
const PRIORITIES = ['عالية', 'متوسطة', 'منخفضة'];

/** [bg,fg] for the direction pill. */
function dirColors(dir: string): [string, string] {
  return dir === 'صادر' ? ['#e6eef6', '#3a6ea5'] : ['#fbf0d6', '#a9791f'];
}

const GRID = '0.8fr 2.2fr 1.4fr 0.9fr 1.1fr 1.1fr 1fr';

interface FormState {
  id?: string;
  name: string; entity: string; dir: string; type: string; date: string;
  sender: string; recipient: string; followup: string; status: string;
  priority: string; action: string; notes: string;
  [k: string]: unknown;
}

const emptyForm = (): FormState => ({
  name: '', entity: '', dir: 'صادر', type: 'رسالة', date: '', sender: '', recipient: '',
  followup: 'موزة المرزوقي', status: 'قيد المتابعة', priority: 'متوسطة', action: '', notes: '',
});

/* ---- template columns (order used by both Word key-value and Excel row headers) ---- */
const CORR_COLS: { key: keyof FormState; ar: string; norm?: (v: string) => string }[] = [
  { key: 'name', ar: 'اسم المستند' },
  { key: 'entity', ar: 'الجهة المعنية' },
  { key: 'dir', ar: 'التصنيف', norm: (v) => (v.includes('وارد') ? 'وارد' : 'صادر') },
  { key: 'type', ar: 'نوع المستند', norm: (v) => DOC_TYPES.find((x) => v.includes(x)) || 'رسالة' },
  { key: 'date', ar: 'التاريخ', norm: (v) => excelSerialToDate(v.trim()) },
  { key: 'sender', ar: 'المرسل' },
  { key: 'recipient', ar: 'المستلم' },
  { key: 'followup', ar: 'المسؤول عن المتابعة' },
  { key: 'status', ar: 'الوضع الحالي', norm: (v) => CORR_STATUSES.find((x) => v.includes(x)) || 'قيد المتابعة' },
  { key: 'priority', ar: 'الأولوية', norm: (v) => PRIORITIES.find((x) => v.includes(x)) || 'متوسطة' },
  { key: 'action', ar: 'الإجراء' },
  { key: 'notes', ar: 'ملاحظات' },
];

const buildCorrDocx = () => makeDocx(
  wP('قالب إضافة مستند — الصادر والوارد', { bold: true, size: 36 }) + wP('') +
  wTbl(['الحقل', 'القيمة'], CORR_COLS.map((c) => [c.ar, c.key === 'dir' ? 'صادر' : (c.key === 'type' ? 'رسالة' : 'اكتب هنا')]))
);
/** Excel template: header row + a few blank rows — each ROW is one document (bulk import). */
const buildCorrXlsx = () => makeXlsx([CORR_COLS.map((c) => c.ar), ...Array.from({ length: 3 }, () => CORR_COLS.map(() => ''))], 'مستندات');

/** Parse an uploaded template into one or more documents.
 *  - Excel/CSV with a header row → each following row is a document (bulk).
 *  - Word key-value table → a single document. */
function parseCorrFile(tables: string[][][]): Partial<FormState>[] {
  const norm = (key: keyof FormState, raw: string): string => {
    const c = CORR_COLS.find((x) => x.key === key);
    const v = (raw || '').trim();
    return c?.norm ? c.norm(v) : v;
  };
  // multi-column table (row-per-document)
  for (const t of tables) {
    const hi = t.findIndex((r) => r.filter((c) => CORR_COLS.some((col) => (c || '').includes(col.ar))).length >= 3);
    if (hi < 0) continue;
    const header = t[hi].map((c) => (c || '').trim());
    const colOf = (col: { ar: string }) => header.findIndex((h) => h.includes(col.ar) || col.ar.includes(h));
    const map = CORR_COLS.map((col) => ({ col, ci: colOf(col) }));
    const docs: Partial<FormState>[] = [];
    for (let i = hi + 1; i < t.length; i++) {
      const row = t[i];
      if (!row.some((c) => (c || '').trim())) continue;
      const d: Partial<FormState> = {};
      map.forEach(({ col, ci }) => { if (ci >= 0 && (row[ci] || '').trim()) (d as Record<string, string>)[col.key as string] = norm(col.key, row[ci]); });
      if (d.name || d.entity || d.sender) docs.push(d);
    }
    if (docs.length) return docs;
  }
  // key-value fallback (single document)
  const d: Partial<FormState> = {};
  CORR_COLS.forEach((col) => { const v = kvLookup(tables, new RegExp('^' + col.ar)); if (v) (d as Record<string, string>)[col.key as string] = norm(col.key, v); });
  return (d.name || d.entity || d.sender) ? [d] : [];
}

export function Correspondence() {
  const { page, params, goto } = useNav();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const { t, tr, dl } = useI18n();
  const { showToast } = useToast();

  const corr = data.correspondence;
  const members = data.members;

  // Chair is VIEW+NOTE only on documents here (no add/edit).
  const canAdd = can(cu, 'correspondence', 'add') && cu.type !== 'chair';
  const canEdit = can(cu, 'correspondence', 'edit') && cu.type !== 'chair';
  const canNote = can(cu, 'correspondence', 'note');

  const [cSearch, setCSearch] = useState('');
  const [cStatus, setCStatus] = useState('');
  const [cDir, setCDir] = useState('');
  const [cSort, setCSort] = useState<'asc' | 'desc'>('desc');

  const [modal, setModal] = useState<null | 'add' | 'edit'>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [parsedDocs, setParsedDocs] = useState<Partial<FormState>[] | null>(null);
  const [parsedFrom, setParsedFrom] = useState('');
  const impRef = useRef<HTMLInputElement>(null);
  const [docNote, setDocNote] = useState('');

  const opt = (arr: string[]) => arr.map((v) => ({ v, label: tr(v) }));

  // ---- filter + sort ----
  let filtered = corr.filter((c) => {
    if (cStatus && c.status !== cStatus) return false;
    if (cDir && c.dir !== cDir) return false;
    if (cSearch && !(c.name.includes(cSearch) || c.entity.includes(cSearch))) return false;
    return true;
  });
  const key = (d: string) => { const dt = parseAr(d); return dt ? dt.getTime() : 0; };
  filtered = filtered.slice().sort((a, b) => cSort === 'asc' ? key(a.date) - key(b.date) : key(b.date) - key(a.date));

  const openAdd = () => { setForm(emptyForm()); setParsedDocs(null); setParsedFrom(''); setModal('add'); };

  // build a full correspondence record from a (partial) form
  const recordFrom = (f: Partial<FormState>): Corr => {
    const m = { ...emptyForm(), ...f } as FormState;
    return {
      ...(m as unknown as Corr),
      id: 'c' + Math.floor(Math.random() * 1e9),
      recvDate: m.date || '—',
      needsAction: m.status !== 'مكتمل' && m.status !== 'مغلق',
      attachment: (m as Record<string, string>).attachment || 'مرفق.pdf',
      action: m.action || '—',
      notes: m.notes || '—',
    };
  };

  const onImport = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      if (!blocks) { showToast('تعذّرت قراءة الملف تلقائياً'); return; }
      const docs = parseCorrFile(blocks.tables);
      if (!docs.length) { showToast('لم يُتعرف على أي مستند في الملف — تحقق من مطابقة القالب'); return; }
      setParsedFrom(file.name);
      if (docs.length === 1) {
        // one document → fill the form for review
        setForm((f) => ({ ...f, ...docs[0] }));
        setParsedDocs(null);
        showToast('قُرئ المستند وعُبئت الحقول — راجعها قبل الحفظ');
      } else {
        // several documents → review list + import-all
        setParsedDocs(docs);
        showToast('قُرئ ' + docs.length + ' مستنداً — راجعها ثم استوردها');
      }
    } catch {
      showToast('تعذّرت قراءة الملف تلقائياً');
    }
  };

  const importAll = () => {
    if (!parsedDocs || !parsedDocs.length) return;
    mutate((d) => { parsedDocs.forEach((pd) => d.correspondence.unshift(recordFrom(pd))); });
    showToast('تم استيراد ' + parsedDocs.length + ' مستنداً وإضافتها للسجل');
    setParsedDocs(null); setParsedFrom(''); setModal(null);
  };

  // Direct bulk import from the toolbar — parse an Excel/CSV of many documents
  // (one per row) and add them all at once, no modal review needed.
  const bulkRef = useRef<HTMLInputElement>(null);
  const onBulkImport = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      const docs = blocks ? parseCorrFile(blocks.tables) : [];
      if (!docs.length) { showToast('لم يُتعرف على أي مستند في الملف — تحقق من مطابقة القالب'); return; }
      mutate((d) => { docs.forEach((pd) => d.correspondence.unshift(recordFrom(pd))); });
      showToast('تم استيراد ' + docs.length + ' مستنداً وإضافتها للسجل');
    } catch {
      showToast('تعذّر استيراد الملف — تأكد من أنه بصيغة القالب');
    }
  };
  const openEdit = (id: string) => {
    const d = corr.find((x) => x.id === id);
    if (d) { setForm({ ...(d as unknown as FormState) }); setModal('edit'); }
  };
  const closeModal = () => setModal(null);

  const setF = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveDoc = () => {
    const f = form;
    if (modal === 'add') {
      const id = 'c' + Date.now();
      mutate((d) => {
        const rec = { ...(f as unknown as Corr) };
        rec.id = id;
        rec.recvDate = f.date || '—';
        rec.needsAction = f.status !== 'مكتمل' && f.status !== 'مغلق';
        rec.attachment = (f as Record<string, string>).attachment || 'مرفق.pdf';
        rec.action = f.action || '—';
        rec.notes = f.notes || '—';
        d.correspondence.unshift(rec);
      });
      showToast('تمت إضافة المستند');
    } else {
      mutate((d) => {
        const doc = d.correspondence.find((x) => x.id === (form.id ?? params.selDoc));
        if (doc) Object.assign(doc, f);
      });
      showToast('تم تحديث المستند');
    }
    setModal(null);
  };

  const addDocNote = () => {
    const txt = (docNote || '').trim();
    if (!txt) return;
    mutate((d) => {
      const doc = d.correspondence.find((x) => x.id === params.selDoc);
      if (doc) doc.notes = (doc.notes && doc.notes !== '—' ? doc.notes + '\n' : '') + txt;
    });
    setDocNote('');
    showToast('تمت إضافة الملاحظة');
  };

  // ===================== DOC DETAIL =====================
  if (page === 'docDetail') {
    const doc = corr.find((x) => x.id === params.selDoc);
    if (!doc) {
      return <Fade><div style={{ padding: 44, textAlign: 'center', color: '#9aa39b', fontSize: 14 }}>{t('noCorr')}</div></Fade>;
    }
    const [sbg, sfg] = (CS as Record<string, readonly string[]>)[doc.status] || ['#eee', '#555'];
    const [dbg, dfg] = dirColors(doc.dir);
    const [prBg, prFg] = (PR as Record<string, readonly string[]>)[doc.priority] || ['#eceeeb', '#6d7973'];

    const fieldLabel: CSSProperties = { fontSize: 11, color: '#9aa39b', marginBottom: 4 };
    const fieldVal: CSSProperties = { fontSize: 13.5, color: '#2a332d' };

    return (
      <Fade>
        <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>
          {/* main card */}
          <div style={{ background: '#ffffff', border: 'none', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '5px 11px', background: dbg, color: dfg }}>{tr(doc.dir)}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '5px 11px', background: sbg, color: sfg }}>{tr(doc.status)}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '5px 11px', background: prBg, color: prFg }}>{t('priority')} {tr(doc.priority)}</span>
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, lineHeight: 1.5 }}>{tr(doc.name)}</h2>
            <WorkflowBanner rec={doc} style={{ marginBottom: 18 }} />
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '-8px 0 20px' }}>
                <button onClick={() => openEdit(doc.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
                  تعديل المستند / تحديث الحالة
                </button>
              </div>
            )}
            <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
              <div><div style={fieldLabel}>{t('thEntity')}</div><div style={fieldVal}>{tr(doc.entity)}</div></div>
              <div><div style={fieldLabel}>{t('dDocType')}</div><div style={fieldVal}>{tr(doc.type)}</div></div>
              <div><div style={fieldLabel}>{t('dSender')}</div><div style={fieldVal}>{tr(doc.sender)}</div></div>
              <div><div style={fieldLabel}>{t('dRecipient')}</div><div style={fieldVal}>{tr(doc.recipient)}</div></div>
              <div><div style={fieldLabel}>{t('thDate')}</div><div style={fieldVal}>{dl(doc.date)}</div></div>
              <div><div style={fieldLabel}>{t('dRecvDate')}</div><div style={fieldVal}>{dl(doc.recvDate)}</div></div>
            </div>
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #eef0ec' }}>
              <div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 5 }}>{t('requiredAction')}</div>
              <div style={{ fontSize: 13.5, color: '#2a332d', lineHeight: 1.6, marginBottom: 16 }}>{tr(doc.action)}</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div><div style={fieldLabel}>{t('followupOwner')}</div><div style={{ fontSize: 13, fontWeight: 600, color: '#2a332d' }}>{tr(doc.followup)}</div></div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 6 }}>{t('thCurStatus')}</div>
                  <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: '6px 14px', background: sbg, color: sfg }}>{tr(doc.status)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* side column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#ffffff', border: 'none', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>{t('attachment')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7f8f6', borderRadius: 11, padding: '13px 14px' }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#b0433b" strokeWidth={1.6} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2a332d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(doc.attachment || 'مرفق.pdf')}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa39b' }}>{t('clickView')}</div>
                </div>
                <AttachmentDownload name={doc.attachment || 'مرفق.pdf'} size={30} />
              </div>
            </div>

            <div style={{ background: '#e9f0ec', border: '1px solid #cfe0d5', borderRadius: 16, padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 9px', fontSize: 14, fontWeight: 600, color: '#1e4634' }}>{t('chairmanNotes')}</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#284c3a', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{tr(doc.notes)}</p>
              {canNote && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder={t('docNotePh')} style={{ flex: 1, minWidth: 0, border: '1px solid #cfe0d5', background: '#ffffff', borderRadius: 9, padding: '8px 11px', fontSize: 12, outline: 'none' }} />
                  <button onClick={addDocNote} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 15px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('addNoteBtn')}</button>
                </div>
              )}
            </div>

            <div style={{ background: '#f7f8f6', border: '1px solid #ebeee9', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, color: '#7d867f', fontSize: 12, lineHeight: 1.5 }}>
              <svg width={17} height={17} style={{ flex: 'none' }} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
              <span>{t('editByOwnerLbl')}: <strong style={{ color: '#3c4a42', fontWeight: 600 }}>{tr(doc.followup)}</strong></span>
            </div>
          </div>
        </div>
        {renderModal()}
      </Fade>
    );
  }

  // ===================== LIST =====================
  const dirBtn = (active: boolean, color: string): CSSProperties => active
    ? { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + color, background: color, color: '#fff' }
    : { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #e2e6df', background: '#ffffff', color: '#5b6b62' };

  const sortArrow = cSort === 'asc' ? '↑' : '↓';

  return (
    <Fade>
      {/* PAGE HEADER: title on the start side, add button opposite */}
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{t('t_correspondence')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{tr('سجل المراسلات الصادرة والواردة ومتابعة إجراءاتها')}</p>
        </div>
        {canAdd && (
          <div className="page-head-action" style={{ flex: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => triggerDownload(buildCorrXlsx(), 'Correspondence_Bulk_Template.xlsx')} title="تنزيل قالب إكسيل بصف لكل مستند" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 11, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>قالب الاستيراد (إكسيل)
            </button>
            <input ref={bulkRef} type="file" accept=".xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onBulkImport(f); e.target.value = ''; }} />
            <button onClick={() => bulkRef.current?.click()} title="رفع ملف إكسيل يحتوي عدة مستندات دفعة واحدة" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef4ef', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 11, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9m0 0-4 4m4-4 4 4M5 3h14" /></svg>استيراد دفعة من إكسيل
            </button>
            <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>إضافة وارد/صادر جديد
            </button>
          </div>
        )}
      </div>

      {/* filters (bottom sheet on phones) */}
      <MobileFilters activeCount={(cSearch ? 1 : 0) + (cDir ? 1 : 0) + (cStatus ? 1 : 0)}
        onClear={() => { setCSearch(''); setCDir(''); setCStatus(''); }}
        rowStyle={{ background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.65)', borderRadius: 22, boxShadow: '0 10px 36px -12px rgba(30,60,40,.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', insetInlineStart: 12 }} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.9}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={cSearch} onChange={(e) => setCSearch(e.target.value)} placeholder={t('corrSearchPh')} style={{ width: '100%', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', paddingInlineStart: 40, fontSize: 13, outline: 'none' }} />
        </div>
        <button onClick={() => setCDir((d) => d === 'صادر' ? '' : 'صادر')} style={dirBtn(cDir === 'صادر', '#1f4a37')}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-5 5m5-5 5 5" /></svg>{tr('صادر')}
        </button>
        <button onClick={() => setCDir((d) => d === 'وارد' ? '' : 'وارد')} style={dirBtn(cDir === 'وارد', '#a9791f')}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m0 0 5-5m-5 5-5-5" /></svg>{tr('وارد')}
        </button>
        <Dropdown value={cStatus} onChange={setCStatus} options={[{ v: '', label: t('allStatuses') }, ...opt(CORR_STATUSES)]} opt={{ size: 'sm', minWidth: '150px' }} />
      </MobileFilters>

      <div style={{ fontSize: 12.5, color: '#8a938c', marginBottom: 12 }}>{arPlural(filtered.length, { one: 'مستند واحد', two: 'مستندان', few: 'مستندات', many: 'مستنداً' })}</div>

      <div style={{ background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.65)', borderRadius: 22, boxShadow: '0 10px 36px -12px rgba(30,60,40,.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', overflow: 'hidden' }}>
        <div className="trow thead" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '13px 20px', background: 'rgba(255,255,255,.35)', borderBottom: '1px solid rgba(255,255,255,.5)', fontSize: 11.5, fontWeight: 600, color: '#7d867f' }}>
          <div onClick={() => setCSort((s) => s === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }} title={t('thSortDate')}>
            <span>{t('thDate')}</span><span style={{ fontSize: 12, color: '#1f8a5b', fontWeight: 800 }}>{sortArrow}</span>
          </div>
          <div>{t('thDoc')}</div><div>{t('thEntity')}</div><div>{t('thType')}</div><div>{t('dSender')}</div><div>{t('dRecipient')}</div><div>{t('thCurStatus')}</div>
        </div>

        {filtered.map((c) => {
          const [sbg, sfg] = (CS as Record<string, readonly string[]>)[c.status] || ['#eee', '#555'];
          const [dbg, dfg] = dirColors(c.dir);
          return (
            <div key={c.id} onClick={() => goto('docDetail', { selDoc: c.id })} className="trow" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '14px 20px', borderBottom: '1px solid #f2f4f0', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: '#8a938c' }}>{dl(c.date)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 5, padding: '2px 7px', background: dbg, color: dfg }}>{tr(c.dir)}</span>
                  {c.needsAction && <span style={{ fontSize: 9.5, fontWeight: 600, color: '#b0433b' }}>● {t('needsActionTag')}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2a332d', lineHeight: 1.4 }}>{tr(c.name)}</div>
              </div>
              <div style={{ fontSize: 12, color: '#3c4a42', lineHeight: 1.4 }}>{tr(c.entity)}</div>
              <div style={{ fontSize: 11.5, color: '#5b6b62' }}>{tr(c.type)}</div>
              <div style={{ fontSize: 12, color: '#3c4a42', lineHeight: 1.4 }}>{tr(c.sender)}</div>
              <div style={{ fontSize: 12, color: '#3c4a42', lineHeight: 1.4 }}>{tr(c.recipient)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '4px 10px', background: sbg, color: sfg }}>{tr(c.status)}</span>
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); openEdit(c.id); }} title="تعديل" style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, border: '1px solid #e2e6df', background: '#f7f8f6', color: '#3c4a42', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 44, color: '#9aa39b', fontSize: 14 }}>{t('noCorr')}</div>}
      </div>
      {renderModal()}
    </Fade>
  );

  // ===================== ADD / EDIT MODAL =====================
  function renderModal() {
    const labelStyle: CSSProperties = { fontSize: 12, color: '#5b6b62', fontWeight: 500, display: 'block', marginBottom: 6 };
    const inputStyle: CSSProperties = { width: '100%', border: '1px solid #e2e6df', borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none' };
    const ddOpt = { block: true, size: 'sm' as const };
    const txt = (k: keyof FormState) => (
      <input value={String(form[k] ?? '')} onChange={(e) => setF(k)(e.target.value)} style={inputStyle} />
    );

    return (
      <Modal open={modal !== null} onClose={closeModal} width={640} padded={false}>
        <div style={{ padding: '20px 26px', borderBottom: '1px solid #eef0ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', borderRadius: '18px 18px 0 0', zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{modal === 'add' ? t('mAddTitle') : t('mEditTitle')}</h2>
          <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '24px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {modal === 'add' && (
            <div style={{ gridColumn: '1/3' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: '#f7f9f6', border: '1px dashed #cdd8ce', borderRadius: 12, padding: '10px 12px', alignItems: 'center' }}>
                <button type="button" onClick={() => triggerDownload(buildCorrDocx(), 'Correspondence_Template.docx')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
                  قالب Word
                </button>
                <button type="button" onClick={() => triggerDownload(buildCorrXlsx(), 'Correspondence_Template.xlsx')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
                  قالب Excel
                </button>
                <input ref={impRef} type="file" accept=".doc,.docx,.xlsx,.xls,.csv,.pptx,.ppt,.html,.htm,.txt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
                <button type="button" onClick={() => impRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 0-4 4m4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
                  رفع ملف معبّأ (استيراد تلقائي)
                </button>
                <span style={{ fontSize: 10.5, color: '#7d867f' }}>يُقبل Word أو Excel — ملف Excel يمكن أن يحوي عدة مستندات (سطر لكل مستند).</span>
              </div>
              {!!parsedFrom && !parsedDocs && (
                <div style={{ marginTop: 8, background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#1e4634' }}>قُرئت بيانات المستند من «{parsedFrom}» — راجعها وعدّلها قبل الحفظ.</div>
              )}
              {!!(parsedDocs && parsedDocs.length) && (
                <div style={{ marginTop: 8, background: '#eef3f0', border: '1px solid #d6e5db', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e4634' }}>قُرئ {parsedDocs.length} مستنداً من «{parsedFrom}» — جاهزة للاستيراد</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { setForm((f) => ({ ...f, ...parsedDocs[0] })); setParsedDocs(null); }} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 9, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>مراجعة أول مستند</button>
                      <button type="button" onClick={importAll} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>استيراد الكل ({parsedDocs.length})</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {parsedDocs.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e6ece7', borderRadius: 9, padding: '7px 11px', fontSize: 11.5 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 5, padding: '2px 7px', background: d.dir === 'وارد' ? '#eef6f0' : '#e6eef6', color: d.dir === 'وارد' ? '#2e7d55' : '#3a6ea5' }}>{tr(String(d.dir || 'صادر'))}</span>
                        <span style={{ flex: 1, minWidth: 0, color: '#17211c', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(String(d.name || '—'))}</span>
                        <span style={{ color: '#9aa39b', flex: 'none' }}>{tr(String(d.entity || ''))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ gridColumn: '1/3' }}><label style={labelStyle}>{t('fName')}</label>{txt('name')}</div>
          <div><label style={labelStyle}>{t('fEntity')}</label>{txt('entity')}</div>
          <div><label style={labelStyle}>{t('fCat')}</label><Dropdown value={form.dir} onChange={setF('dir')} options={[{ v: '', label: t('allDir') }, ...opt(['صادر', 'وارد'])]} opt={ddOpt} /></div>
          <div><label style={labelStyle}>{t('fType')}</label><Dropdown value={form.type} onChange={setF('type')} options={opt(DOC_TYPES)} opt={ddOpt} /></div>
          <div><label style={labelStyle}>{t('fDate')}</label><DateField value={String(form.date ?? '')} onChange={setF('date')} /></div>
          <div><label style={labelStyle}>{t('fSender')}</label>{txt('sender')}</div>
          <div><label style={labelStyle}>{t('fRecipient')}</label>{txt('recipient')}</div>
          <div><label style={labelStyle}>{t('fFollowup')}</label><Dropdown value={form.followup} onChange={setF('followup')} options={members.map((m) => ({ v: m.name, label: tr(m.name) }))} opt={ddOpt} /></div>
          <div><label style={labelStyle}>{t('fStatus')}</label><Dropdown value={form.status} onChange={setF('status')} options={opt(CORR_STATUSES)} opt={ddOpt} /></div>
          <div><label style={labelStyle}>{t('fPriority')}</label><Dropdown value={form.priority} onChange={setF('priority')} options={opt(PRIORITIES)} opt={ddOpt} /></div>
          <div style={{ gridColumn: '1/3' }}><label style={labelStyle}>{t('fAction')}</label>{txt('action')}</div>
          <div style={{ gridColumn: '1/3' }}>
            <label style={labelStyle}>{t('fAttach')}</label>
            <FileUploadField multiple={false} files={form.attachment ? [String(form.attachment)] : []} onChange={(fs) => setF('attachment')(fs[0] || '')} />
          </div>
          <div style={{ gridColumn: '1/3' }}><label style={labelStyle}>{t('chairmanNotes')}</label><textarea value={String(form.notes ?? '')} onChange={(e) => setF('notes')(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} /></div>
        </div>
        <div style={{ padding: '16px 26px', borderTop: '1px solid #eef0ec', display: 'flex', justifyContent: 'flex-start', gap: 10, position: 'sticky', bottom: 0, background: '#ffffff', borderRadius: '0 0 18px 18px' }}>
          <button onClick={saveDoc} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('saveDoc')}</button>
          <button onClick={closeModal} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#5b6b62', borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('cancel')}</button>
        </div>
      </Modal>
    );
  }
}
