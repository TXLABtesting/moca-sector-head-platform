import { useEffect, useRef, useState } from 'react';
import { Fade, Card, Badge, Modal } from '../components/ui';
import { useStore } from '../store/store';
import { triggerDownload } from '../shared/fileGen';
import { makeXlsx, fileToBlocks, parseBulk, alias, pick } from './reportcenter/templateIO';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useToast } from '../components/Toast';
import { initials, memberImg, asset } from '../shared/helpers';
import { ownedBy, pushUpdateReq } from './member/workflow';
import { Dropdown } from '../components/Dropdown';
import { DateField } from '../components/DateField';
import { FileUploadField } from '../components/FileUploadField';
import type { Committee, CommitteeMeeting, CommitteeTask, CommitteeDecision } from '../data/types';
import { SectionAddButton } from '../components/SectionAddButton';

/* ---- status / colour maps (ported verbatim from the prototype) ---- */
const STC: Record<string, [string, string]> = {
  'نشطة': ['#e2f0e8', '#2e7d55'],
  'تحتاج متابعة': ['#fbf3df', '#8a6a1f'],
  'لا توجد اجتماعات': ['#eceae6', '#8a8078'],
  'مهام متأخرة': ['#f7e6e4', '#b0433b'],
  'ملغاة': ['#f0e6e4', '#9a3a2b'],
};
const TSK: Record<string, [string, string, string]> = {
  'مكتمل': ['#e2f0e8', '#2e7d55', '#2e7d55'],
  'قيد التنفيذ': ['#fbf0d6', '#a9791f', '#a9791f'],
  'متأخر': ['#f7e6e4', '#b0433b', '#b0433b'],
  'لم يبدأ': ['#eceae6', '#8a8078', '#c3cec4'],
};
const DEC_KIND: Record<string, [string, string]> = {
  'حالي': ['#e2f0e8', '#2e7d55'],
  'سابق': ['#eef3f6', '#2f6aa8'],
  'ملغى': ['#f0e6e4', '#9a3a2b'],
};
const stc = (s: string): [string, string] => STC[s] || ['#f2f4f0', '#6d7973'];

/* ---- KPI card icons (custom paths from the prototype's _icons) ---- */
const KPI_ICONS: Record<string, string> = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
};

const openTaskCount = (c: Committee): number => {
  let n = 0;
  (c.meetings || []).forEach((m) => (m.tasks || []).forEach((t) => { if (t.status !== 'مكتمل') n++; }));
  return n;
};
const lastMeeting = (c: Committee): string => (c.meetings && c.meetings.length ? c.meetings[0].date : '—');

interface Preview { num: string; year: string; cancelled: boolean; img: string }

