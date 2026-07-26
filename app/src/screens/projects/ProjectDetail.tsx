import { useState } from 'react';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useNav } from '../../store/nav';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import { can } from '../../domain/permissions';
import { Fade, Avatar, Modal } from '../../components/ui';
import { WorkflowBanner } from '../../components/WorkflowBanner';
import { parseAr } from '../../shared/helpers';
import type { Project } from '../../data/types';
import { APP_TODAY, monthName, psColors, prColors, accentOf, projRange } from './projShared';
import { APP_TODAY_AR } from '../../shared/today';
import { ProjectEditModal } from './ProjectEditModal';
import { DateField } from '../../components/DateField';
import { Dropdown } from '../../components/Dropdown';
import { FileUploadField } from '../../components/FileUploadField';
import { AttachmentDownload } from '../../components/AttachmentDownload';

const TODAY_STORE = APP_TODAY_AR;

/** Ported directive shape (seed carries by/status beyond the narrow type). */
type DirItem = { date: string; by?: string; text: string; status?: string };
const dirsOf = (proj: Project): DirItem[] => (proj.directives || []) as unknown as DirItem[];

export function ProjectDetail() {
  const projects = useStore((s) => s.data).projects;
  const mutate = useStore((s) => s.mutate);
  const { lang, tr, dl, t } = useI18n();
  const { params, back } = useNav();
  const { showToast } = useToast();
  const cu = useCurrentUser();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const en = lang === 'en';

  const id = params.selProject as string;
  const p = projects.find((x) => x.id === id);

  const [pdTab, setPdTab] = useState<'overview' | 'timeline' | 'updates' | 'risks' | 'directives' | 'files'>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [updOpen, setUpdOpen] = useState(false);
  const [updDraft, setUpdDraft] = useState('');
  const [attachStaged, setAttachStaged] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reopenMode, setReopenMode] = useState(false);
  const [returnStatus, setReturnStatus] = useState('قيد التنفيذ');
  const [returnReason, setReturnReason] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [dirOpen, setDirOpen] = useState(false);
  const [dirDraft, setDirDraft] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [endDraft, setEndDraft] = useState('');

  if (!p) {
    return (
      <Fade>
        <div style={{ padding: 40, textAlign: 'center', color: '#9aa39b', fontSize: 14 }}>{rl('المشروع غير موجود', 'Project not found')}</div>
      </Fade>
    );
  }

  const canApprove = can(cu, 'projects', 'approve');
  const canEdit = can(cu, 'projects', 'edit');
  const statusLabel = (s: string) => (s === 'يحتاج قرار' ? rl('بانتظار توجيه', 'Awaiting direction') : tr(s));
  const fmtAr = (dt: Date | null) => (dt ? dt.getDate() + ' ' + monthName(dt.getMonth(), en) + ' ' + dt.getFullYear() : '');

  // ---- derived --------------------------------------------------------------
  const isPending = p.status === 'لم يبدأ';
  const isCompleted = p.status === 'مكتمل';
  const isPendingApproval = p.status === 'بانتظار الاعتماد'
    || ((p.progress || 0) >= 100 && p.status !== 'مكتمل' && p.status !== 'مرفوض' && p.status !== 'لم يبدأ');

  const [psBg, psFg] = psColors(p.status);
  const accent = accentOf(p.status);
  const [prBg, prFg] = prColors(p.priority);

  let headBg = psBg, headFg = psFg;
  let headStatus = p.status === 'لم يبدأ' ? rl('قيد الاعتماد', 'Pending approval') : statusLabel(p.status);
  if (isPendingApproval) { headBg = '#fbf0d6'; headFg = '#a9791f'; headStatus = rl('بانتظار اعتماد رئيس القطاع', 'Pending chair approval'); }

  const _en = parseAr(p.dueDate || '');
  const _st = p.startDate ? parseAr(p.startDate) : projRange(p).start;
  const overdue = !!(_en && APP_TODAY > _en && p.status !== 'مكتمل' && p.status !== 'بانتظار الاعتماد');
  const odDays = overdue && _en ? Math.round((APP_TODAY.getTime() - _en.getTime()) / 86400000) : 0;
  const overdueLabel = rl('تجاوز الموعد بـ ' + odDays + ' يوماً', 'Overdue by ' + odDays + ' days');

  // budget
  const pb = p.budget || 0;
  const ps = Math.round(pb * (p.progress || 0) / 100);
  const upct = pb ? Math.round(ps / pb * 100) : 0;
  const fmtN = (n: number) => Number(n).toLocaleString('en-US');
  const cur = rl('د.إ', 'AED');
  const hasBudget = pb > 0;

  // extension request
  const extReq = p.extendReq as (Project['extendReq'] & { decided?: boolean }) | undefined;
  const hasExtReq = !!(extReq && !extReq.decided);

  // final output / description
  const hasFinalOutput = !!(p.finalOutput && p.finalOutput.trim() && p.finalOutput.trim() !== (p.desc || '').trim());

  // stage = first not-completed task
  const stageTask = (p.tasks || []).find((tk) => tk.status !== 'مكتمل');
  const stage = stageTask ? tr(stageTask.name) : rl('المشروع مكتمل', 'Completed');

  // directives (seed from chairmanNotes for display when none stored)
  const dirsRaw: DirItem[] = (p.directives && p.directives.length)
    ? dirsOf(p)
    : (p.chairmanNotes && p.chairmanNotes.trim()
      ? [{ date: p.lastDate || '', by: 'رئيس القطاع', text: p.chairmanNotes, status: 'قيد التنفيذ' }]
      : []);

  // risks
  const riskN = (p.risks && p.risks.trim() && !/لا يوجد|لا توجد مخاطر/.test(p.risks)) ? 1 : 0;
  const highRisk = p.status === 'متأخر' || p.status === 'يحتاج قرار';

  const attachments = p.attachments || [];
  const timeline = p.timeline || [];

  // facts grid
  const facts: { k: string; v: string; color: string; overdue?: boolean }[] = [
    { k: rl('المرحلة الحالية', 'Current stage'), v: stage, color: '#2a332d' },
    { k: rl('الخطوة القادمة', 'Next step'), v: tr(p.nextStep), color: '#2a332d' },
    { k: rl('تاريخ بداية المشروع', 'Project start date'), v: _st ? fmtAr(_st) : '—', color: '#2a332d' },
    { k: rl('تاريخ نهاية المشروع', 'Project end date'), v: _en ? fmtAr(_en) : (tr(p.dueDate || '') || '—'), color: overdue ? '#b0433b' : '#2a332d', overdue },
    { k: rl('الموعد النهائي', 'Deadline'), v: p.deadline && p.deadline.trim() ? dl(p.deadline) : rl('لم يُحدَّد', 'Not set'), color: p.deadline && p.deadline.trim() ? '#2a332d' : '#b0433b' },
    { k: rl('آخر مناقشة مع رئيس القطاع', 'Last chair discussion'), v: dl(p.lastDate || ''), color: '#2a332d' },
  ];

  // tabs
  const tabDefs: { k: typeof pdTab; ar: string; en: string; badge: number }[] = [
    { k: 'overview', ar: 'نظرة عامة', en: 'Overview', badge: 0 },
    { k: 'timeline', ar: 'الجدول الزمني', en: 'Timeline', badge: 0 },
    { k: 'updates', ar: 'التحديثات', en: 'Updates', badge: timeline.length },
    { k: 'risks', ar: 'المخاطر', en: 'Risks', badge: riskN },
    { k: 'directives', ar: 'توجيهات رئيس القطاع', en: 'Directives', badge: dirsRaw.length },
    { k: 'files', ar: 'المرفقات', en: 'Attachments', badge: attachments.length },
  ];

  // ---- mutations ------------------------------------------------------------
  const withP = (fn: (proj: Project) => void) => mutate((d) => { const t2 = d.projects.find((x) => x.id === id); if (t2) fn(t2 as Project); });
  const seedDirs = (proj: Project) => {
    if (!proj.directives) {
      proj.directives = [];
      if (proj.chairmanNotes && proj.chairmanNotes.trim()) dirsOf(proj).push({ date: proj.lastDate || '', by: 'رئيس القطاع', text: proj.chairmanNotes, status: 'قيد التنفيذ' });
    }
  };

  const approveProject = () => { withP((proj) => { proj.status = 'قيد التنفيذ'; if (!proj.progress || proj.progress < 10) proj.progress = 10; }); showToast(rl('تم اعتماد المشروع — انتقل إلى قيد التنفيذ', 'Project approved — moved to In progress')); };
  const rejectProject = () => { withP((proj) => { proj.status = 'مرفوض'; }); showToast(rl('تم رفض اعتماد المشروع', 'Project approval rejected')); };
  const approveCompletion = () => { withP((proj) => { proj.status = 'مكتمل'; proj.progress = 100; proj.completionState = 'معتمد'; (proj.timeline = proj.timeline || []).unshift({ text: 'اعتمد رئيس القطاع اكتمال المشروع', by: 'رئيس القطاع', date: TODAY_STORE }); }); setConfirmOpen(false); showToast(rl('تم اعتماد اكتمال المشروع', 'Project completion approved')); };
  const doReturn = () => {
    const reason = returnReason.trim(); const note = returnNote.trim(); const st = returnStatus || 'قيد التنفيذ';
    withP((proj) => {
      proj.status = st; seedDirs(proj);
      dirsOf(proj).unshift({ date: TODAY_STORE, by: 'رئيس القطاع', text: (reason ? ('سبب الإرجاع: ' + reason) : '') + (note ? ((reason ? ' — ' : '') + note) : '') || 'أُرجع المشروع لإعادة العمل', status: 'جديد' });
      (proj.timeline = proj.timeline || []).unshift({ text: 'أرجع رئيس القطاع المشروع إلى «' + st + '»' + (reason ? (' — ' + reason) : ''), by: 'رئيس القطاع', date: TODAY_STORE });
    });
    setReturnOpen(false); setReopenMode(false); setReturnReason(''); setReturnNote('');
    showToast(rl('تم إرجاع المشروع', 'Project returned'));
  };
  const extDecide = (ok: boolean) => {
    withP((proj) => {
      const er = proj.extendReq as (Project['extendReq'] & { decided?: boolean }) | undefined;
      if (er) {
        if (ok) { proj.dueDate = er.to; (proj.timeline = proj.timeline || []).unshift({ text: 'اعتمد رئيس القطاع تمديد الموعد النهائي إلى ' + er.to, by: 'رئيس القطاع', date: TODAY_STORE }); if (proj.status === 'متأخر') proj.status = 'قيد التنفيذ'; }
        else { (proj.timeline = proj.timeline || []).unshift({ text: 'رفض رئيس القطاع طلب تمديد الموعد النهائي', by: 'رئيس القطاع', date: TODAY_STORE }); }
        er.decided = true;
      }
    });
    showToast(ok ? rl('تم اعتماد تمديد الموعد', 'Deadline extension approved') : rl('تم رفض تمديد الموعد', 'Deadline extension rejected'));
  };
  const saveDir = () => {
    const txt = dirDraft.trim();
    if (!txt) { setDirOpen(false); return; }
    withP((proj) => { seedDirs(proj); dirsOf(proj).unshift({ date: TODAY_STORE, by: 'رئيس القطاع', text: txt, status: 'جديد' }); });
    setDirOpen(false); setDirDraft(''); showToast(rl('تمت إضافة التوجيه', 'Directive added'));
  };
  const saveEnd = () => { const v = endDraft.trim(); withP((proj) => { proj.dueDate = v; }); setEndOpen(false); showToast(rl('تم تحديث تاريخ النهاية', 'End date updated')); };

  const openReturn = () => { setReturnOpen(true); setReopenMode(false); setReturnStatus('قيد التنفيذ'); setReturnReason(''); setReturnNote(''); };
  const openReopen = () => { setReturnOpen(true); setReopenMode(true); setReturnStatus('قيد التنفيذ'); setReturnReason(''); setReturnNote(''); };
  const openDir = () => { setDirOpen(true); setDirDraft(''); };
  const openEnd = () => { setEndDraft(p.dueDate || ''); setEndOpen(true); };

  const backBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#5b6b62', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', padding: '2px 0', marginBottom: 10 };

  return (
    <Fade style={{ maxWidth: 1080, margin: '0 auto' }}>
      <button type="button" onClick={back} style={backBtnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: en ? 'none' : 'scaleX(-1)' }}><path d="m15 18-6-6 6-6" /></svg>
        {rl('رجوع إلى المشاريع', 'Back to projects')}
      </button>

      {/* pending new-project banner */}
      {isPending && canApprove && (
        <div style={{ background: '#fbf2df', border: '1px solid #ecdcb4', borderRadius: 18, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
            <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5e6c4', color: '#a9791f' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 1.5" /></svg>
            </span>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: '#7a5a12', marginBottom: 2 }}>{t('pd_pendingTitle')}</div><div style={{ fontSize: 12, color: '#9a7d2f', lineHeight: 1.6 }}>{t('pd_pendingMsg')}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
            <button type="button" onClick={approveProject} style={{ background: '#1f8a5b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_approveBtn')}</button>
            <button type="button" onClick={rejectProject} style={{ background: '#fff', color: '#b0433b', border: '1px solid #e6b7b1', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_rejectBtn')}</button>
          </div>
        </div>
      )}

      {/* completion approval banner */}
      {isPendingApproval && canApprove && (
        <div style={{ background: 'linear-gradient(120deg,#1e4634,#2b5c44)', borderRadius: 18, padding: '18px 22px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', color: '#fff', boxShadow: '0 14px 34px -20px rgba(30,70,52,.55)' }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{t('pd_apprTitle')}</div><div style={{ fontSize: 12.5, color: '#bcd2c3', marginTop: 2 }}>{t('pd_apprMsg')}</div></div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setConfirmOpen(true)} style={{ background: '#fff', color: '#1f4a37', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_approveDone')}</button>
            <button type="button" onClick={openReturn} style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_returnProg')}</button>
            <button type="button" onClick={openReopen} style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_setIncomplete')}</button>
          </div>
        </div>
      )}

      {/* deadline extension request */}
      {hasExtReq && canApprove && extReq && (
        <div style={{ background: '#fbf1ef', border: '1px solid #ecd7d2', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b0433b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: '#7a4a44', lineHeight: 1.55 }}>
            <b style={{ color: '#b0433b' }}>{rl('طلب تمديد الموعد النهائي:', 'Deadline extension request:')}</b> {rl('من', 'from')} {dl(extReq.from)} {rl('إلى', 'to')} {dl(extReq.to)} — {rl('بطلب من', 'requested by')} {tr(extReq.by || 'فريق المشروع')}، {rl('بانتظار قرارك. لن يُحدَّث الموعد إلا بعد موافقتك.', 'awaiting your decision. The date changes only after your approval.')}
          </div>
          <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
            <button type="button" onClick={() => extDecide(true)} style={{ background: '#8a3229', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('اعتماد التمديد', 'Approve')}</button>
            <button type="button" onClick={() => extDecide(false)} style={{ background: '#fff', color: '#8a3229', border: '1px solid #e6b7b1', borderRadius: 9, padding: '8px 15px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('رفض', 'Reject')}</button>
          </div>
        </div>
      )}

      {/* completed banner */}
      {isCompleted && (
        <div style={{ background: '#e9f0ec', border: '1px solid #cfe0d5', borderRadius: 18, padding: '15px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: '#d6eadd', color: '#1f8a5b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1e4634' }}>{t('pd_completedTitle')}</div><div style={{ fontSize: 12, color: '#2b5c44', marginTop: 2 }}>{t('pd_completedMsg')}</div></div>
          {canApprove && <button type="button" onClick={openReopen} style={{ background: '#fff', color: '#1e4634', border: '1px solid #cfe0d5', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_reopenBtn')}</button>}
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: 'rgba(255,255,255,.55)', WebkitBackdropFilter: 'blur(16px) saturate(1.15)', backdropFilter: 'blur(16px) saturate(1.15)', border: '1px solid rgba(255,255,255,.65)', borderBottom: 'none', borderRadius: '22px 22px 0 0', boxShadow: '0 2px 6px rgba(23,40,32,.04)', padding: '22px 26px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: headBg, color: headFg }}>{headStatus}</span>
          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '4px 11px', background: prBg, color: prFg }}>{t('priority')} {tr(p.priority)}</span>
          {overdue && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: '#f7e6e4', color: '#b0433b' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{overdueLabel}
            </span>
          )}
          {canEdit && (
            <span style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 7 }}>
              <button type="button" onClick={() => setEditOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 14px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                {rl('تعديل المشروع', 'Edit project')}
              </button>
              <button type="button" onClick={openEnd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 9, padding: '6px 12px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                {rl('تعديل تاريخ النهاية', 'Edit end date')}
              </button>
            </span>
          )}
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 700, lineHeight: 1.35, color: '#17211c' }}>{tr(p.name)}</h1>
        {p.nameEn && p.nameEn.trim() && <div style={{ fontSize: 12.5, color: '#9aa39b', margin: '-2px 0 6px', letterSpacing: '.2px' }}>{p.nameEn}</div>}
        <div style={{ fontSize: 12.5, color: '#7d867f', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{rl('قطاع الخدمات المركزية', 'Central Services Sector')}</span>
          <span style={{ color: '#cdd4cc' }}>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Avatar name={p.owner} size={22} />
            {tr(p.owner)}
          </span>
        </div>
        <WorkflowBanner rec={p} style={{ marginTop: 14 }} />
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1f4a37', letterSpacing: '-.5px' }}>{p.progress}%</div>
            <div style={{ fontSize: 12, color: '#9aa39b' }}>{t('progress')}</div>
          </div>
          <div style={{ height: 12, borderRadius: 20, background: '#eef0ec', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 20, background: accent, width: p.progress + '%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 20, overflowX: 'auto' }}>
          {tabDefs.map((tb) => {
            const active = pdTab === tb.k;
            return (
              <button key={tb.k} type="button" onClick={() => setPdTab(tb.k)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', border: 'none', background: 'transparent', borderBottom: '3px solid ' + (active ? '#1f4a37' : 'transparent'), color: active ? '#1f4a37' : '#7d867f', fontWeight: active ? 700 : 600, fontSize: 13, fontFamily: 'inherit', padding: '11px 15px', cursor: 'pointer' }}>
                {rl(tb.ar, tb.en)}
                {tb.badge > 0 && <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 7px', background: active ? '#e9f0ec' : '#f0f3ee', color: active ? '#1f4a37' : '#8a938c' }}>{tb.badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* BODY */}
      <div style={{ background: 'rgba(255,255,255,.55)', WebkitBackdropFilter: 'blur(16px) saturate(1.15)', backdropFilter: 'blur(16px) saturate(1.15)', border: '1px solid rgba(255,255,255,.65)', borderTop: 'none', borderRadius: '0 0 22px 22px', boxShadow: '0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px', minHeight: 420 }}>
        {pdTab === 'overview' && (
          <div style={{ animation: 'fadeUp .16s ease' }}>
            <div style={{ background: '#f9fbf8', border: '1px solid #edf1ec', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1f4a37', letterSpacing: '.2px', marginBottom: 8 }}>{rl('وصف المشروع', 'Project description')}</div>
              <p style={{ margin: 0, fontSize: 14, color: '#3c4a42', lineHeight: 1.75 }}>{tr(p.desc)}</p>
            </div>
            {hasFinalOutput && (
              <div style={{ background: '#f3f8f4', border: '1px solid #d8e8dd', borderRadius: 16, padding: '18px 20px', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1f7a4e" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1f7a4e', letterSpacing: '.2px' }}>{rl('المخرج النهائي للمشروع', 'Final project output')}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#3c4a42', lineHeight: 1.75 }}>{tr(p.finalOutput)}</p>
              </div>
            )}
            <div className="pfacts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e6ebe6', border: '1px solid #e6ebe6', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              {facts.map((f, i) => (
                <div key={i} style={{ background: '#fbfcfb', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#8a938c' }}>{f.k}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: f.color }}>
                    {f.v}
                    {f.overdue && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 8px', background: '#f7e6e4', color: '#b0433b' }}>{overdueLabel}</span>}
                  </span>
                </div>
              ))}
            </div>
            {hasBudget && (
              <div style={{ background: '#fbfaf6', border: '1px solid #efe6cf', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: '#f4ead0', color: '#a9791f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /></svg>
                    </span>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#17211c' }}>{t('pd_budget')}</h3>
                  </div>
                  <div style={{ textAlign: 'end' }}><div style={{ fontSize: 19, fontWeight: 800, color: '#17211c', letterSpacing: '-.5px' }}>{fmtN(pb)} <span style={{ fontSize: 12, fontWeight: 600, color: '#9aa39b' }}>{cur}</span></div></div>
                </div>
                <div style={{ height: 10, borderRadius: 20, background: '#eef0ec', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ width: upct + '%', height: '100%', background: '#a9791f', borderRadius: 20 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#fff', border: '1px solid #efe6cf', borderRadius: 11, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa39b', marginBottom: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: '#a9791f' }} />{t('pd_budgetSpent')}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#a9791f' }}>{fmtN(ps)} {cur}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2efe7', borderRadius: 11, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa39b', marginBottom: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: '#2e7d55' }} />{t('pd_budgetRemaining')}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#2e7d55' }}>{fmtN(pb - ps)} <span style={{ fontSize: 11, fontWeight: 600, color: '#8fc0a5' }}>{cur}</span></div>
                  </div>
                </div>
              </div>
            )}
            {(p.scope || []).length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <span style={{ width: 6, height: 20, borderRadius: 4, background: '#a9791f' }} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#17211c' }}>{t('scopeOfWork')}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {(p.scope || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: '#a9791f', marginTop: 7 }} />
                      <span style={{ fontSize: 13, color: '#3c4a42', lineHeight: 1.6 }}>{tr(s)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Key milestones plan */}
            {(p.milestones || []).length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '20px 0 12px' }}>
                  <span style={{ width: 6, height: 20, borderRadius: 4, background: '#3a6ea5' }} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#17211c' }}>{rl('خطة المراحل الرئيسية', 'Key milestones plan')}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(p.milestones || []).map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#f6f9fc', border: '1px solid #e2ecf5', borderRadius: 11, padding: '10px 13px' }}>
                      <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 7, background: '#e6eef6', color: '#3a6ea5', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: '#3c4a42', lineHeight: 1.6 }}>{tr(m)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Procurement & delivery details */}
            {(p.endUser || p.supplier || p.poNumber || p.dependencies) && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '20px 0 12px' }}>
                  <span style={{ width: 6, height: 20, borderRadius: 4, background: '#2e7d55' }} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#17211c' }}>{rl('تفاصيل التنفيذ والتوريد', 'Delivery & procurement details')}</h3>
                </div>
                <div className="pfacts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e6ebe6', border: '1px solid #e6ebe6', borderRadius: 16, overflow: 'hidden' }}>
                  {[
                    { k: rl('المستخدم النهائي', 'End user'), v: p.endUser },
                    { k: rl('اسم المورد', 'Supplier'), v: p.supplier },
                    { k: rl('رقم طلب الشراء / العقد / التوريد', 'PO / contract / supply no.'), v: p.poNumber },
                    { k: rl('الاعتماديات', 'Dependencies'), v: p.dependencies },
                  ].filter((x) => x.v && String(x.v).trim()).map((x, i) => (
                    <div key={i} style={{ background: '#fbfcfb', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#8a938c' }}>{x.k}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#2a332d', lineHeight: 1.6 }}>{tr(String(x.v))}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {pdTab === 'timeline' && <TimelineTab p={p} en={en} rl={rl} tr={tr} t={t} canEdit={canEdit} withP={withP} showToast={showToast} />}

        {pdTab === 'updates' && (
          <div style={{ animation: 'fadeUp .16s ease' }}>
            {canEdit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button type="button" onClick={() => { setUpdDraft(''); setUpdOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة تحديث', 'Add update')}
                </button>
              </div>
            )}
            <div style={{ position: 'relative', paddingInlineStart: 22 }}>
            <div style={{ position: 'absolute', insetInlineStart: 5, top: 4, bottom: 4, width: 2, background: '#eef0ec' }} />
            {timeline.map((u, i) => (
              <div key={i} style={{ position: 'relative', paddingBottom: 18 }}>
                <div style={{ position: 'absolute', insetInlineStart: -21, top: 3, width: 11, height: 11, borderRadius: '50%', background: '#a9791f', border: '2px solid #fff', boxShadow: '0 0 0 2px #eef0ec' }} />
                <div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 3 }}>{dl(u.date)} — {tr(u.by)}</div>
                <div style={{ fontSize: 13, color: '#2a332d', lineHeight: 1.6 }}>{tr(u.text)}</div>
              </div>
            ))}
            {timeline.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('up_empty')}</div>}
            </div>
          </div>
        )}

        {pdTab === 'risks' && (
          <div style={{ animation: 'fadeUp .16s ease' }}>
            {riskN > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 13 }}>
                <div style={{ background: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.7)', borderInlineStart: '4px solid ' + (highRisk ? '#b0433b' : '#a9791f'), borderRadius: 12, padding: '15px 17px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 10px', background: highRisk ? '#f7e6e4' : '#fbf0d6', color: highRisk ? '#b0433b' : '#a9791f' }}>{t('pd_severity')} {highRisk ? rl('عالية', 'High') : rl('متوسطة', 'Medium')}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '4px 10px', background: '#f0f3ee', color: '#3c4a42' }}>{highRisk ? rl('مفتوح', 'Open') : rl('قيد المعالجة', 'Mitigating')}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#17211c', lineHeight: 1.5, marginBottom: 9 }}>{tr(p.risks || '')}</div>
                  <div style={{ fontSize: 11.5, color: '#7d867f' }}>{t('pd_respons')}: {tr(p.owner)}</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('pd_noRisks')}</div>
            )}
          </div>
        )}

        {pdTab === 'directives' && (
          <div style={{ animation: 'fadeUp .16s ease' }}>
            {canApprove && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button type="button" onClick={openDir} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{t('pd_addDirNew')}
                </button>
              </div>
            )}
            {dirsRaw.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {dirsRaw.map((d, i) => {
                  const dm: Record<string, [string, string]> = { 'جديد': ['#e3edf6', '#2f6aa8'], 'قيد التنفيذ': ['#fbf0d6', '#a9791f'], 'منفَّذ': ['#e2f0e8', '#2e7d55'] };
                  const [sb, sf] = dm[d.status || 'جديد'] || dm['جديد'];
                  return (
                    <div key={i} style={{ background: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 14, padding: '15px 17px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#9aa39b' }}>{dl(d.date)} — {tr(d.by)}</div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 10px', background: sb, color: sf }}>{tr(d.status || 'جديد')}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: '#2a332d', lineHeight: 1.65 }}>{tr(d.text)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('pd_noDir')}</div>
            )}
          </div>
        )}

        {pdTab === 'files' && (
          <div style={{ animation: 'fadeUp .16s ease' }}>
            {canEdit && (
              <div style={{ marginBottom: 14 }}>
                <FileUploadField files={attachStaged} onChange={setAttachStaged} />
                {attachStaged.length > 0 && (
                  <button type="button" onClick={() => { const fs = attachStaged; mutate((d) => { const pr = d.projects.find((x) => x.id === id); if (pr) pr.attachments = [...(pr.attachments || []), ...fs]; }); setAttachStaged([]); showToast(rl('تمت إضافة المرفقات إلى المشروع', 'Attachments added to the project')); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('حفظ المرفقات في المشروع', 'Save attachments to project')} ({attachStaged.length})
                  </button>
                )}
              </div>
            )}
            {attachments.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
                {attachments.map((fn, i) => {
                  const s = String(fn).toLowerCase();
                  const xl = s.endsWith('.xlsx') || s.endsWith('.xls');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 13, padding: '13px 15px' }}>
                      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: xl ? '#e2f0e8' : '#f7e6e4', color: xl ? '#2e7d55' : '#b0433b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2a332d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(fn)}</div>
                        <div style={{ fontSize: 10.5, color: '#9aa39b' }}>{xl ? 'Excel' : 'PDF'}</div>
                      </div>
                      <AttachmentDownload name={String(fn)} size={26} />
                      {canEdit && (
                        <button type="button" title={rl('إزالة المرفق', 'Remove attachment')} onClick={() => { mutate((d) => { const pr = d.projects.find((x) => x.id === id); if (pr) pr.attachments = (pr.attachments || []).filter((_, x) => x !== i); }); showToast(rl('تمت إزالة المرفق', 'Attachment removed')); }} style={{ flex: 'none', width: 24, height: 24, border: 'none', borderRadius: 7, background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 13 }}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('pd_noFiles')}</div>
            )}
          </div>
        )}
      </div>

      {/* FULL EDIT MODAL (all project components) */}
      {editOpen && <ProjectEditModal project={p} onClose={() => setEditOpen(false)} />}

      {/* ADD UPDATE MODAL */}
      <Modal open={updOpen} onClose={() => setUpdOpen(false)} width={480}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 700, color: '#17211c' }}>{rl('إضافة تحديث للمشروع', 'Add a project update')}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>{tr(p.name)}</p>
        <textarea value={updDraft} onChange={(e) => setUpdDraft(e.target.value)} rows={4} autoFocus placeholder={rl('اكتب التحديث…', 'Write the update…')}
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 11, padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setUpdOpen(false)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
          <button type="button" onClick={() => {
            const v = updDraft.trim(); if (!v) return;
            mutate((d) => { const pr = d.projects.find((x) => x.id === id); if (pr) { (pr.timeline = pr.timeline || []).unshift({ text: v, by: cu.name, date: 'اليوم' }); pr.lastDate = 'اليوم'; } });
            setUpdOpen(false); showToast(rl('أُضيف التحديث إلى سجل المشروع', 'Update added to the project log'));
          }} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إضافة التحديث', 'Add update')}</button>
        </div>
      </Modal>

      {/* CONFIRM MODAL */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} width={400}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: '#e2f0e8', color: '#2e7d55', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#17211c' }}>{t('pd_confirmTitle')}</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#7d867f', lineHeight: 1.6 }}>{t('pd_confirmMsg')}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={approveCompletion} style={{ flex: 1, background: '#2e7d55', color: '#fff', border: 'none', borderRadius: 11, padding: 12, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_confirmYes')}</button>
            <button type="button" onClick={() => setConfirmOpen(false)} style={{ flex: 1, background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 11, padding: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_cancel')}</button>
          </div>
        </div>
      </Modal>

      {/* RETURN MODAL */}
      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} width={440}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{reopenMode ? rl('إعادة عرض التفاصيل', 'Reopen project') : rl('إرجاع المشروع إلى قيد التنفيذ', 'Return project to in-progress')}</h3>
        <p style={{ margin: '0 0 15px', fontSize: 12.5, color: '#7d867f', lineHeight: 1.6 }}>{t('pd_returnHint')}</p>
        <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 7 }}>{t('pd_newStatus')}</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 15 }}>
          {['قيد التنفيذ', 'غير مكتمل', 'يحتاج متابعة'].map((m) => {
            const on = returnStatus === m;
            return <button key={m} type="button" onClick={() => setReturnStatus(m)} style={{ borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid ' + (on ? '#1e4634' : '#e2e6df'), background: on ? '#e9f0ec' : '#ffffff', color: on ? '#1e4634' : '#7d867f' }}>{tr(m)}</button>;
          })}
        </div>
        <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 5 }}>{t('pd_returnReason')}</div>
        <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder={t('pd_returnReasonPh')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '11px 13px', fontSize: 12.5, fontFamily: 'inherit', marginBottom: 13 }} />
        <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 5 }}>{t('pd_returnNote')}</div>
        <textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder={t('pd_returnNotePh')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '11px 13px', fontSize: 12.5, fontFamily: 'inherit', minHeight: 76, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={doReturn} style={{ flex: 1, background: '#b0433b', color: '#fff', border: 'none', borderRadius: 11, padding: 12, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_returnConfirm')}</button>
          <button type="button" onClick={() => setReturnOpen(false)} style={{ flex: 'none', background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 11, padding: '12px 20px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_cancel')}</button>
        </div>
      </Modal>

      {/* ADD DIRECTIVE MODAL */}
      <Modal open={dirOpen} onClose={() => setDirOpen(false)} width={460}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: '#e9f0ec', color: '#1f4a37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#17211c' }}>{t('pd_dirTitle')}</h3>
        </div>
        <p style={{ margin: '0 0 15px', fontSize: 12.5, color: '#7d867f', lineHeight: 1.6 }}>{t('pd_dirMsg')}</p>
        <textarea value={dirDraft} onChange={(e) => setDirDraft(e.target.value)} placeholder={t('pd_dirPh')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 11, padding: '12px 14px', fontSize: 13, fontFamily: 'inherit', minHeight: 110, resize: 'vertical', lineHeight: 1.7, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={saveDir} style={{ flex: 1, background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 11, padding: 12, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_dirSave')}</button>
          <button type="button" onClick={() => setDirOpen(false)} style={{ flex: 'none', background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 11, padding: '12px 20px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_cancel')}</button>
        </div>
      </Modal>

      {/* EDIT END DATE MODAL */}
      <Modal open={endOpen} onClose={() => setEndOpen(false)} width={420}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{rl('تعديل تاريخ النهاية', 'Edit end date')}</h3>
        <p style={{ margin: '0 0 15px', fontSize: 12.5, color: '#7d867f', lineHeight: 1.6 }}>{rl('اكتب تاريخ النهاية الجديد (مثال: 4 أغسطس 2026).', 'Enter the new end date (e.g. 4 أغسطس 2026).')}</p>
        <DateField value={endDraft} onChange={setEndDraft} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={saveEnd} style={{ flex: 1, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: 12, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ', 'Save')}</button>
          <button type="button" onClick={() => setEndOpen(false)} style={{ flex: 'none', background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 11, padding: '12px 20px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t('pd_cancel')}</button>
        </div>
      </Modal>
    </Fade>
  );
}

const STAGE_STATUS = ['لم يبدأ', 'قيد التنفيذ', 'مكتمل', 'متأخر'];

/** Timeline / Gantt tab: month axis, dashed today line, overdue highlighting, 5-month min span. */
function TimelineTab({ p, en, rl, tr, t, canEdit, withP, showToast }: {
  p: Project; en: boolean; rl: (a: string, b: string) => string; tr: (s: string) => string; t: (k: string) => string;
  canEdit: boolean; withP: (fn: (proj: Project) => void) => void; showToast: (m: string) => void;
}) {
  const [newStage, setNewStage] = useState('');
  const addStage = () => {
    const name = newStage.trim();
    if (!name) { showToast(rl('اكتب اسم المرحلة أولاً', 'Enter a stage name first')); return; }
    withP((proj) => { (proj.tasks = proj.tasks || []).push({ name, owner: '', status: 'لم يبدأ' }); });
    setNewStage('');
    showToast(rl('تمت إضافة المرحلة إلى الجدول الزمني', 'Stage added to the timeline'));
  };
  const setStageStatus = (i: number, status: string) => withP((proj) => { if (proj.tasks && proj.tasks[i]) proj.tasks[i].status = status; });
  const setStageOwner = (i: number, owner: string) => withP((proj) => { if (proj.tasks && proj.tasks[i]) proj.tasks[i].owner = owner; });
  const delStage = (i: number) => withP((proj) => { if (proj.tasks) proj.tasks.splice(i, 1); });
  const _en = parseAr(p.dueDate || '');
  const _st = p.startDate ? parseAr(p.startDate) : projRange(p).start;
  let me = _en || new Date((_st || APP_TODAY).getTime() + 120 * 86400000);
  let ms = _st || new Date(me.getTime() - 120 * 86400000);
  // enforce a readable span of at least ~5 months so the axis never collapses
  const MIN_SPAN = 150 * 86400000;
  if (me.getTime() - ms.getTime() < MIN_SPAN) ms = new Date(me.getTime() - MIN_SPAN);
  const rs = new Date(ms.getFullYear(), ms.getMonth(), 1);
  const re = new Date(me.getFullYear(), me.getMonth() + 1, 0);
  const rms = Math.max(1, re.getTime() - rs.getTime());
  const frac = (d: Date) => Math.max(0, Math.min(1, (d.getTime() - rs.getTime()) / rms));

  const months: string[] = [];
  { let c = new Date(rs); let g = 0; while (c <= re && g < 36) { months.push(monthName(c.getMonth(), en) + " '" + String(c.getFullYear()).slice(2)); c = new Date(c.getFullYear(), c.getMonth() + 1, 1); g++; } }

  const span = Math.max(1, me.getTime() - ms.getTime());
  const NT = (p.tasks || []).length || 1;
  const pal: Record<string, [string, string, string, string, string, string, string]> = {
    ok: ['#e8f2ea', '#3f8f4f', rl('مكتملة', 'Done'), '#e2f0e8', '#2e7d55', '#f6faf7', '#e2efe7'],
    prog: ['#e2ecf5', '#2f6aa8', rl('قيد التنفيذ', 'In progress'), '#e3edf6', '#2f6aa8', '#f5f8fc', '#dbe6f2'],
    late: ['#f6dedb', '#b0433b', rl('متأخرة', 'Delayed'), '#f7e6e4', '#b0433b', '#fdf6f5', '#f2ddda'],
    wait: ['#eceeeb', '#8a938c', rl('لم تبدأ', 'Not started'), '#eceeeb', '#6d7973', '#f8f9f7', '#e8ebe6'],
  };
  const milestones = (p.tasks || []).map((tk, i) => {
    const s = new Date(ms.getTime() + span * i / NT);
    const e = new Date(ms.getTime() + span * (i + 1) / NT);
    const kind = tk.status === 'مكتمل' ? 'ok' : tk.status === 'متأخر' ? 'late' : tk.status === 'قيد التنفيذ' ? 'prog' : 'wait';
    const pct = tk.status === 'مكتمل' ? 100 : tk.status === 'قيد التنفيذ' ? 55 : tk.status === 'متأخر' ? 35 : 0;
    const c = pal[kind];
    return {
      name: tr(tk.name), start: monthName(s.getMonth(), en), end: monthName(e.getMonth(), en) + ' ' + e.getFullYear(),
      pct, status: c[2], barBg: c[0], barFill: c[1], stBg: c[3], stFg: c[4], bg: c[5], border: c[6],
      barRight: (frac(s) * 100).toFixed(2) + '%', barWidth: ((frac(e) - frac(s)) * 100).toFixed(2) + '%',
      flag: kind === 'late', note: kind === 'late' ? rl('هذه المرحلة متأخرة عن جدولها.', 'This milestone is behind schedule.') : '',
    };
  });
  const flags = milestones.filter((m) => m.flag);
  const todayInRange = APP_TODAY >= rs && APP_TODAY <= re;
  const todayRight = (frac(APP_TODAY) * 100).toFixed(2) + '%';

  return (
    <div style={{ animation: 'fadeUp .16s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#17211c' }}>{t('pd_milestones')}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#8a938c', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 9, borderRadius: 3, background: '#3f8f4f' }} />{t('pd_onTrack')}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 9, borderRadius: 3, background: '#2f6aa8' }} />{t('pd_inProg')}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 9, borderRadius: 3, background: '#b0433b' }} />{t('pd_delayed')}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 0, height: 14, borderInlineStart: '2px dashed #b0433b' }} />{t('pd_today')}</span>
        </div>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: '#8a938c', lineHeight: 1.7 }}>{t('pd_ganttNote')}</p>
      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ minWidth: 680 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', marginBottom: 10 }}>
            <div />
            <div style={{ display: 'flex', direction: 'rtl', borderBottom: '1px solid #eef0ec', paddingBottom: 6 }}>
              {months.map((mo, i) => <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: '#9aa39b', whiteSpace: 'nowrap' }}>{mo}</div>)}
            </div>
          </div>
          {milestones.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '190px 1fr', alignItems: 'center', padding: '7px 0' }}>
              <div style={{ paddingInlineStart: 14, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{m.start} ← {m.end} · {m.pct}%</div>
              </div>
              <div style={{ position: 'relative', height: 34, direction: 'rtl' }}>
                {todayInRange && <div style={{ position: 'absolute', top: -3, bottom: -3, right: todayRight, width: 0, borderInlineStart: '2px dashed #b0433b', zIndex: 3 }} />}
                <div style={{ position: 'absolute', top: 6, height: 22, right: m.barRight, width: m.barWidth, background: m.barBg, borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: m.pct + '%', background: m.barFill }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {flags.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {flags.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: m.bg, border: '1px solid ' + m.border, borderRadius: 11, padding: '11px 14px' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', flex: 'none', background: m.stBg, color: m.stFg }}>{m.status}</span>
              <div style={{ fontSize: 12, color: '#3c4a42', lineHeight: 1.6 }}><strong style={{ color: '#17211c' }}>{m.name}:</strong> {m.note}</div>
            </div>
          ))}
        </div>
      )}

      {/* Stages editor — the source of the Gantt bars. Each stage becomes one bar,
          laid out evenly across the project's start→due span and colored by status. */}
      {canEdit && (
        <div style={{ marginTop: 26, borderTop: '1px solid #eef0ec', paddingTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{ width: 6, height: 20, borderRadius: 4, background: '#1e4634' }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#17211c' }}>{rl('مراحل المشروع (تُغذّي الجدول الزمني)', 'Project stages (feed the timeline)')}</h3>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 11.5, color: '#8a938c', lineHeight: 1.7 }}>
            {rl('أضِف مرحلة لكل شريط في المخطط. تُوزَّع المراحل تلقائيًا على المدة بين تاريخ البدء وتاريخ الانتهاء، ويتحدَّد لون الشريط ونسبة تعبئته حسب الحالة.', 'Add a stage for each bar. Stages spread automatically across the start→due span; each bar’s color and fill come from its status.')}
          </p>

          {(p.tasks || []).length === 0 && (
            <div style={{ background: '#f7f8f6', border: '1px dashed #d6ddd4', borderRadius: 11, padding: '14px 16px', fontSize: 12.5, color: '#5b6b62', marginBottom: 12 }}>
              {rl('لا توجد مراحل بعد — أضِف أول مرحلة ليظهر الجدول الزمني.', 'No stages yet — add the first stage to draw the timeline.')}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {(p.tasks || []).map((tk, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 150px 150px 34px', alignItems: 'center', gap: 8, background: '#fbfcfb', border: '1px solid #eef0ec', borderRadius: 11, padding: '8px 10px' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: '#eef2ee', color: '#1e4634', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <input value={tk.name} onChange={(e) => withP((proj) => { if (proj.tasks && proj.tasks[i]) proj.tasks[i].name = e.target.value; })} placeholder={rl('اسم المرحلة', 'Stage name')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' }} />
                <input value={tk.owner || ''} onChange={(e) => setStageOwner(i, e.target.value)} placeholder={rl('المسؤول (اختياري)', 'Owner (optional)')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' }} />
                <Dropdown value={tk.status} options={STAGE_STATUS.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setStageStatus(i, v)} opt={{ block: true, size: 'sm' }} />
                <button onClick={() => delStage(i)} title={rl('حذف', 'Delete')} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #f0dcd9', background: '#fdf6f5', color: '#b0433b', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newStage} onChange={(e) => setNewStage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addStage(); }} placeholder={rl('اسم مرحلة جديدة…', 'New stage name…')} style={{ flex: 1, boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' }} />
            <button onClick={addStage} style={{ background: '#1e4634', border: '1px solid #1e4634', color: '#fff', borderRadius: 9, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{rl('إضافة مرحلة', 'Add stage')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
