import { useState, type CSSProperties, type ReactNode } from 'react';
import { Fade } from '../components/ui';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { PS } from '../shared/constants';
import { DemoHint } from '../components/DemoHint';
import { mColl } from './member/workflow';

type Tab = 'approvals' | 'updates' | 'minutes' | 'follow' | 'corr';

interface Note { label: string; v: string; bg: string; bd: string; lFg: string; vFg: string }
interface Meta { k: string; v: string; iconD: string }
interface Btn { label: string; onClick: () => void; style: CSSProperties }
interface Row {
  tag: string; tagBg: string; tagFg: string; title: string;
  notes?: Note[]; meta?: Meta[]; actions?: Btn[];
  hasProgress?: boolean; progW?: string; progLabel?: string; progColor?: string;
}
interface Def { title: string; sub: string; accent: string; icBg: string; icFg: string; count: number; rows: Row[]; hint: string; icon: ReactNode }

const MIP: Record<string, string> = {
  owner: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  date: 'M4 5.5h16v15H4zM4 9.5h16M8 3v4M16 3v4',
  next: 'M5 12h13M12 6l6 6-6 6',
  meeting: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  entity: 'M4 21V4h10v17M14 9h6v12M7.5 8h3M7.5 12h3M7.5 16h3',
  status: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01',
};

const BS: Record<string, CSSProperties> = {
  primary: { background: '#1f4a37', color: '#fff', border: 'none' },
  gold: { background: '#fbf3df', color: '#8a6a1f', border: '1px solid #ecdcae' },
  ghost: { background: '#f2f4f0', color: '#3c4a42', border: '1px solid #e2e6df' },
  blue: { background: '#e9f0f6', color: '#3a6ea5', border: '1px solid #d3e0ec' },
};

const NOTE_TONES: Record<string, [string, string, string, string]> = {
  gold: ['#fbf7ee', '#f0e6cf', '#a9791f', '#6a5a2b'],
  blue: ['#eef3f9', '#dbe7f2', '#3a6ea5', '#3f5876'],
  green: ['#eef6f0', '#d6e8dd', '#1f8a5b', '#3f6a54'],
};

