import { useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { pushUpdateReq, DONE_PENDING } from '../member/workflow';
import { useI18n } from '../../i18n/i18n';
import { useNav } from '../../store/nav';
import { useToast } from '../../components/Toast';
import { Fade, Avatar } from '../../components/ui';
import { MobileFilters } from '../../components/MobileFilters';
import { Dropdown } from '../../components/Dropdown';
import { Icon } from '../../components/Icon';
import { DeleteAction } from '../../components/DeleteAction';
import { UNITS } from '../../shared/constants';
import { triggerDownload } from '../../shared/fileGen';
import { makeXlsx, fileToBlocks, parseBulk, alias, pick, excelSerialToDate } from '../reportcenter/templateIO';
import type { Project, ProjectTask } from '../../data/types';
import { psColors, prColors, accentOf, unitOf, dueColor } from './projShared';
import { useCurrentUser } from '../../store/useCurrentUser';
import { can } from '../../domain/permissions';
import { ProjectEditModal } from './ProjectEditModal';

export function ProjectsList() {
  const projects = useStore((s) => s.data).projects;
  const mutate = useStore((s) => s.mutate);
  const { lang, tr, dl, t } = useI18n();
  const { goto } = useNav();
  const { showToast } = useToast();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const isChair = cu.type === 'chair';
  const canAdd = !isChair && (can(cu, 'projects', 'add') || can(cu, 'projects', 'edit'));
  const canEditProj = !isChair && can(cu, 'projects', 'edit');
  const canDrag = can(cu, 'projects', 'status'); // chair + members holding "تغيير الحالة"
  const cardRole: 'chair' | 'editor' | 'viewer' = isChair ? 'chair' : canEditProj ? 'editor' : 'viewer';
  const [addOpen, setAddOpen] = useState(false);
  const [editProj, setEditProj] = useState<Project | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // ---- bulk import (one project per row) ----
  const P_STATUS = ['لم يبدأ', 'قيد التنفيذ', 'متأخر', 'مكتمل', 'يحتاج قرار', 'بانتظار الاعتماد'];
  const P_PRI = ['عالية', 'متوسطة', 'منخفضة'];
  const P_COLS = [
    { field: 'name', match: alias('اسم المشروع', 'المشروع', 'العنوان') },
    { field: 'owner', match: alias('المسؤول', 'المالك') },
    { field: 'unit', match: alias('الوحدة', 'الإدارة') },
    { field: 'status', match: alias('الحالة'), norm: pick(P_STATUS, 'لم يبدأ') },
    { field: 'progress', match: alias('نسبة الإنجاز', 'الإنجاز', 'النسبة') },
    { field: 'priority', match: alias('الأولوية'), norm: pick(P_PRI, 'متوسطة') },
    { field: 'budget', match: alias('الميزانية') },
    { field: 'startDate', match: alias('تاريخ البدء', 'البدء'), norm: excelSerialToDate },
    { field: 'dueDate', match: alias('تاريخ الاستحقاق', 'الاستحقاق', 'الموعد'), norm: excelSerialToDate },
    { field: 'desc', match: alias('الوصف') },
    { field: 'finalOutput', match: alias('المخرج') },
    { field: 'nextStep', match: alias('الخطوة القادمة', 'الخطوة التالية') },
    { field: 'scope', match: alias('نطاق المشروع', 'نطاق العمل', 'النطاق') },
    { field: 'milestones', match: alias('المراحل', 'خطة المراحل') },
    { field: 'endUser', match: alias('المستخدم النهائي') },
    { field: 'supplier', match: alias('المورد') },
    { field: 'poNumber', match: alias('طلب الشراء', 'العقد', 'التوريد', 'رقم الطلب') },
    { field: 'dependencies', match: alias('الاعتماديات', 'الاعتمادية') },
    { field: 'risks', match: alias('المخاطر') },
    { field: 'stages', match: alias('مراحل الجدول الزمني', 'الجدول الزمني', 'جدول زمني', 'مراحل زمنية') },
  ];
  const P_HEADERS = ['اسم المشروع', 'المسؤول', 'الوحدة التنظيمية', 'الحالة', 'نسبة الإنجاز', 'الأولوية', 'الميزانية', 'تاريخ البدء', 'تاريخ الاستحقاق', 'الوصف', 'المخرج النهائي', 'الخطوة التالية', 'نطاق المشروع', 'خطة المراحل الرئيسية', 'المستخدم النهائي', 'اسم المورد', 'رقم طلب الشراء / العقد / التوريد', 'الاعتماديات', 'المخاطر', 'مراحل الجدول الزمني (اسم | بدء | انتهاء | حالة | %) ولكل مرحلة سطر'];
  const P_EXAMPLE = ['توحيد إجراءات المكتب', 'سيف بيضاني', 'قطاع الخدمات المركزية', 'قيد التنفيذ', '40', 'عالية', '500000', '1 يناير 2026', '30 يونيو 2026', 'توحيد وتبسيط إجراءات العمل', 'دليل إجراءات معتمد', 'اعتماد المسودة', 'حصر الإجراءات؛ إعادة التصميم؛ الاعتماد', 'التحليل؛ التصميم؛ التنفيذ؛ الإطلاق', 'إدارة الشؤون الإدارية', 'شركة الحلول الذكية', 'PO-2026-114', 'اعتماد الميزانية', 'ضيق الوقت — صف مثال يُحذف', 'التصميم | 1 يناير 2026 | 15 فبراير 2026 | قيد التنفيذ | 55؛ التنفيذ | 16 فبراير 2026 | 30 مايو 2026 | لم يبدأ | 0'];
  // Parse the timeline cell: one stage per line/؛, fields split by | →
  // اسم | تاريخ البدء | تاريخ الانتهاء | الحالة | نسبة الإنجاز
  const snapStageStatus = pick(['لم يبدأ', 'قيد التنفيذ', 'مكتمل', 'متأخر'], 'لم يبدأ');
  const parseStages = (cell?: string): ProjectTask[] =>
    String(cell || '').split(/[؛\n]+/).map((s) => s.trim()).filter(Boolean).map((seg) => {
      const [name, start, end, status, prog] = seg.split('|').map((x) => (x || '').trim());
      if (!name) return null;
      const tk: ProjectTask = { name, owner: '', status: status ? snapStageStatus(status) : 'لم يبدأ' };
      if (start) tk.start = excelSerialToDate(start);
      if (end) tk.end = excelSerialToDate(end);
      const n = parseInt(String(prog || '').replace(/[^\d]/g, ''), 10);
      if (!isNaN(n)) tk.progress = Math.max(0, Math.min(100, n));
      return tk;
    }).filter((x): x is ProjectTask => x !== null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const dlProjTemplate = () => triggerDownload(makeXlsx([P_HEADERS, P_EXAMPLE.slice(0, P_HEADERS.length)], 'المشاريع'), 'Projects_Bulk_Template.xlsx');
  const onBulk = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      const rows = blocks ? parseBulk(blocks.tables, P_COLS, (r) => !!r.name) : [];
      if (!rows.length) { showToast(rl('لم يُعثر على مشاريع في الملف — تأكد من مطابقة الأعمدة للقالب', 'No projects found — check the template columns')); return; }
      mutate((d) => {
        rows.forEach((r, i) => {
          const p = {
            id: 'p' + Date.now() + i, no: String(d.projects.length + 1 + i).padStart(2, '0'), stage: 'PLANNING',
            name: r.name, nameEn: '', owner: r.owner || cu.name, unit: r.unit || 'قطاع الخدمات المركزية',
            status: r.status || 'لم يبدأ', priority: r.priority || 'متوسطة',
            progress: Math.max(0, Math.min(100, parseInt(r.progress, 10) || 0)),
            budget: parseInt(String(r.budget || '').replace(/[^\d]/g, ''), 10) || 0,
            startDate: r.startDate || '', dueDate: r.dueDate || '', deadline: '',
            desc: r.desc || '', finalOutput: r.finalOutput || '', nextStep: r.nextStep || '', risks: r.risks || '',
            scope: String(r.scope || '').split(/[؛\n;]+/).map((s) => s.trim()).filter(Boolean),
            milestones: String(r.milestones || '').split(/[؛\n;]+/).map((s) => s.trim()).filter(Boolean),
            endUser: r.endUser || '', supplier: r.supplier || '', poNumber: r.poNumber || '', dependencies: r.dependencies || '',
            lastDate: 'اليوم', chairmanNotes: '', people: [], attachments: [], timeline: [], tasks: parseStages(r.stages),
            _mowner: cu.id, _mstatus: 'مسودة',
          } as unknown as Project;
          d.projects.unshift(p);
        });
      });
      showToast(rl('تم استيراد ', 'Imported ') + rows.length + rl(' مشروعاً', ' projects'));
    } catch {
      showToast(rl('تعذّر استيراد الملف', 'Import failed'));
    }
  };

  const [fSearch, setSearch] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fStatus, setFStatus] = useState('');

  const statusLabel = (s: string) =>
    s === 'يحتاج قرار' ? rl('بانتظار توجيه', 'Awaiting direction') : tr(s);

  // ---- stat cards -----------------------------------------------------------
  const pStat = (st: string) => projects.filter((p) => p.status === st).length;
  const total = projects.length;
  const inProg = pStat('قيد التنفيذ');
  const late = pStat('متأخر');
  const done = pStat('مكتمل');
  const avg = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0;

  const applyStatus = (st: string) => () => { setSearch(''); setFUnit(''); setFStatus(st); };

  const stats: { label: string; value: string | number; accent: string; bg: string; ic: string; open: () => void }[] = [
    { label: rl('إجمالي المشاريع', 'Total projects'), value: total, accent: '#2b5c44', bg: '#eef3f0', ic: 'folder', open: applyStatus('') },
    { label: rl('قيد التنفيذ', 'In progress'), value: inProg, accent: '#2f6aa8', bg: '#e6eef6', ic: 'task', open: applyStatus('قيد التنفيذ') },
    { label: rl('متأخرة', 'Delayed'), value: late, accent: '#b0433b', bg: '#f7e6e4', ic: 'timer', open: applyStatus('متأخر') },
    { label: rl('متوسط الإنجاز', 'Average progress'), value: avg + '%', accent: '#a9791f', bg: '#fbf0d6', ic: 'chart', open: applyStatus('') },
    { label: rl('مكتملة', 'Completed'), value: done, accent: '#2e7d55', bg: '#e2f0e8', ic: 'tick', open: applyStatus('مكتمل') },
  ];

  // ---- filtering ------------------------------------------------------------
  const filtered = projects.filter((p) => {
    if (fUnit && unitOf(p.id) !== fUnit) return false;
    if (fStatus && p.status !== fStatus) return false;
    if (fSearch && !(p.name.includes(fSearch) || (p.desc || '').includes(fSearch))) return false;
    return true;
  });

  // ---- kanban columns -------------------------------------------------------
  const colDefs: { keys: string[]; label: string; dot: string }[] = [
    { keys: ['لم يبدأ', 'بانتظار الاعتماد', 'يحتاج قرار'], label: rl('قيد الاعتماد', 'Pending approval'), dot: '#9aa39b' },
    { keys: ['قيد التنفيذ'], label: rl('قيد التنفيذ', 'In progress'), dot: '#3a6ea5' },
    { keys: ['متأخر'], label: rl('متأخر', 'Delayed'), dot: '#b0433b' },
    { keys: [DONE_PENDING], label: rl('مكتمل قيد الاعتماد', 'Completion pending'), dot: '#c9a24b' },
    { keys: ['مكتمل'], label: rl('مكتمل', 'Completed'), dot: '#2e7d55' },
  ];
  const columns = colDefs.map((c) => ({
    ...c,
    items: filtered.filter((p) => c.keys.includes(p.status)),
  }));

  const open = (id: string) => () => goto('projectDetail', { selProject: id });
  const reqUpdate = (p: { owner: string; name: string }) => { mutate((d) => pushUpdateReq(d, { owner: p.owner, title: p.name, section: 'projects' })); showToast(rl('تم إرسال طلب تحديث — وصل إشعارٌ للمسؤول', 'Update request sent — the owner was notified')); };

  // ---- drag & drop between status columns -----------------------------------
  const DROP_STATUS = ['بانتظار الاعتماد', 'قيد التنفيذ', 'متأخر', DONE_PENDING, 'مكتمل'];
  const onDropTo = (ci: number) => (e: React.DragEvent) => {
    e.preventDefault(); setDragOverCol(null);
    const pid = e.dataTransfer.getData('text/plain'); if (!pid) return;
    const proj = projects.find((x) => x.id === pid); if (!proj) return;
    if (colDefs[ci].keys.includes(proj.status)) return; // dropped on its own column
    let target = DROP_STATUS[ci];
    // Members can't finalize a project — dropping on "مكتمل" routes to completion review.
    if (target === 'مكتمل' && !isChair) target = DONE_PENDING;
    const toReview = target === DONE_PENDING;
    mutate((d) => {
      const pr = d.projects.find((x) => x.id === pid) as any; if (!pr) return;
      if (toReview) {
        pr.status = DONE_PENDING; pr.progress = 100;
        pr._mret = ''; pr._mowner = pr._mowner || cu.id;
        (pr._mlog = pr._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: rl('طلب اعتماد الاكتمال', 'Completion approval requested'), sent: true, by: cu.name });
      } else {
        pr.status = target;
        if (target === 'مكتمل') pr.progress = 100;
        if (target === 'قيد التنفيذ' && (!pr.progress || pr.progress < 10)) pr.progress = 10;
      }
    });
    showToast(toReview
      ? rl('انتقل المشروع إلى «مكتمل قيد الاعتماد» — بانتظار اعتماد رئيس القطاع', 'Moved to “Completion pending” — awaiting the Sector Head’s approval')
      : rl('تم نقل المشروع إلى «' + tr(colDefs[ci].label) + '»', 'Project moved to “' + colDefs[ci].label + '”'));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9,
    padding: '9px 12px', paddingInlineStart: 36, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <Fade>
      {/* HEADER */}
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{t('projectsTitle')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{t('projectsSub')}</p>
        </div>
        {canAdd && (
          <div className="page-head-action" style={{ flex: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={dlProjTemplate} title={rl('تنزيل قالب إكسيل بصف لكل مشروع', 'Download an Excel template, one project per row')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 12, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>{rl('قالب الاستيراد', 'Import template')}
          </button>
          <input ref={bulkRef} type="file" accept=".xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onBulk(f); e.target.value = ''; }} />
          <button type="button" onClick={() => bulkRef.current?.click()} title={rl('رفع ملف إكسيل يحتوي عدة مشاريع دفعة واحدة', 'Upload an Excel of many projects at once')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef4ef', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 12, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9m0 0-4 4m4-4 4 4M5 3h14" /></svg>{rl('استيراد دفعة', 'Bulk import')}
          </button>
          <button type="button" onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.55)', flex: 'none' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {rl('إضافة مشروع', 'Add project')}
          </button>
          </div>
        )}
      </div>
      {addOpen && <ProjectEditModal project={null} onClose={() => setAddOpen(false)} />}
      {editProj && <ProjectEditModal project={editProj} onClose={() => setEditProj(null)} />}

      {/* STAT CARDS */}
      <div className="ov-stats rg5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 26 }}>
        {stats.map((s, i) => (
          <div key={i} onClick={s.open}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 26px -14px rgba(23,40,32,.28)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(23,40,32,.04)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            style={{ background: '#ffffff', border: '1px solid #eef1ec', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04)', padding: '15px 16px', cursor: 'pointer', transition: 'box-shadow .15s,transform .15s' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: s.bg, color: s.accent, marginBottom: 11 }}>
              <Icon name={s.ic} size={18} strokeWidth={1.9} />
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#17211c', lineHeight: 1, letterSpacing: '-.5px' }}>{s.value}</div>
            <div style={{ fontSize: 14, color: '#7d867f', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* FILTERS (bottom sheet on phones) */}
      <MobileFilters activeCount={(fSearch ? 1 : 0) + (fUnit ? 1 : 0) + (fStatus ? 1 : 0)}
        onClear={() => { setSearch(''); setFUnit(''); setFStatus(''); }}
        rowStyle={{ background: '#ffffff', border: '1px solid #eef1ec', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04)', padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 180 }}>
          <svg style={{ position: 'absolute', insetInlineStart: 12 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="1.9"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={fSearch} onChange={(e) => setSearch(e.target.value)} placeholder={t('projSearchPh')} style={inputStyle} />
        </div>
        <Dropdown value={fUnit}
          options={[{ v: '', label: t('allUnits') }, ...UNITS.map((u) => ({ v: u, label: tr(u) }))]}
          onChange={setFUnit} opt={{ size: 'sm', minWidth: '150px' }} />
        <Dropdown value={fStatus}
          options={[{ v: '', label: t('allStatuses') }, ...['قيد التنفيذ', 'متأخر', 'يحتاج قرار', 'بانتظار الاعتماد', 'مكتمل', 'لم يبدأ'].map((x) => ({ v: x, label: statusLabel(x) }))]}
          onChange={setFStatus} opt={{ size: 'sm', minWidth: '130px' }} />
        <button type="button" onClick={() => { setSearch(''); setFUnit(''); setFStatus(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#5b6b62', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          {rl('إعادة تعيين الفلاتر', 'Reset filters')}
        </button>
      </MobileFilters>

      {/* KANBAN BOARD */}
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
        {columns.map((col, ci) => (
          <div key={ci}
            onDragOver={canDrag ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(ci); } : undefined}
            onDragLeave={canDrag ? () => setDragOverCol((v) => (v === ci ? null : v)) : undefined}
            onDrop={canDrag ? onDropTo(ci) : undefined}
            style={{ flex: 'none', width: 288, background: dragOverCol === ci ? '#e7efe6' : '#f4f6f2', outline: dragOverCol === ci ? '2px dashed #2b5c44' : 'none', outlineOffset: -2, borderRadius: 16, padding: '12px 12px 6px', transition: 'background .12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 12px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot, flex: 'none' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2a332d' }}>{col.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7d867f', background: '#e7ebe3', borderRadius: 20, padding: '2px 9px', marginInlineStart: 'auto' }}>{col.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 60 }}>
              {col.items.map((p) => (
                <KanbanCard key={p.id} p={p} tr={tr} dl={dl} t={t} open={open(p.id)} reqUpdate={() => reqUpdate(p)}
                  role={cardRole} onEdit={() => setEditProj(p)} draggable={canDrag} editLabel={rl('تعديل', 'Edit')}
                  onDelete={() => mutate((d) => { d.projects = d.projects.filter((x) => x.id !== p.id); })} />
              ))}
              {col.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 10px', color: '#aab2a9', fontSize: 11.5 }}>{t('pv_emptyCol')}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Fade>
  );
}

function KanbanCard({ p, tr, dl, t, open, reqUpdate, role, onEdit, draggable, editLabel, onDelete }: {
  p: Project;
  tr: (s: string) => string; dl: (s: string) => string;
  t: (k: string) => string;
  open: () => void; reqUpdate: () => void;
  role: 'chair' | 'editor' | 'viewer'; onEdit: () => void; draggable: boolean; editLabel: string;
  onDelete: () => void;
}) {
  const [prBg, prFg] = prColors(p.priority);
  const accent = accentOf(p.status);
  const unit = unitOf(p.id);
  const due = dl(p.dueDate || '');
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      style={{ background: '#ffffff', border: '1px solid #edf0ea', borderRadius: 14, boxShadow: '0 1px 3px rgba(23,40,32,.05)', padding: '13px 14px', display: 'flex', flexDirection: 'column', cursor: draggable ? 'grab' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, borderRadius: 20, padding: '3px 9px', background: prBg, color: prFg }}>{tr(p.priority)}</span>
        {unit && <span style={{ fontSize: 9.5, fontWeight: 600, borderRadius: 20, padding: '3px 9px', background: '#eef3f0', color: '#2b5c44', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{tr(unit)}</span>}
      </div>
      <div onClick={open} style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45, marginBottom: 10, cursor: 'pointer' }}>
        {tr(p.name)}
        {p.nameEn && p.nameEn.trim() && <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: '#b6bdb6', marginTop: 2 }}>{p.nameEn}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 10.5, color: '#9aa39b' }}>{t('progress')}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#17211c' }}>{p.progress}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: '#eef0ec', overflow: 'hidden', marginBottom: 11 }}>
        <div style={{ height: '100%', borderRadius: 4, background: accent, width: p.progress + '%' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10.5, color: '#8a938c', paddingBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <Avatar name={p.owner} size={20} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(p.owner)}</span>
        </span>
        {due && (
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, color: dueColor(p.dueDate), fontWeight: 600 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5l3 2" /></svg>{due}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f2f4f0', paddingTop: 9 }}>
        <button type="button" onClick={open} title={t('pv_openBtn')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: 7, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>{t('pv_openBtn')}
        </button>
        {role === 'chair' && (
          <>
            <button type="button" onClick={reqUpdate} title={t('pv_reqUpdate')} style={{ width: 32, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f2', color: '#5b6b62', border: '1px solid #e6eae4', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
            </button>
            <button type="button" onClick={open} title={t('pv_addDir')} style={{ width: 32, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf3df', color: '#a9791f', border: '1px solid #f0e4c4', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
          </>
        )}
        {role === 'editor' && (
          <button type="button" onClick={onEdit} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: 7, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>{editLabel}
          </button>
        )}
        <DeleteAction section="projects" itemName={tr(p.name)} onConfirm={onDelete} style={{ width: 32, height: 32 }} />
      </div>
    </div>
  );
}
