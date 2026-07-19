import { useState, type ReactNode } from 'react';
import { Fade } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { useCurrentUser } from '../store/useCurrentUser';
import { useNav, type Page } from '../store/nav';
import { WFS, SECTIONS } from '../domain/permissions';
import { MEMBER_DIRECTIVES, MEMBER_RECENT } from '../domain/workflow';
import { mColl, editableCollections, OWNER_OF, ownedBy, FINAL_STATUSES } from './member/workflow';
import { MemberForm } from './member/MemberForm';
import { DemoHint } from '../components/DemoHint';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Item {
  id: string; sec: string; title: string; status: string;
  review: boolean; returned: boolean; reason: string;
  isWork: boolean; own: boolean; logLine: string;
}

/** Which page a dashboard item opens in, so a click lands the member in the
 *  actual area where the work happens instead of a side panel. Real records
 *  deep-link to their detail page (with the id); everything else — and all
 *  ad-hoc work items — go to the section's list page. */
const SECTION_PAGE: Record<string, Page> = {
  minutes: 'meetings', minuteTasks: 'mtasks',
  committees: 'committees', committeeDecisions: 'committees',
  correspondence: 'correspondence', followups: 'actions',
  projects: 'projects', projPhases: 'projects', projUpdates: 'projects', projRisks: 'projects',
  leaves: 'leaves', myTasks: 'otasks',
  auditReports: 'reportcenter', reportLog: 'reglog', finReports: 'finDetail',
  reportCenter: 'reportcenter', recommendations: 'reportcenter',
};

type CardKey = 'open' | 'updating' | 'sent' | 'returned' | 'late' | 'done';