export function Committees() {
  const data = useStore((s) => s.data);
  const committees = data.committees;
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const canApprove = can(cu, 'committees', 'approve');
  const { showToast } = useToast();
  const mutate = useStore((s) => s.mutate);

  // ---- bulk import (one committee per row) ----
  const CM_FREQ = ['أسبوعية', 'نصف شهرية', 'شهرية', 'ربع سنوية', 'نصف سنوية', 'سنوية', 'حسب الحاجة'];
  const CM_STATUS = ['نشطة', 'متوقفة', 'منتهية'];
  const CM_COLS = [
    { field: 'name', match: alias('اسم اللجنة', 'اللجنة', 'الاسم') },
    { field: 'chair', match: alias('الرئيس', 'رئيس اللجنة') },
    { field: 'rapporteur', match: alias('المقرر', 'مقرر اللجنة') },
    { field: 'purpose', match: alias('الغرض', 'الهدف', 'المهام') },
    { field: 'freq', match: alias('الدورية', 'التكرار'), norm: pick(CM_FREQ, 'شهرية') },
    { field: 'reqMeetings', match: alias('عدد الاجتماعات', 'الاجتماعات المطلوبة') },
    { field: 'cat', match: alias('الفئة', 'النوع', 'التصنيف') },
    { field: 'status', match: alias('الحالة'), norm: pick(CM_STATUS, 'نشطة') },
    { field: 'members', match: alias('الأعضاء', 'أعضاء اللجنة', 'الأعضاء (يفصل بينهم فاصلة)') },
  ];
  const splitMembers = (s: string): string[] => String(s || '').split(/[،,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const CM_HEADERS = ['اسم اللجنة', 'الرئيس', 'المقرر', 'الغرض', 'الدورية', 'عدد الاجتماعات المطلوبة', 'الفئة', 'الحالة', 'الأعضاء (يفصل بينهم فاصلة)'];
  const CM_EXAMPLE = ['لجنة الأمن السيبراني', 'رئيس القطاع', 'سماح أبو شرخ', 'متابعة أمن المعلومات', 'شهرية', '12', 'لجنة دائمة', 'نشطة', 'أحمد المنصوري، فاطمة الحمادي، سعيد النعيمي'];
  const bulkRef = useRef<HTMLInputElement>(null);
  const dlCommitteeBulk = () => triggerDownload(makeXlsx([CM_HEADERS, CM_EXAMPLE], 'اللجان'), 'Committees_Bulk_Template.xlsx');
  const onBulk = async (file: File) => {
    try {
      const blocks = await fileToBlocks(file);
      const rows = blocks ? parseBulk(blocks.tables, CM_COLS, (r) => !!r.name) : [];
      if (!rows.length) { showToast(rl('لم يُعثر على لجان في الملف — تأكد من مطابقة الأعمدة للقالب', 'No committees found — check the template columns')); return; }
      mutate((d) => {
        rows.forEach((r, i) => {
          const rec = {
            id: 'cm' + Date.now() + i, name: r.name, chair: r.chair || 'رئيس القطاع', rapporteur: r.rapporteur || cu.name,
            purpose: r.purpose || '', freq: r.freq || 'شهرية', reqMeetings: parseInt(r.reqMeetings, 10) || 0,
            actualMeetings: 0, created: '2026', reformed: '', status: r.status || 'نشطة', cat: r.cat || '', hasWorkPlan: false,
            absent: [], scores: { outputs: 0, minutes: 0, meetings: 0, teamwork: 0 }, statement: '', improvements: [],
            recommendation: '', members: splitMembers(r.members), decisions: [], meetings: [], _mowner: cu.id,
          } as unknown as Committee;
          d.committees.unshift(rec);
        });
      });
      showToast(rl('تم استيراد ', 'Imported ') + rows.length + rl(' لجنة', ' committees'));
    } catch {
      showToast(rl('تعذّر استيراد الملف', 'Import failed'));
    }
  };

  // Committee Management Officer: full list + add/edit/send.
  // Committee Coordinator: only committees assigned as rapporteur, with
  // meeting/minutes/tasks management inside them.
  const isChair = cu.type === 'chair';
  const manage = !isChair && (can(cu, 'committees', 'add') || can(cu, 'committees', 'edit'));
  const assigned = committees.filter((c) => ownedBy(c.rapporteur || '', cu.name));
  const coordinator = !isChair && !manage && assigned.length > 0;
  const visible = coordinator ? assigned : committees;
  const coordOf = (c: Committee) => !isChair && (manage || ownedBy(c.rapporteur || '', cu.name));
  const [cForm, setCForm] = useState<{ id: string | null } | null>(null);
  const [mForm, setMForm] = useState<{ cid: string; no: string | null } | null>(null);

  const [selId, setSelId] = useState<string | null>(null);
  const { params } = useNav();
  useEffect(() => {
    const t = params.selCommittee as string | undefined;
    if (t) setSelId(t);
  }, [params.selCommittee]);
  const [tab, setTab] = useState<'summary' | 'meetings' | 'decisions' | 'members'>('summary');
  const [preview, setPreview] = useState<Preview | null>(null);

  const openC = (id: string) => { setSelId(id); setTab('summary'); };
  const toList = () => setSelId(null);

  const cur = selId ? committees.find((c) => c.id === selId) || committees[0] : null;

  return (
    <Fade>
      <div style={{ fontFamily: "'IBM Plex Sans Arabic',sans-serif", color: '#17211c' }}>
        {!cur && (
          <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('اللجان وفرق العمل', 'Committees & work teams')}</h1>
              <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>
                {coordinator
                  ? rl('اللجان المسندة إليك كمقرر — إدارة الاجتماعات والمحاضر والمهام وإرسالها للمراجعة', 'Committees assigned to you as rapporteur — manage meetings, minutes and tasks')
                  : rl('متابعة اللجان وقراراتها واجتماعاتها', 'Committees, their decisions and meetings')}
              </p>
            </div>
            {manage && (
              <div className="page-head-action" style={{ flex: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={dlCommitteeBulk} title={rl('تنزيل قالب إكسيل بصف لكل لجنة', 'Template: one committee per row')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 11, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>{rl('قالب الاستيراد', 'Import template')}
                </button>
                <input ref={bulkRef} type="file" accept=".xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onBulk(f); e.target.value = ''; }} />
                <button onClick={() => bulkRef.current?.click()} title={rl('رفع ملف إكسيل يحتوي عدة لجان دفعة واحدة', 'Upload many committees at once')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef4ef', color: '#1e4634', border: '1px solid #cdd8ce', borderRadius: 11, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9m0 0-4 4m4-4 4 4M5 3h14" /></svg>{rl('استيراد دفعة', 'Bulk import')}
                </button>
                <button onClick={() => setCForm({ id: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  {rl('إضافة لجنة', 'New committee')}
                </button>
              </div>
            )}
          </div>
        )}
        {!cur && <ListView committees={visible} rl={rl} tr={tr} dl={dl} openC={openC} />}
        {cur && (
          <DetailView
            canManage={manage}
            canCoord={coordOf(cur)}
            onEditCommittee={() => setCForm({ id: cur.id })}
            onAddMeeting={() => setMForm({ cid: cur.id, no: null })}
            onEditMeeting={(no: string) => setMForm({ cid: cur.id, no })}
            c={cur} tab={tab} setTab={setTab} onBack={toList}
            canApprove={canApprove} showToast={showToast}
            rl={rl} tr={tr} dl={dl} onPreview={setPreview}
          />
        )}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} width={560} padded={false}>
        {preview && (
          <>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #eef0ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: '#17211c' }}>
                {rl('معاينة القرار — رقم', 'Decision preview — No.')} ({preview.num})
              </h2>
              <button onClick={() => setPreview(null)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15, flex: 'none' }}>✕</button>
            </div>
            <div style={{ padding: 22 }}>
              {preview.cancelled && (
                <div style={{ background: '#f7e6e4', color: '#b0433b', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
                  {rl('هذا القرار ملغى', 'This decision is cancelled')}
                </div>
              )}
              {preview.img ? (
                <img src={asset(preview.img)} alt="" style={{ width: '100%', border: '1px solid #e6ece7', borderRadius: 12, display: 'block' }} />
              ) : (
                <div style={{ border: '1px solid #e6ece7', borderRadius: 12, background: '#fbfcfb', aspectRatio: '1 / 1.28', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#9aa39b' }}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c3cec4" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9.5 13h6M9.5 16.5h6" /></svg>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#5b6b62', textAlign: 'center', lineHeight: 1.7 }}>
                    {rl('صورة القرار رقم', 'Image of decision No.')} ({preview.num}) {rl('لسنة', 'of')} {preview.year}<br />
                    <span style={{ fontSize: 11, color: '#9aa39b' }}>{rl('لم تُرفق صورة رسمية لهذا القرار', 'No official image attached for this decision')}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
      {cForm && <CommitteeFormModal committeeId={cForm.id} onClose={() => setCForm(null)} />}
      {mForm && <CommitteeMeetingModal cid={mForm.cid} meetingNo={mForm.no} onClose={() => setMForm(null)} />}
    </Fade>
  );
}

/* ================= LIST ================= */
function ListView({ committees, rl, tr, dl, openC }: {
  committees: Committee[];
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
  dl: (s: string) => string;
  openC: (id: string) => void;
}) {
  const withOpen = committees.filter((c) => openTaskCount(c) > 0).length;
  let lateN = 0, mThisMonth = 0, decN = 0;
  committees.forEach((c) => {
    (c.meetings || []).forEach((m) => {
      (m.tasks || []).forEach((t) => { if (t.status === 'متأخر') lateN++; });
      if (/يونيو|July|يوليو/.test(m.date)) mThisMonth++;
    });
    decN += (c.decisions || []).length;
  });

  const kpis = [
    { v: String(committees.length), l: rl('إجمالي اللجان التي أترأسها', 'Committees I chair'), c: '#1f4a37', bg: '#e9f0ec', icon: 'list' },
    { v: String(withOpen), l: rl('لجان بمهام مفتوحة', 'Committees with open tasks'), c: '#3a6ea5', bg: '#e9f0f6', icon: 'folder' },
    { v: String(lateN), l: rl('مهام متأخرة', 'Overdue tasks'), c: '#b0433b', bg: '#f7e6e4', icon: 'alert' },
    { v: String(mThisMonth), l: rl('اجتماعات هذا الشهر', 'Meetings this month'), c: '#a9791f', bg: '#fbf3df', icon: 'cal' },
    { v: String(decN), l: rl('قرارات مرفقة', 'Attached decisions'), c: '#7a4d94', bg: '#f3ecf6', icon: 'doc' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="glass" style={{ border: '1px solid rgba(255,255,255,.7)', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -22px rgba(23,40,32,.14)', padding: '15px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.c }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: KPI_ICONS[k.icon] }} />
            </span>
            <div>
              <div style={{ fontSize: 25, fontWeight: 800, color: '#17211c', letterSpacing: '-.5px', lineHeight: 1 }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: '#6d7973', marginTop: 5, lineHeight: 1.4 }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
        {committees.map((c) => {
          const [stBg, stFg] = stc(c.status);
          const open = openTaskCount(c);
          return (
            <div key={c.id} className="glass" style={{ border: '1px solid rgba(255,255,255,.7)', borderRadius: 15, padding: '16px 17px', boxShadow: '0 10px 36px -18px rgba(30,60,40,.18)', display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#17211c', lineHeight: 1.55 }}>{tr(c.name)}</div>
                <Badge bg={stBg} fg={stFg} style={{ flex: 'none', fontSize: 10, padding: '4px 10px' }}>{tr(c.status)}</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, borderTop: '1px solid #eef1ec', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#3c4a42' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  <span style={{ color: '#9aa39b', fontWeight: 500 }}>{rl('المقرر', 'Rapporteur')}</span>
                  <span style={{ fontWeight: 700, color: '#17211c' }}>{tr(c.rapporteur)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#3c4a42' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
                  <span style={{ color: '#9aa39b', fontWeight: 500 }}>{rl('آخر اجتماع', 'Last meeting')}</span>
                  <span style={{ fontWeight: 700, color: '#17211c' }}>{dl(lastMeeting(c))}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 10, borderTop: '1px dashed #eef1ec' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#1f4a37', letterSpacing: '-.3px' }}>{String((c.meetings || []).length)}</span>
                    <span style={{ fontSize: 12, color: '#7d867f', fontWeight: 500 }}>{rl('اجتماع', 'meetings')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: open > 0 ? '#b0433b' : '#2e7d55', letterSpacing: '-.3px' }}>{String(open)}</span>
                    <span style={{ fontSize: 12, color: '#7d867f', fontWeight: 500 }}>{rl('مهمة مفتوحة', 'open tasks')}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => openC(c.id)} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('عرض التفاصيل', 'View details')}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= DETAIL ================= */
function DetailView({ c, tab, setTab, onBack, canApprove, canManage, canCoord, onEditCommittee, onAddMeeting, onEditMeeting, showToast, rl, tr, dl, onPreview }: {
  c: Committee;
  tab: 'summary' | 'meetings' | 'decisions' | 'members';
  setTab: (t: 'summary' | 'meetings' | 'decisions' | 'members') => void;
  onBack: () => void;
  canApprove: boolean;
  canManage: boolean;
  canCoord: boolean;
  onEditCommittee: () => void;
  onAddMeeting: () => void;
  onEditMeeting: (no: string) => void;
  showToast: (m: string) => void;
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
  dl: (s: string) => string;
  onPreview: (p: Preview) => void;
}) {
  const [stBg, stFg] = stc(c.status);

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'summary', label: rl('الملخص', 'Summary') },
    { key: 'meetings', label: rl('الاجتماعات والمهام', 'Meetings & tasks') },
    { key: 'decisions', label: rl('القرارات المرفقة', 'Attached decisions') },
    { key: 'members', label: rl('الأعضاء والحضور', 'Members & attendance') },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 16 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><path d="M15 18l-6-6 6-6" /></svg>
        {rl('كل اللجان', 'All committees')}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800, lineHeight: 1.4, color: '#17211c' }}>{tr(c.name)}</h1>
          <div style={{ fontSize: 12.5, color: '#7d867f' }}>{rl('الرئيس', 'Chair')}: {tr(c.chair)} · {rl('المقرر', 'Rapporteur')}: {tr(c.rapporteur)}</div>
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge bg={stBg} fg={stFg} style={{ fontSize: 11, padding: '6px 14px' }}>{tr(c.status)}</Badge>
          {canManage && (
            <button onClick={onEditCommittee} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              {rl('تعديل اللجنة', 'Edit committee')}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, background: '#f2f4f0', borderRadius: 12, padding: 4, marginBottom: 18, flexWrap: 'wrap', width: 'fit-content' }}>
        {tabs.map((tb) => {
          const on = tab === tb.key;
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{ background: on ? '#1e4634' : 'transparent', color: on ? '#fff' : '#5b6b62', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 12.5, fontWeight: on ? 700 : 600, fontFamily: 'inherit', cursor: 'pointer' }}>{tb.label}</button>
          );
        })}
      </div>

      {tab === 'summary' && <SummaryTab c={c} rl={rl} tr={tr} dl={dl} />}
      {tab === 'meetings' && <MeetingsTab c={c} canApprove={canApprove} canCoord={canCoord} onAddMeeting={onAddMeeting} onEditMeeting={onEditMeeting} showToast={showToast} rl={rl} tr={tr} dl={dl} />}
      {tab === 'decisions' && <DecisionsTab c={c} rl={rl} tr={tr} dl={dl} onPreview={onPreview} />}
      {tab === 'members' && <MembersTab c={c} rl={rl} tr={tr} />}
    </div>
  );
}

/* ---- summary tab ---- */
function SummaryTab({ c, rl, tr, dl }: {
  c: Committee;
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
  dl: (s: string) => string;
}) {
  const dec0 = (c.decisions || [])[0];
  const facts: { k: string; v: string }[] = [
    { k: rl('الرئيس', 'Chair'), v: tr(c.chair) },
    { k: rl('المقرر', 'Rapporteur'), v: tr(c.rapporteur) },
    { k: rl('التصنيف / الغاية', 'Classification / purpose'), v: c.cat ? tr(c.cat) : '—' },
    { k: rl('رقم القرار الحالي', 'Current decision no.'), v: dec0 ? `(${dec0.num}) ${rl('لسنة', 'of')} ${dec0.year}` : '—' },
    { k: rl('تاريخ الإنشاء', 'Created'), v: c.created ? dl(c.created) : '—' },
    { k: rl('دورية الاجتماعات', 'Meeting frequency'), v: c.freq ? tr(c.freq) : '—' },
    { k: rl('الاجتماعات (فعلي / مطلوب)', 'Meetings (actual / required)'), v: `${c.actualMeetings || 0} / ${c.reqMeetings || 0}` },
    { k: rl('خطة عمل محددة مسبقاً', 'Predefined work plan'), v: c.hasWorkPlan ? rl('نعم', 'Yes') : rl('لا', 'No') },
    { k: rl('توثيق الاجتماعات بمحاضر', 'Minutes documentation'), v: `${(c.meetings || []).filter((m) => m.minutes).length} / ${(c.meetings || []).length || 0}` },
    { k: rl('الأعضاء غير المشاركين', 'Non-participating members'), v: (c.absent && c.absent.length) ? c.absent.map(tr).join('، ') : rl('لا يوجد', 'None') },
  ];

  const _sc = c.scores || { outputs: 0, minutes: 0, meetings: 0, teamwork: 0 };
  const scores = [
    { k: rl('المخرجات', 'Outputs'), v: _sc.outputs || 0 },
    { k: rl('المحاضر', 'Minutes'), v: _sc.minutes || 0 },
    { k: rl('عدد الاجتماعات', 'Meetings held'), v: _sc.meetings || 0 },
    { k: rl('تعاون الفريق', 'Teamwork'), v: _sc.teamwork || 0 },
  ];
  const barColor = (v: number) => (v >= 70 ? '#2e7d55' : v >= 40 ? '#a9791f' : '#b0433b');

  return (
    <Card style={{ borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 2px rgba(23,40,32,.04)' }}>
      <div style={{ background: '#f3f7f3', border: '1px solid #e4efe7', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#1f7a4e', fontWeight: 700, marginBottom: 6 }}>{rl('الغاية من التشكيل', 'Purpose of formation')}</div>
        <div style={{ fontSize: 13.5, color: '#2a332d', lineHeight: 1.7 }}>{tr(c.purpose)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11 }}>
        {facts.map((s, i) => (
          <div key={i} style={{ background: '#f7f9f7', border: '1px solid #eef1ec', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 5 }}>{s.k}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a332d', lineHeight: 1.5 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {scores.map((s, i) => (
          <div key={i} style={{ background: '#f7f9f7', border: '1px solid #eef1ec', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 11.5, color: '#5b6b62', fontWeight: 600 }}>{s.k}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#17211c' }}>{s.v}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 20, background: '#e6ece7', overflow: 'hidden' }}>
              <div style={{ width: `${s.v}%`, height: '100%', borderRadius: 20, background: barColor(s.v) }} />
            </div>
          </div>
        ))}
      </div>

      {c.statement && (
        <div style={{ marginTop: 16, background: '#f7f9f7', border: '1px solid #eef1ec', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#9aa39b', fontWeight: 700, marginBottom: 6 }}>{rl('البيان', 'Statement')}</div>
          <div style={{ fontSize: 13, color: '#2a332d', lineHeight: 1.7 }}>{tr(c.statement)}</div>
        </div>
      )}

      {(c.improvements || []).length > 0 && (
        <div style={{ marginTop: 12, background: '#fbf7ee', border: '1px solid #efe3c9', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#a9791f', fontWeight: 700, marginBottom: 8 }}>{rl('نقاط تطوير وتحسينية', 'Development & improvement points')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {c.improvements.map((ip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#6b5b1e', lineHeight: 1.6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a9791f', marginTop: 7, flex: 'none' }} />{tr(ip)}
              </div>
            ))}
          </div>
        </div>
      )}

      {c.recommendation && (
        <div style={{ marginTop: 12, background: '#eef4ef', border: '1px solid #d5e6da', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#1f7a4e', fontWeight: 700, marginBottom: 6 }}>{rl('التوصية لرئيس القطاع', 'Recommendation to the Sector Head')}</div>
          <div style={{ fontSize: 13, color: '#1e3c2c', lineHeight: 1.7 }}>{tr(c.recommendation)}</div>
        </div>
      )}
    </Card>
  );
}

/* ---- meetings + tasks tab ---- */
function MeetingsTab({ c, canApprove, canCoord, onAddMeeting, onEditMeeting, showToast, rl, tr, dl }: {
  c: Committee;
  canApprove: boolean;
  canCoord: boolean;
  onAddMeeting: () => void;
  onEditMeeting: (no: string) => void;
  showToast: (m: string) => void;
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
  dl: (s: string) => string;
}) {
  const mutate = useStore((s) => s.mutate);
  const [dirTarget, setDirTarget] = useState<{ mNo: string; ti: number } | null>(null);
  const [dirDraft, setDirDraft] = useState('');
  const reqUpdate = (owner: string, title: string) => { mutate((d) => pushUpdateReq(d, { owner, title, section: 'committees' })); showToast(rl('تم إرسال طلب تحديث — وصل إشعارٌ للمسؤول', 'Update request sent — the owner was notified')); };
  const mutateTask = (mNo: string, ti: number, fn: (t: CommitteeTask) => void) => mutate((d) => {
    const cc = d.committees.find((x) => x.id === c.id); if (!cc) return;
    const mm = (cc.meetings || []).find((x) => x.no === mNo); if (!mm) return;
    const tk = (mm.tasks || [])[ti]; if (tk) fn(tk);
  });
  const saveDirective = () => {
    const txt = dirDraft.trim();
    if (txt && dirTarget) {
      mutateTask(dirTarget.mNo, dirTarget.ti, (x) => { x.directive = txt; });
      showToast(rl('تمت إضافة التوجيه إلى المهمة', 'Directive added to the task'));
    }
    setDirTarget(null); setDirDraft('');
  };
  const toggleReviewed = (mNo: string, ti: number, cur: boolean) => { mutateTask(mNo, ti, (x) => { x.reviewed = !x.reviewed; }); showToast(cur ? rl('أُلغيت علامة المراجعة', 'Review mark removed') : rl('تم وضع علامة: تمت المراجعة', 'Marked as reviewed')); };
  const meetings = c.meetings || [];
  const addBtn = canCoord ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <button onClick={onAddMeeting} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        {rl('إضافة اجتماع جديد', 'New meeting')}
      </button>
    </div>
  ) : null;
  if (meetings.length === 0) {
    return (
      <div>
        {addBtn}
        <div style={{ background: '#fff', border: '1px dashed #d8dedb', borderRadius: 16, padding: 34, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>
          {rl('لا توجد اجتماعات مسجّلة لهذه اللجنة بعد.', 'No meetings recorded for this committee yet.')}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {addBtn}
      {meetings.map((m: CommitteeMeeting, mi) => (
        <div key={mi} style={{ border: '1px solid #e6ece7', borderRadius: 15, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(23,40,32,.04)' }}>
          <div style={{ background: '#f3f7f3', padding: '14px 16px', borderBottom: '1px solid #e6ece7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: '#1f4a37', background: '#e4efe7', borderRadius: 8, padding: '5px 11px' }}>{tr(m.no)} · {dl(m.date)}</span>
              <span style={{ fontSize: 11.5, color: '#5b6b62' }}>
                {rl('الحضور', 'Attendance')}: {m.present} {rl('من', 'of')} {m.total} · {m.minutes ? rl('يوجد محضر', 'Minutes available') : rl('لا يوجد محضر', 'No minutes')} · {(m.tasks || []).length} {rl('مهام ناتجة', 'resulting tasks')}
              </span>
              {canCoord && (
                <button onClick={() => onEditMeeting(m.no)} style={{ marginInlineStart: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 8, padding: '6px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  {rl('المحضر / تعديل', 'Minutes / edit')}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: '#3c4a42', lineHeight: 1.65 }}>{tr(m.points)}</div>
            {!!(m.absent && m.absent.length) && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#b0433b' }}>{rl('الغياب: ', 'Absent: ')}{m.absent.map((n) => tr(n)).join('، ')}</div>
            )}
            {!!(m.attachments && m.attachments.length) && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.attachments.map((a, ai) => (
                  <span key={ai} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e6ece7', borderRadius: 8, padding: '4px 9px', fontSize: 10.5, color: '#3c4a42' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            {(m.tasks || []).map((t: CommitteeTask, ti) => {
              const [tsBg, tsFg, dot] = TSK[t.status] || ['#f2f4f0', '#6d7973', '#c3cec4'];
              return (
                <div key={ti} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderBottom: '1px solid #f4f6f2', flexWrap: 'wrap' }}>
                  <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 5 }} />
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{tr(t.title)}</div>
                    <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 3 }}>{rl('المسؤول', 'Owner')}: {tr(t.owner)} · {rl('الإنجاز', 'Due')}: {dl(t.due)}</div>
                  </div>
                  {typeof t.prog === 'number' && (
                    <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, color: '#1f4a37', background: '#e9f0ec', borderRadius: 20, padding: '4px 10px' }}>{t.prog}%</span>
                  )}
                  <Badge bg={tsBg} fg={tsFg} style={{ flex: 'none', fontSize: 10, padding: '4px 10px' }}>{tr(t.status)}</Badge>
                  {canApprove && (
                    <div style={{ flex: 'none', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => { setDirTarget({ mNo: m.no, ti }); setDirDraft(t.directive || ''); }} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t.directive ? rl('تعديل التوجيه', 'Edit directive') : rl('إضافة توجيه', 'Add directive')}</button>
                      <button onClick={() => reqUpdate(t.owner, t.title)} style={{ background: '#f2f4f0', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 7, padding: '6px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('طلب تحديث', 'Request update')}</button>
                      <button onClick={() => toggleReviewed(m.no, ti, !!t.reviewed)} style={{ background: t.reviewed ? '#2e7d55' : '#e2f0e8', color: t.reviewed ? '#fff' : '#2e7d55', border: '1px solid #cce6d4', borderRadius: 7, padding: '6px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{t.reviewed ? rl('✓ تمت المراجعة', '✓ Reviewed') : rl('تمت المراجعة', 'Reviewed')}</button>
                    </div>
                  )}
                  {t.directive && (
                    <div style={{ flexBasis: '100%', fontSize: 11, color: '#6a5a2b', background: '#fbf7ee', border: '1px solid #ecdcae', borderRadius: 8, padding: '7px 11px', lineHeight: 1.6 }}><b>{rl('توجيه رئيس القطاع', 'Sector Head directive')}:</b> {tr(t.directive)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Modal open={dirTarget !== null} onClose={() => setDirTarget(null)} width={460}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 700, color: '#17211c' }}>{rl('توجيه رئيس القطاع', 'Sector Head directive')}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>{rl('يُحفظ التوجيه على مهمة اللجنة ويظهر أسفلها.', 'Saved on the committee task and shown beneath it.')}</p>
        <textarea value={dirDraft} onChange={(e) => setDirDraft(e.target.value)} rows={4} autoFocus
          placeholder={rl('اكتب التوجيه…', 'Write the directive…')}
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 11, padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={() => setDirTarget(null)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
          <button onClick={saveDirective} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ التوجيه', 'Save directive')}</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---- decisions tab ---- */
function DecisionsTab({ c, rl, tr, dl, onPreview }: {
  c: Committee;
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
  dl: (s: string) => string;
  onPreview: (p: Preview) => void;
}) {
  const decisions = c.decisions || [];
  if (decisions.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px dashed #d8dedb', borderRadius: 16, padding: 34, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>
        {rl('لا توجد قرارات مرفقة.', 'No attached decisions.')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap' }}>
      {decisions.map((d: CommitteeDecision, di) => {
        const [kBg, kFg] = DEC_KIND[d.kind] || ['#f2f4f0', '#6d7973'];
        const cancelled = d.kind === 'ملغى';
        return (
          <div key={di} style={{ border: '1px solid #eef1ec', borderRadius: 13, padding: '15px 17px', background: '#fff', minWidth: 210, flex: 1, display: 'flex', flexDirection: 'column', gap: 9, boxShadow: '0 1px 2px rgba(23,40,32,.04)', opacity: cancelled ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#17211c' }}>{rl('قرار رقم', 'Decision No.')} ({d.num})</span>
              <Badge bg={kBg} fg={kFg} style={{ flex: 'none', fontSize: 10, padding: '3px 9px' }}>{tr(d.kind)}</Badge>
            </div>
            <div style={{ fontSize: 11.5, color: '#7d867f' }}>{rl('لسنة', 'Year')} {d.year}{d.date ? ` · ${dl(d.date)}` : ''}</div>
            <button onClick={() => onPreview({ num: d.num, year: d.year, cancelled, img: d.img || '' })} style={{ background: '#eef3f6', color: '#2f6aa8', border: '1px solid #d8e4ee', borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('عرض القرار', 'View decision')}</button>
          </div>
        );
      })}
    </div>
  );
}

/* ---- members tab ---- */
function MembersTab({ c, rl, tr }: {
  c: Committee;
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
}) {
  const members = c.members || [];
  return (
    <Card style={{ borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 2px rgba(23,40,32,.04)' }}>
      <div style={{ fontSize: 12, color: '#9aa39b', fontWeight: 600, marginBottom: 12 }}>{rl('أعضاء اللجنة', 'Committee members')} ({members.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {members.map((name, i) => {
          const img = memberImg(name);
          const isR = String(c.rapporteur || '').indexOf(name) >= 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7f9f7', border: '1px solid #eef1ec', borderRadius: 11, padding: '10px 12px' }}>
              <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: '#1e4634', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' }}>
                {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} /> : initials(name)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c', lineHeight: 1.4 }}>{tr(name)}</div>
                {isR && <div style={{ fontSize: 10, color: '#a9791f', fontWeight: 700, marginTop: 1 }}>{rl('مقرر', 'Rapporteur')}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ================= COMMITTEE FORM (Management Officer) =================
   Full committee editor: info, coordinator, frequency, status, members and
   the formation/update decision (with upload). Saves to the SAME record the
   Sector Head sees; can send the update for chair review. */
function CommitteeFormModal({ committeeId, onClose }: { committeeId: string | null; onClose: () => void }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const existing = committeeId ? data.committees.find((c) => c.id === committeeId) : null;
  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    name: existing.name, chair: existing.chair, rapporteur: existing.rapporteur,
    purpose: existing.purpose || '', freq: existing.freq || '', status: existing.status || '',
    cat: existing.cat || '', reqMeetings: String(existing.reqMeetings ?? ''),
    decNum: '', decYear: '2026', decKind: 'قرار تشكيل',
  } : {
    name: '', chair: 'رئيس القطاع', rapporteur: cu.name, purpose: '', freq: 'شهرية',
    status: 'نشطة', cat: 'لجنة دائمة', reqMeetings: '12', decNum: '', decYear: '2026', decKind: 'قرار تشكيل',
  });
  const [members, setMembers] = useState<string[]>(() => (existing?.members ? [...existing.members] : []));
  const [memberInput, setMemberInput] = useState('');
  const addMember = (raw: string) => {
    // Accept several typed at once (comma / newline separated) — names may be
    // outside the suggestions list, so we never restrict to known people.
    const parts = String(raw).split(/[،,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setMembers((p) => { const next = [...p]; parts.forEach((n) => { if (!next.includes(n)) next.push(n); }); return next; });
    setMemberInput('');
  };
  const [decFiles, setDecFiles] = useState<string[]>([]);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const peopleOpts = Array.from(new Set([...data.members.map((m) => m.name), ...data.sectorManagers.map((m) => m.name)]));
  const freqOpts = Array.from(new Set(['أسبوعية', 'نصف شهرية', 'شهرية', 'ربع سنوية', ...(f.freq ? [f.freq] : [])]));
  const statusOpts = Array.from(new Set([...data.committees.map((c) => c.status), 'نشطة', ...(f.status ? [f.status] : [])])).filter(Boolean);

  const save = (send: boolean) => {
    const name = (f.name || '').trim();
    if (!name) { showToast(rl('يرجى إدخال اسم اللجنة', 'Please enter the committee name')); return; }
    mutate((d) => {
      let c: Committee & { _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] };
      if (existing) c = d.committees.find((x) => x.id === committeeId)! as never;
      else {
        c = { id: 'cm' + Math.floor(Math.random() * 1e9), name: '', chair: '', rapporteur: '', purpose: '', freq: '',
          reqMeetings: 0, actualMeetings: 0, created: '2026', reformed: '', status: 'نشطة', cat: '', hasWorkPlan: false,
          absent: [], scores: { outputs: 0, minutes: 0, meetings: 0, teamwork: 0 }, statement: '', improvements: [],
          recommendation: '', members: [], decisions: [], meetings: [] };
        d.committees.unshift(c);
        c._mowner = cu.id;
      }
      if (!c) return;
      c.name = name; c.chair = (f.chair || '').trim() || 'رئيس القطاع'; c.rapporteur = f.rapporteur || cu.name;
      c.purpose = (f.purpose || '').trim(); c.freq = f.freq; c.status = f.status; c.cat = (f.cat || '').trim();
      c.reqMeetings = parseInt(f.reqMeetings, 10) || 0;
      c.members = members;
      if ((f.decNum || '').trim() || decFiles.length) {
        c.decisions = [{ num: (f.decNum || '').trim() || String((c.decisions || []).length + 1), year: (f.decYear || '2026').trim(), kind: f.decKind || 'قرار تشكيل', img: decFiles[0] }, ...(c.decisions || [])];
      }
      if (send) { c._mrev = true; c._mret = ''; c._mowner = c._mowner || cu.id; }
      (c._mlog = c._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: send ? 'بانتظار اعتماد رئيس القطاع' : (existing ? rl('تحديث بيانات اللجنة', 'Committee updated') : rl('إنشاء اللجنة', 'Committee created')), sent: !!send, by: cu.name });
    });
    showToast(send ? rl('أُرسلت تحديثات اللجنة لرئيس القطاع للمراجعة', 'Committee updates sent for Sector Head review') : rl('تم حفظ بيانات اللجنة', 'Committee saved'));
    onClose();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;

  return (
    <Modal open onClose={onClose} width={640}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? rl('تعديل اللجنة', 'Edit committee') : rl('لجنة جديدة', 'New committee')}</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>{rl('تُحفظ التعديلات في نفس السجل الذي يراه رئيس القطاع.', 'Saved to the same record the Sector Head sees.')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('اسم اللجنة', 'Committee name')}</Label><input value={f.name} onChange={setI('name')} style={inputStyle} /></div>
        <div><Label>{rl('رئيس اللجنة', 'Committee chair')}</Label><input value={f.chair} onChange={setI('chair')} style={inputStyle} /></div>
        <div><Label>{rl('المقرر / المنسق', 'Rapporteur / coordinator')}</Label><Dropdown value={f.rapporteur} options={peopleOpts.map((n) => ({ v: n, label: tr(n) }))} onChange={set('rapporteur')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('دورية الاجتماعات', 'Meeting frequency')}</Label><Dropdown value={f.freq} options={freqOpts.map((v) => ({ v, label: tr(v) }))} onChange={set('freq')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('الحالة', 'Status')}</Label><Dropdown value={f.status} options={statusOpts.map((v) => ({ v, label: tr(v) }))} onChange={set('status')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('التصنيف', 'Category')}</Label><input value={f.cat} onChange={setI('cat')} style={inputStyle} /></div>
        <div><Label>{rl('الاجتماعات المطلوبة سنوياً', 'Required meetings / year')}</Label><input value={f.reqMeetings} onChange={setI('reqMeetings')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('الغرض / المهام', 'Purpose')}</Label><textarea value={f.purpose} onChange={setI('purpose')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>{rl('الأعضاء', 'Members')}</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(memberInput); } }}
              list="committee-people-suggest"
              placeholder={rl('اكتب اسم العضو ثم اضغط Enter (يمكن إضافة أسماء خارج القائمة)…', 'Type a member name then press Enter (names outside the list are allowed)…')}
              style={{ ...inputStyle, flex: 1 }}
            />
            <datalist id="committee-people-suggest">
              {peopleOpts.filter((n) => !members.includes(n)).map((n) => <option key={n} value={n} />)}
            </datalist>
            <button type="button" onClick={() => addMember(memberInput)} disabled={!memberInput.trim()} style={{ flex: 'none', background: memberInput.trim() ? '#1e4634' : '#e2e6df', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: memberInput.trim() ? 'pointer' : 'default' }}>{rl('إضافة', 'Add')}</button>
          </div>
          {members.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
              {members.map((n) => (
                <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e4634', background: '#eef5f0', color: '#1e4634', borderRadius: 20, padding: '4px 9px', fontSize: 11.5, fontWeight: 700 }}>
                  {tr(n)}
                  <button type="button" onClick={() => setMembers((p) => p.filter((x) => x !== n))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ gridColumn: '1 / -1', border: '1px dashed #d8dedb', borderRadius: 12, padding: '12px 14px' }}>
          <Label>{rl('قرار التشكيل / التحديث (اختياري)', 'Formation / update decision (optional)')}</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={f.decNum} onChange={setI('decNum')} placeholder={rl('رقم القرار', 'Decision No.')} style={inputStyle} />
            <input value={f.decYear} onChange={setI('decYear')} placeholder={rl('السنة', 'Year')} style={inputStyle} />
            <Dropdown value={f.decKind} options={['قرار تشكيل', 'قرار تحديث', 'قرار إعادة تشكيل'].map((v) => ({ v, label: tr(v) }))} onChange={set('decKind')} opt={{ block: true, size: 'sm' }} />
          </div>
          <FileUploadField multiple={false} files={decFiles} onChange={setDecFiles} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ', 'Save')}</button>
      </div>
    </Modal>
  );
}

/* ================= COMMITTEE MEETING FORM (Coordinator) =================
   Meeting lifecycle inside an assigned committee: date, attendance and
   absences, minutes points, resulting tasks with status and completion %,
   attachments — and sending the update for Sector Head review. */
function CommitteeMeetingModal({ cid, meetingNo, onClose }: { cid: string; meetingNo: string | null; onClose: () => void }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const committee = data.committees.find((c) => c.id === cid);
  const existing = meetingNo && committee ? (committee.meetings || []).find((m) => m.no === meetingNo) : null;
  const memberPool = Array.from(new Set([...(committee?.members || []), ...data.members.map((m) => m.name)]));

  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    date: existing.date, present: String(existing.present), total: String(existing.total), points: existing.points || '',
  } : {
    date: '', present: '', total: String((committee?.members || []).length || ''), points: '',
  });
  const [absent, setAbsent] = useState<string[]>(() => (existing?.absent ? [...existing.absent] : []));
  const [atts, setAtts] = useState<string[]>(() => (existing?.attachments ? [...existing.attachments] : []));
  const [tasks, setTasks] = useState<CommitteeTask[]>(() => (existing?.tasks ? existing.tasks.map((t) => ({ ...t })) : []));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setTask = (i: number, k: keyof CommitteeTask, v: string | number) => setTasks((p) => p.map((t, x) => (x === i ? { ...t, [k]: v } : t)));

  const TSTAT = ['لم يبدأ', 'قيد التنفيذ', 'مكتمل', 'متأخر'];

  const save = (send: boolean) => {
    if (!f.date) { showToast(rl('يرجى اختيار تاريخ الاجتماع', 'Please pick the meeting date')); return; }
    const cleanTasks = tasks.filter((t) => (t.title || '').trim());
    mutate((d) => {
      const c = d.committees.find((x) => x.id === cid) as (Committee & { _mowner?: string; _mrev?: boolean; _mret?: string; _mlog?: unknown[] }) | undefined;
      if (!c) return;
      c.meetings = c.meetings || [];
      let m = meetingNo ? c.meetings.find((x) => x.no === meetingNo) : undefined;
      if (!m) {
        m = { no: String(c.meetings.length + 1), date: '', present: 0, total: 0, minutes: false, points: '', tasks: [] };
        c.meetings.unshift(m);
      }
      m.date = f.date; m.present = parseInt(f.present, 10) || 0; m.total = parseInt(f.total, 10) || (c.members || []).length;
      m.points = (f.points || '').trim(); m.minutes = !!(m.points || atts.length);
      m.absent = absent; m.attachments = atts; m.tasks = cleanTasks;
      c.actualMeetings = c.meetings.length;
      if (send) { c._mrev = true; c._mret = ''; c._mowner = c._mowner || cu.id; }
      (c._mlog = c._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: send ? 'بانتظار اعتماد رئيس القطاع' : rl('تحديث اجتماع اللجنة رقم ', 'Committee meeting updated No. ') + m.no, note: (f.points || '').slice(0, 80), sent: !!send, by: cu.name });
    });
    showToast(send ? rl('أُرسل محضر الاجتماع لرئيس القطاع للمراجعة', 'Meeting minutes sent for Sector Head review') : rl('تم حفظ الاجتماع والمحضر', 'Meeting & minutes saved'));
    onClose();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;

  return (
    <Modal open onClose={onClose} width={680}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>
        {existing ? rl('محضر الاجتماع رقم ', 'Meeting minutes No. ') + existing.no : rl('اجتماع جديد', 'New meeting')}
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>{committee ? tr(committee.name) : ''}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div><Label>{rl('تاريخ الاجتماع', 'Meeting date')}</Label><DateField value={f.date} onChange={(v) => setF((p) => ({ ...p, date: v }))} /></div>
        <div><Label>{rl('عدد الحضور', 'Present')}</Label><input value={f.present} onChange={setI('present')} style={inputStyle} /></div>
        <div><Label>{rl('إجمالي الأعضاء', 'Total members')}</Label><input value={f.total} onChange={setI('total')} style={inputStyle} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>{rl('الغياب (اختر من الأعضاء)', 'Absences (pick from members)')}</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {(committee?.members || []).map((n) => {
              const on = absent.includes(n);
              return (
                <button type="button" key={n} onClick={() => setAbsent((p) => (on ? p.filter((x) => x !== n) : [...p, n]))} style={{ border: '1.5px solid ' + (on ? '#b0433b' : '#e2e6df'), background: on ? '#fdf3f2' : '#fff', color: on ? '#b0433b' : '#5b6b62', borderRadius: 20, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {tr(n)}{on ? ' ✕' : ''}
                </button>
              );
            })}
            {(committee?.members || []).length === 0 && <span style={{ fontSize: 11.5, color: '#9aa39b' }}>{rl('لا يوجد أعضاء مسجّلون لهذه اللجنة', 'No members recorded for this committee')}</span>}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('المحضر / أبرز النقاط والقرارات', 'Minutes / key points & decisions')}</Label><textarea value={f.points} onChange={setI('points')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>{rl('المهام الناتجة عن الاجتماع', 'Tasks resulting from the meeting')}</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 64px 28px', gap: 8, alignItems: 'center' }}>
                <input value={t.title} onChange={(e) => setTask(i, 'title', e.target.value)} placeholder={rl('المهمة', 'Task')} style={inputStyle} />
                <Dropdown value={t.owner} options={memberPool.map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => setTask(i, 'owner', v)} opt={{ block: true, size: 'sm', placeholder: rl('المسؤول', 'Owner') }} />
                <Dropdown value={t.status} options={TSTAT.map((v) => ({ v, label: tr(v) }))} onChange={(v) => setTask(i, 'status', v)} opt={{ block: true, size: 'sm' }} />
                <DateField value={t.due} onChange={(v) => setTask(i, 'due', v)} />
                <input value={String(t.prog ?? '')} onChange={(e) => setTask(i, 'prog', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))} placeholder="%" style={{ ...inputStyle, textAlign: 'center', padding: '10px 6px' }} />
                <button type="button" onClick={() => setTasks((p) => p.filter((_, x) => x !== i))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setTasks((p) => [...p, { title: '', owner: committee?.rapporteur || cu.name, status: 'قيد التنفيذ', due: '', prog: 0 }])} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#f4f6f2', border: '1px solid #dfe6dd', color: '#2b5c44', borderRadius: 9, padding: '8px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة مهمة', 'Add task')}
            </button>
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('المحضر والمرفقات (رفع ملفات)', 'Minutes & attachments (upload)')}</Label><FileUploadField files={atts} onChange={setAtts} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ', 'Save')}</button>
      </div>
    </Modal>
  );
}