export function ChairDashboard() {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { goto } = useNav();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('approvals');

  const btn = (label: string, kind: string, onClick: () => void): Btn => ({
    label, onClick,
    style: { ...(BS[kind] || BS.ghost), borderRadius: 8, padding: '6px 12px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
  });
  const view = (fn: () => void) => btn(rl('عرض التفاصيل', 'Details'), 'ghost', fn);
  const MI = (k: string, v: string, type: string): Meta => ({ k, v, iconD: MIP[type] || MIP.status });
  const NOTE = (label: string, v: string, tone: string): Note => { const t = NOTE_TONES[tone] || NOTE_TONES.gold; return { label, v: tr(v || ''), bg: t[0], bd: t[1], lFg: t[2], vFg: t[3] }; };

  const openProject = (id: string) => () => goto('projectDetail', { selProject: id });
  const openMtg = (title: string) => { const mt = data.meetings.find((x) => x.title === title || tr(x.title) === title); return mt ? () => goto('meetingDetail', { selMeeting: mt.id }) : () => goto('mtasks'); };

  // ---- chair actions ----
  const approveProject = (id: string) => { mutate((d) => { const p = d.projects.find((x) => x.id === id); if (p) { p.status = 'قيد التنفيذ'; if (!p.progress || p.progress < 10) p.progress = 10; } }); showToast(rl('تم اعتماد بدء المشروع', 'Project start approved')); };
  const approveCompletion = (id: string) => { mutate((d) => { const p = d.projects.find((x) => x.id === id); if (p) { p.status = 'مكتمل'; p.progress = 100; (p.timeline = p.timeline || []).unshift({ text: 'اعتمد رئيس القطاع اكتمال المشروع', by: 'رئيس القطاع', date: 'اليوم' }); } }); showToast(rl('تم اعتماد اكتمال المشروع', 'Completion approved')); };
  const approveExtension = (id: string) => { mutate((d) => { const p = d.projects.find((x) => x.id === id); if (p && p.extendReq) { p.dueDate = p.extendReq.to; if (p.status === 'متأخر') p.status = 'قيد التنفيذ'; (p.extendReq as { decided?: boolean }).decided = true; } }); showToast(rl('تم اعتماد التمديد', 'Extension approved')); };
  const approveLeave = (id: string) => { mutate((d) => { const l = d.leaves.find((x) => x.id === id); if (l) l.status = 'معتمدة'; }); showToast(rl('تم اعتماد الإجازة', 'Leave approved')); };

  // ---- helpers ----
  const projBF = (status: string): string[] => (PS as Record<string, readonly string[]>)[status] as string[] || ['#eee', '#555'];
  const corrDir = (dir: string) => (dir === 'صادر' ? ['#e6eef6', '#3a6ea5'] : ['#eef6f0', '#2e7d55']);
  const oNoDue = (tk: { end?: string }) => !tk.end || !String(tk.end).trim();
  const oNeedsAttn = (tk: { status: string; end?: string }) => tk.status !== 'مكتمل' && (tk.status === 'متأخر' || tk.status === 'يحتاج توجيه' || tk.status === 'بانتظار اعتماد' || oNoDue(tk));

  const SCM: Record<string, [string, string]> = {
    'مكتمل': ['#e2f0e8', '#2e7d55'], 'قيد التنفيذ': ['#fbf0d6', '#a9791f'], 'متأخر': ['#f7e6e4', '#b0433b'],
    'لم يبدأ': ['#eceae6', '#8a8078'], 'يحتاج توجيه': ['#f7ece0', '#c26a2b'], 'بانتظار اعتماد': ['#e6eef6', '#2f6aa8'], 'مستمر': ['#e6eef6', '#2f6aa8'],
  };
  const stC = (s: string) => { const c = SCM[s] || ['#f2f4f0', '#6d7973']; return { label: tr(s), bg: c[0], fg: c[1] }; };

  // ---- approvals ----
  const apprList: Row[] = [];
  data.projects.filter((p) => p.status === 'لم يبدأ' || p.status === 'بانتظار الاعتماد').forEach((p) => {
    const completion = (p.progress || 0) >= 100;
    apprList.push({ tag: rl('مشروع', 'Project'), tagBg: '#e9f0f6', tagFg: '#3a6ea5', title: tr(p.name),
      notes: [NOTE(rl('المطلوب', 'Action needed'), completion ? rl('اعتماد اكتمال المشروع', 'Approve project completion') : rl('اعتماد بدء تنفيذ المشروع', 'Approve project start'), 'gold')],
      meta: [MI(rl('المسؤول', 'Owner'), tr(p.owner), 'owner')].filter((m) => m.v),
      actions: [btn(completion ? rl('اعتماد الاكتمال', 'Approve completion') : rl('اعتماد البدء', 'Approve start'), 'primary', completion ? () => approveCompletion(p.id) : () => approveProject(p.id)), view(openProject(p.id))] });
  });
  data.projects.filter((p) => p.extendReq && !(p.extendReq as { decided?: boolean }).decided).forEach((p) => {
    apprList.push({ tag: rl('تمديد موعد', 'Extension'), tagBg: '#f7e6e4', tagFg: '#b0433b', title: tr(p.name),
      notes: [NOTE(rl('المطلوب', 'Action needed'), rl('اعتماد تمديد الموعد النهائي إلى ', 'Approve deadline extension to ') + dl(p.extendReq!.to), 'gold')],
      meta: [MI(rl('المسؤول', 'Owner'), tr(p.owner), 'owner'), MI(rl('من', 'From'), dl(p.extendReq!.from), 'date')].filter((m) => m.v),
      actions: [btn(rl('اعتماد التمديد', 'Approve extension'), 'primary', () => approveExtension(p.id)), view(openProject(p.id))] });
  });
  data.leaves.filter((l) => l.status === 'بانتظار الاعتماد').forEach((l) => {
    apprList.push({ tag: rl('إجازة', 'Leave'), tagBg: '#fbf3df', tagFg: '#8a6a1f', title: tr(l.person) + ' — ' + tr(l.type),
      notes: [NOTE(rl('المطلوب', 'Action needed'), rl('اعتماد طلب الإجازة', 'Approve leave request'), 'gold')],
      meta: [MI(rl('الفترة', 'Period'), tr(l.start) + ' → ' + tr(l.end), 'date')].filter((m) => m.v),
      actions: [btn(rl('اعتماد الإجازة', 'Approve leave'), 'primary', () => approveLeave(l.id)), view(() => goto('leaves'))] });
  });

  // ---- updates ----
  const updRows: Row[] = data.projects.slice(0, 10).map((p) => {
    const [bg, fg] = projBF(p.status);
    const lastUpd = p.timeline && p.timeline.length ? p.timeline[0].text : '';
    return { tag: tr(p.status), tagBg: bg, tagFg: fg, title: tr(p.name),
      notes: [lastUpd ? NOTE(rl('آخر تحديث', 'Latest update'), lastUpd, 'blue') : null, p.nextStep ? NOTE(rl('الخطوة القادمة', 'Next step'), p.nextStep, 'gold') : null].filter(Boolean) as Note[],
      meta: [MI(rl('المسؤول', 'Owner'), tr(p.owner), 'owner')].filter((m) => m.v),
      hasProgress: true, progW: (p.progress || 0) + '%', progLabel: (p.progress || 0) + '%',
      progColor: p.status === 'متأخر' ? '#b0433b' : ((p.progress || 0) >= 100 ? '#1f8a5b' : '#3a6ea5'),
      actions: [view(openProject(p.id))] };
  });

  // ---- minutes ----
  const minRows: Row[] = data.mtasks.slice(0, 10).map((m) => ({
    tag: rl('مهمة محضر', 'Minute task'), tagBg: '#f3ecf6', tagFg: '#7a4d94', title: tr(m.task),
    meta: [MI(rl('المحضر', 'Meeting'), tr(m.meeting), 'meeting'), MI(rl('الجهة', 'Dept'), tr(m.dept), 'entity'), MI(rl('التاريخ', 'Date'), dl(m.mDate), 'date')].filter((x) => x.v),
    actions: [view(openMtg(m.meeting))],
  }));

  // ---- follow-ups ----
  const folList: Row[] = [];
  data.otasks.filter(oNeedsAttn).forEach((tk) => {
    const sc = stC(tk.status);
    folList.push({ tag: sc.label, tagBg: sc.bg, tagFg: sc.fg, title: tr(tk.title),
      notes: [NOTE(rl('النوع', 'Type'), rl('مهمة مكتب', 'Office task'), 'blue')],
      meta: [MI(rl('المسؤول', 'Owner'), tr(tk.owner), 'owner'), MI(rl('الاستحقاق', 'Due'), tk.end ? dl(tk.end) : rl('بدون موعد', 'No date'), 'date')].filter((m) => m.v),
      actions: [view(() => goto('otasks'))] });
  });
  data.projects.filter((p) => p.status === 'متأخر').forEach((p) => {
    const sc = stC('متأخر');
    folList.push({ tag: sc.label, tagBg: sc.bg, tagFg: sc.fg, title: tr(p.name),
      notes: [NOTE(rl('النوع', 'Type'), rl('مشروع', 'Project'), 'blue'), NOTE(rl('الخطوة القادمة', 'Next step'), tr(p.nextStep), 'gold')],
      meta: [MI(rl('المسؤول', 'Owner'), tr(p.owner), 'owner')].filter((m) => m.v),
      actions: [view(openProject(p.id))] });
  });
  data.mtasks.slice(0, 6).forEach((m) => {
    const sc = stC(m.status);
    folList.push({ tag: sc.label, tagBg: sc.bg, tagFg: sc.fg, title: tr(m.task),
      notes: [NOTE(rl('النوع', 'Type'), rl('مهمة محضر', 'Minute task'), 'blue'), NOTE(rl('المحضر', 'Meeting'), tr(m.meeting), 'gold')],
      meta: [MI(rl('الجهة', 'Dept'), tr(m.dept), 'entity'), MI(rl('التاريخ', 'Date'), dl(m.mDate), 'date')].filter((x) => x.v),
      actions: [view(openMtg(m.meeting))] });
  });
  (data.audit || []).filter((a) => a.status !== 'مغلق').slice(0, 4).forEach((a) => {
    const sc = stC(a.status);
    folList.push({ tag: sc.label, tagBg: sc.bg, tagFg: sc.fg, title: rl('ملاحظة تدقيق: ', 'Audit note: ') + tr(a.area),
      notes: [NOTE(rl('النوع', 'Type'), rl('تدقيق', 'Audit'), 'blue')],
      meta: [MI(rl('المسؤول', 'Owner'), tr(a.owner), 'owner'), MI(rl('تاريخ الإغلاق', 'Due'), tr(a.due), 'date')].filter((m) => m.v),
      actions: [view(() => goto('reportcenter'))] });
  });

  // ---- correspondence ----
  const corrRows: Row[] = data.correspondence.filter((c) => c.needsAction).slice(0, 10).map((c) => {
    const [bg, fg] = corrDir(c.dir);
    return { tag: tr(c.dir), tagBg: bg, tagFg: fg, title: tr(c.name),
      meta: [MI(rl('الجهة', 'Entity'), tr(c.entity), 'entity'), MI(rl('التاريخ', 'Date'), dl(c.date), 'date'), MI(rl('الحالة', 'Status'), tr(c.status), 'status')].filter((m) => m.v),
      actions: [btn(rl('متابعة', 'Follow'), 'gold', () => goto('docDetail', { selDoc: c.id })), view(() => goto('docDetail', { selDoc: c.id }))] };
  });

  const DEF: Record<Tab, Def> = {
    approvals: { title: rl('اعتماد رئيس القطاع', 'Chair approvals'), sub: rl('بنود بانتظار اعتمادك', 'Items awaiting your approval'), accent: '#b0433b', icBg: '#f7e6e4', icFg: '#b0433b', count: apprList.length, rows: apprList.slice(0, 10), hint: rl('ما يحتاج اعتمادك فقط: بدء مشروع، اكتمال مشروع، تمديد موعد نهائي، أو اعتماد إجازة.', 'Approval-only items: project start, project completion, deadline extension, or leave approval.'), icon: <IcoApprovals /> },
    updates: { title: rl('تحديثات المشاريع', 'Project updates'), sub: rl('آخر تحديثات المشاريع النشطة', 'Latest active project updates'), accent: '#3a6ea5', icBg: '#e9f0f6', icFg: '#3a6ea5', count: data.projects.length, rows: updRows, hint: rl('تحديثات كل المشاريع: الحالة ونسبة الإنجاز والخطوة القادمة.', 'All project updates: status, progress and next step.'), icon: <IcoBars /> },
    minutes: { title: rl('محاضر الاجتماعات', 'Meeting minutes'), sub: rl('المهام والقرارات الناتجة', 'Resulting tasks & decisions'), accent: '#7a4d94', icBg: '#f3ecf6', icFg: '#7a4d94', count: data.mtasks.length, rows: minRows, hint: rl('المهام الناتجة عن الاجتماعات والمسؤول عنها وحالتها.', 'Tasks resulting from meetings, their owners and status.'), icon: <IcoDoc /> },
    follow: { title: rl('المتابعات', 'Follow-ups'), sub: rl('بنود مفتوحة تحتاج متابعة', 'Open items needing follow-up'), accent: '#a9791f', icBg: '#fbf3df', icFg: '#a9791f', count: folList.length, rows: folList.slice(0, 12), hint: rl('بنود مفتوحة من مختلف الأقسام — وسم كل بند يوضّح نوعه: مهمة مكتب، مشروع، مهمة محضر، أو تدقيق.', 'Open items across departments — each tag shows its type.'), icon: <IcoCheck /> },
    corr: { title: rl('الصادر والوارد', 'Correspondence'), sub: rl('مراسلات تحتاج إجراء', 'Correspondence needing action'), accent: '#2e7d55', icBg: '#e2f0e8', icFg: '#2e7d55', count: data.correspondence.filter((c) => c.needsAction).length, rows: corrRows, hint: rl('المستندات الصادرة والواردة التي تحتاج متابعة أو إجراء.', 'Outgoing/incoming documents needing follow-up.'), icon: <IcoMail /> },
  };

  const active = DEF[tab];
  const cards: { key: Tab; def: Def }[] = (['approvals', 'updates', 'minutes', 'follow', 'corr'] as Tab[]).map((k) => ({ key: k, def: DEF[k] }));

  return (
    <Fade>
      <DemoHint />
      <div className="rg5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 13, marginBottom: 24 }}>
        {cards.map(({ key, def }) => {
          const on = tab === key;
          const cardStyle: CSSProperties = {
            cursor: 'pointer', borderRadius: 16, padding: '16px 17px', transition: 'all .15s',
            background: on ? '#ffffff' : '#f7f9f7', border: '1.5px solid ' + (on ? def.accent : '#e6ece7'),
            boxShadow: on ? '0 10px 26px -16px ' + def.accent : '0 1px 2px rgba(23,40,32,.03)',
          };
          return (
            <div key={key} onClick={() => setTab(key)} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? def.icBg : '#eef1ec', color: on ? def.icFg : '#9aa39b' }}>{def.icon}</span>
                <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.5px', color: on ? def.accent : '#c3cec4' }}>{def.count}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35, marginBottom: 4, color: '#17211c' }}>{def.title}</div>
              <div style={{ fontSize: 11, color: '#6d7973', lineHeight: 1.5 }}>{def.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="glass" style={{ borderRadius: 20, padding: '22px 24px', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 40px -22px rgba(23,40,32,.16)', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
          <span style={{ width: 8, height: 26, borderRadius: 6, flex: 'none', background: active.accent }} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#17211c' }}>{active.title}</h2>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6d7973', background: '#f2f4f0', borderRadius: 20, padding: '3px 11px' }}>{active.count}</span>
        </div>
        <p style={{ margin: '0 0 18px 19px', fontSize: 12, color: '#888D88' }}>{active.hint}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {active.rows.length === 0 && (
            <div style={{ padding: 26, textAlign: 'center', fontSize: 13, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد بنود حالياً', 'No items right now')}</div>
          )}
          {active.rows.map((r, i) => <RowCard key={i} r={r} />)}
        </div>
      </div>
    </Fade>
  );
}

function RowCard({ r }: { r: Row }) {
  return (
    <div style={{ border: '1px solid #eef1ec', borderRadius: 14, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 11, background: '#fbfcfb' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, borderRadius: 7, padding: '4px 9px', background: r.tagBg, color: r.tagFg, whiteSpace: 'nowrap', marginTop: 2 }}>{r.tag}</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#17211c', lineHeight: 1.5 }}>{r.title}</div>
        {r.hasProgress && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <div style={{ width: 70, height: 6, background: '#eef0ec', borderRadius: 20, overflow: 'hidden' }}><div style={{ height: '100%', width: r.progW, background: r.progColor, borderRadius: 20 }} /></div>
            <span style={{ fontSize: 11, fontWeight: 800, color: r.progColor }}>{r.progLabel}</span>
          </div>
        )}
      </div>
      {(r.notes || []).map((nt, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: nt.bg, border: '1px solid ' + nt.bd, borderRadius: 9, padding: '8px 11px' }}>
          <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: nt.lFg, marginTop: 1 }}>{nt.label}:</span>
          <span style={{ fontSize: 11.5, color: nt.vFg, lineHeight: 1.55 }}>{nt.v}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 2 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11.5, color: '#7d867f' }}>
          {(r.meta || []).map((m, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#b6bdb6" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={m.iconD} /></svg>
              <b style={{ color: '#9aa39b', fontWeight: 600 }}>{m.k}:</b> {m.v}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(r.actions || []).map((a, i) => <button key={i} onClick={a.onClick} style={a.style}>{a.label}</button>)}
        </div>
      </div>
    </div>
  );
}

/* dashboard card icons */
const IcoApprovals = () => <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2z" /><path d="M5 21h14M7 21v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /></svg>;
const IcoBars = () => <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
const IcoDoc = () => <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
const IcoCheck = () => <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L20 6" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>;
const IcoMail = () => <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>;

