import { useEffect, useState } from 'react';
import { Fade, Card, Badge, Modal } from '../components/ui';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useToast } from '../components/Toast';
import { initials, memberImg, asset } from '../shared/helpers';
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
        {!cur && <ListView committees={committees} rl={rl} tr={tr} dl={dl} openC={openC} />}
        {cur && (
          <DetailView
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
      <SectionAddButton section="committees" />
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
function DetailView({ c, tab, setTab, onBack, canApprove, showToast, rl, tr, dl, onPreview }: {
  c: Committee;
  tab: 'summary' | 'meetings' | 'decisions' | 'members';
  setTab: (t: 'summary' | 'meetings' | 'decisions' | 'members') => void;
  onBack: () => void;
  canApprove: boolean;
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
        <Badge bg={stBg} fg={stFg} style={{ flex: 'none', fontSize: 11, padding: '6px 14px' }}>{tr(c.status)}</Badge>
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
      {tab === 'meetings' && <MeetingsTab c={c} canApprove={canApprove} showToast={showToast} rl={rl} tr={tr} dl={dl} />}
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
function MeetingsTab({ c, canApprove, showToast, rl, tr, dl }: {
  c: Committee;
  canApprove: boolean;
  showToast: (m: string) => void;
  rl: (a: string, b: string) => string;
  tr: (s: string) => string;
  dl: (s: string) => string;
}) {
  const meetings = c.meetings || [];
  if (meetings.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px dashed #d8dedb', borderRadius: 16, padding: 34, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>
        {rl('لا توجد اجتماعات مسجّلة لهذه اللجنة بعد.', 'No meetings recorded for this committee yet.')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {meetings.map((m: CommitteeMeeting, mi) => (
        <div key={mi} style={{ border: '1px solid #e6ece7', borderRadius: 15, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(23,40,32,.04)' }}>
          <div style={{ background: '#f3f7f3', padding: '14px 16px', borderBottom: '1px solid #e6ece7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: '#1f4a37', background: '#e4efe7', borderRadius: 8, padding: '5px 11px' }}>{tr(m.no)} · {dl(m.date)}</span>
              <span style={{ fontSize: 11.5, color: '#5b6b62' }}>
                {rl('الحضور', 'Attendance')}: {m.present} {rl('من', 'of')} {m.total} · {m.minutes ? rl('يوجد محضر', 'Minutes available') : rl('لا يوجد محضر', 'No minutes')} · {(m.tasks || []).length} {rl('مهام ناتجة', 'resulting tasks')}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: '#3c4a42', lineHeight: 1.65 }}>{tr(m.points)}</div>
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
                  <Badge bg={tsBg} fg={tsFg} style={{ flex: 'none', fontSize: 10, padding: '4px 10px' }}>{tr(t.status)}</Badge>
                  {canApprove && (
                    <div style={{ flex: 'none', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => showToast(rl('تمت إضافة التوجيه', 'Directive added'))} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إضافة توجيه', 'Add directive')}</button>
                      <button onClick={() => showToast(rl('تم إرسال طلب التحديث', 'Update request sent'))} style={{ background: '#f2f4f0', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 7, padding: '6px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('طلب تحديث', 'Request update')}</button>
                      <button onClick={() => showToast(rl('تم وضع علامة: تمت المراجعة', 'Marked as reviewed'))} style={{ background: '#e2f0e8', color: '#2e7d55', border: '1px solid #cce6d4', borderRadius: 7, padding: '6px 11px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('تمت المراجعة', 'Reviewed')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