export function MemberDashboard() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const mutate = useStore((s) => s.mutate);
  const mutateWork = useStore((s) => s.mutateWork);
  const { showToast } = useToast();
  const { goto } = useNav();
  const [form, setForm] = useState<{ section: string; editId: string | null } | null>(null);
  const [card, setCard] = useState<CardKey>('open');

  /** Navigate to the area that owns this item so the member can act on it there. */
  const openItem = (it: { sec: string; id: string; isWork: boolean }) => {
    if (!it.isWork) {
      const key = mColl(it.sec)?.key;
      if (key === 'projects') return goto('projectDetail', { selProject: it.id });
      if (key === 'meetings') return goto('meetingDetail', { selMeeting: it.id });
      if (key === 'correspondence') return goto('docDetail', { selDoc: it.id });
      if (key === 'committees') return goto('committees', { selCommittee: it.id });
    }
    goto(SECTION_PAGE[it.sec] || 'dashboard');
  };

  const wf = (st: string): [string, string] => WFS[st] || WFS['مسودة'];
  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };

  // ---- unified item list across the member's editable sections ----
  const secItems = (sec: string): Item[] => {
    const coll = mColl(sec);
    const own: Item[] = work.filter((x) => x.owner === cu.id && x.section === sec).map((x) => ({
      id: x.id, sec, title: x.title, status: x.status,
      review: x.status === 'بانتظار مراجعة رئيس القطاع', returned: x.status === 'أعيد للتعديل',
      reason: x.reason || '', isWork: true, own: true, logLine: '',
    }));
    if (!coll) return own;
    const ownerOf = OWNER_OF[coll.key as string];
    const real: Item[] = coll.get(data).map((r: any) => ({
      id: r.id, sec, title: coll.title(r),
      status: r._mrev ? 'بانتظار مراجعة رئيس القطاع' : (r._mret ? 'أعيد للتعديل' : coll.status(r)),
      review: !!r._mrev, returned: !!r._mret, reason: r._mret || '',
      isWork: false, own: r._mowner === cu.id || (ownerOf ? ownedBy(ownerOf(r), cu.name) : false),
      logLine: r._mlog?.[0] ? (r._mlog[0].chair ? rl('رئيس القطاع: ', 'Sector Head: ') : '') + (r._mlog[0].to || '') : '',
    }));
    return [...own, ...real];
  };

  const groups = editableCollections(cu).map((sec) => ({ sec, label: secName(sec), items: secItems(sec) }));
  const all: Item[] = groups.flatMap((g) => g.items);
  const mine = all.filter((x) => x.own);

  // ---- the six approved workflow cards ----
  const buckets: Record<CardKey, Item[]> = {
    open: mine.filter((x) => !FINAL_STATUSES.includes(x.status) && !x.review && !x.returned && x.status !== 'متأخر' && x.status !== 'قيد التحديث'),
    updating: mine.filter((x) => x.status === 'قيد التحديث'),
    sent: mine.filter((x) => x.review || x.status === 'مرسل للمراجعة'),
    returned: mine.filter((x) => x.returned),
    late: mine.filter((x) => x.status === 'متأخر'),
    done: mine.filter((x) => x.status === 'معتمد' || x.status === 'مكتمل'),
  };

  const CARDS: { key: CardKey; label: string; sub: string; accent: string; bg: string; icon: ReactNode }[] = [
    { key: 'open', label: rl('مهامي المفتوحة', 'My open items'), sub: rl('بنود نشطة تخصني', 'Active items I own'), accent: '#3a6ea5', bg: '#e6eef6', icon: <Ico d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 13l2 2 4-4" /> },
    { key: 'updating', label: rl('بانتظار التحديث', 'Awaiting update'), sub: rl('قيد التحديث حالياً', 'Currently being updated'), accent: '#2f6aa8', bg: '#e3edf6', icon: <Ico d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" /> },
    { key: 'sent', label: rl('مرسل لرئيس القطاع', 'Sent to Sector Head'), sub: rl('بانتظار مراجعته', 'Awaiting review'), accent: '#7a4d94', bg: '#f1e8f5', icon: <Ico d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /> },
    { key: 'returned', label: rl('أعيد للتعديل', 'Returned for edit'), sub: rl('تحتاج تعديلاً وإعادة إرسال', 'Needs revision & resend'), accent: '#b0433b', bg: '#f7e6e4', icon: <Ico d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /> },
    { key: 'late', label: rl('متأخر', 'Overdue'), sub: rl('تجاوزت موعدها', 'Past their date'), accent: '#c26a2b', bg: '#f7ece0', icon: <Ico d="M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /> },
    { key: 'done', label: rl('معتمد / مكتمل', 'Approved / done'), sub: rl('أغلقها رئيس القطاع', 'Closed by the Sector Head'), accent: '#2e7d55', bg: '#e2f0e8', icon: <Ico d="M20 6 9 17l-5-5" /> },
  ];

  const active = CARDS.find((c) => c.key === card)!;
  const rows = buckets[card];

  const sendForReview = (t: { id: string; sec: string; isWork: boolean }) => {
    if (t.isWork) {
      mutateWork((w) => { const it = w.find((x) => x.id === t.id); if (it) { it.status = 'بانتظار مراجعة رئيس القطاع'; it.reason = undefined; } });
    } else {
      mutate((d) => {
        const coll = mColl(t.sec)!; const r = coll.get(d).find((x: any) => x.id === t.id);
        if (r) { r._mrev = true; r._mret = ''; r._mowner = r._mowner || cu.id; (r._mlog = r._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: 'بانتظار مراجعة رئيس القطاع', sent: true, by: cu.name }); }
      });
    }
    showToast(rl('تم إرسال البند لمراجعة رئيس القطاع', 'Sent for Sector Head review'));
  };

  return (
    <Fade style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('مرحباً، ', 'Welcome, ') + cu.name}</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#2f6aa8', background: '#e3edf6', border: '1px solid #d3e0ec', borderRadius: 20, padding: '4px 12px' }}>
          <Icon name="team" size={13} />{rl('مساحة عمل فريق المكتب', 'Office Team Workspace')}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#7d867f' }}>{cu.job}</p>
      <DemoHint />

      {/* six workflow filter cards */}
      <div className="rg3" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 11, margin: '14px 0 18px' }}>
        {CARDS.map((c) => {
          const on = card === c.key;
          return (
            <div key={c.key} onClick={() => setCard(c.key)} style={{
              cursor: 'pointer', borderRadius: 15, padding: '13px 14px', transition: 'all .15s',
              background: on ? '#ffffff' : '#f7f9f7', border: '1.5px solid ' + (on ? c.accent : '#e6ece7'),
              boxShadow: on ? '0 10px 26px -16px ' + c.accent : '0 1px 2px rgba(23,40,32,.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 9 }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? c.bg : '#eef1ec', color: on ? c.accent : '#9aa39b' }}>{c.icon}</span>
                <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.5px', color: on ? c.accent : '#c3cec4' }}>{buckets[c.key].length}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.3, color: '#17211c' }}>{c.label}</div>
              <div style={{ fontSize: 10, color: '#6d7973', marginTop: 2, lineHeight: 1.4 }}>{c.sub}</div>
            </div>
          );
        })}
      </div>

      {/* dynamic filtered list */}
      <div className="glass" style={{ borderRadius: 18, padding: '18px 20px', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 40px -22px rgba(23,40,32,.16)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 7, height: 22, borderRadius: 6, flex: 'none', background: active.accent }} />
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#17211c' }}>{active.label}</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6d7973', background: '#f2f4f0', borderRadius: 20, padding: '3px 10px' }}>{rows.length}</span>
        </div>
        {rows.length === 0 && <div style={{ padding: 22, textAlign: 'center', fontSize: 12.5, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد بنود في هذه الفئة', 'No items in this category')}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((it) => {
            const [bg, fg] = wf(it.status);
            return (
              <div key={(it.isWork ? 'w' : 'r') + it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fbfcfb', border: '1px solid #eef1ec', borderRadius: 12, padding: '11px 13px' }}>
                <div onClick={() => openItem(it)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{tr(it.title)}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>
                    {secName(it.sec)}{it.logLine ? ' · ↻ ' + tr(it.logLine) : ''}
                  </div>
                </div>
                <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: bg, color: fg }}>{tr(it.status)}</span>
                <button onClick={() => openItem(it)} style={{ ...btnGhost, padding: '6px 11px', fontSize: 11 }}>{rl('فتح', 'Open')}</button>
                <button onClick={() => setForm({ section: it.sec, editId: it.id })} style={{ ...btnGhost, padding: '6px 11px', fontSize: 11 }}>{rl('تعديل', 'Edit')}</button>
                {!it.review && it.status !== 'معتمد' && it.status !== 'مكتمل' && (
                  <button onClick={() => sendForReview(it)} style={{ ...btnPrimary, padding: '6px 11px', fontSize: 11 }}>{rl('إرسال', 'Send')}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* sections I can add to / update */}
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('أقسامي — إضافة وتحديث', 'My sections — add & update')}</h3>
          <p style={{ margin: '0 0 14px', fontSize: 11.5, color: '#9aa39b' }}>{rl('حسب صلاحياتك المعتمدة فقط', 'Per your approved permissions only')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groups.map((g) => {
              const s = SECTIONS.find((x) => x.k === g.sec);
              return (
                <div key={g.sec} style={{ border: '1px solid #eef1ec', borderRadius: 15, padding: '14px 15px', background: '#fbfcfa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                    <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: '#ebf2ec', color: '#2b5c44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={s ? s.icon : 'note'} size={17} /></span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: '#17211c' }}>{g.label}</span>
                    <button onClick={() => setForm({ section: g.sec, editId: null })} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة', 'Add')}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {g.items.length === 0 && <div style={{ fontSize: 12, color: '#9aa39b', padding: '4px 2px' }}>{rl('لا توجد بنود بعد', 'No items yet')}</div>}
                    {g.items.slice(0, 5).map((it) => {
                      const [bg, fg] = wf(it.status);
                      return (
                        <div key={(it.isWork ? 'w' : 'r') + it.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #eef1ec', borderRadius: 11, padding: '9px 11px' }}>
                          <div onClick={() => openItem(it)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(it.title)}</div>
                          </div>
                          <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', background: bg, color: fg }}>{tr(it.status)}</span>
                          <button onClick={() => setForm({ section: it.sec, editId: it.id })} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11 }}>{rl('تعديل', 'Edit')}</button>
                          {!it.review && it.status !== 'معتمد' && <button onClick={() => sendForReview(it)} style={{ ...btnPrimary, padding: '6px 11px', fontSize: 11 }}>{rl('إرسال', 'Send')}</button>}
                        </div>
                      );
                    })}
                    {g.items.length > 5 && <div style={{ fontSize: 11, color: '#9aa39b', padding: '2px 2px' }}>+{g.items.length - 5} {rl('بند آخر', 'more items')}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'linear-gradient(160deg,#1e4634,#17372a)', borderRadius: 20, boxShadow: '0 14px 34px -16px rgba(20,45,32,.5)', padding: '20px 22px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#c9a24b" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5 7.7 12 12 5l4.3 7L20 8.5 18.3 19H5.7z" /></svg><h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{rl('توجيهات رئيس القطاع', 'Sector Head directives')}</h3></div>
            {(MEMBER_DIRECTIVES[cu.id] || []).length === 0 && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', padding: '6px 0' }}>{rl('لا توجد توجيهات حالياً', 'No directives right now')}</div>}
            {(MEMBER_DIRECTIVES[cu.id] || []).map((d, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 13px', marginBottom: 9 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: '#fff' }}>{d.text}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginTop: 6 }}>{d.date}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('آخر النشاط', 'Recent activity')}</h3>
            {(MEMBER_RECENT[cu.id] || []).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f4f6f3' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b', marginTop: 6, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, color: '#2a332d', lineHeight: 1.5 }}>{r.text}</div><div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{r.date}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {form && <MemberForm open onClose={() => setForm(null)} section={form.section} editId={form.editId} />}
    </Fade>
  );
}

const btnGhost: React.CSSProperties = { background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 9, padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
const btnPrimary: React.CSSProperties = { background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };

function Ico({ d }: { d: string }) {
  return <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
