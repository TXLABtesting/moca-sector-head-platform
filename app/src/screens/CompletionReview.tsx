import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Fade } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { AttachmentDownload } from '../components/AttachmentDownload';
import { useStore } from '../store/store';
import { useNav, type Page, type NavParams } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { useCurrentUser } from '../store/useCurrentUser';
import { pendingCompletionItems, finalOf, CLOSED_PENDING, OWNER_OF } from './member/workflow';
import { SECTIONS } from '../domain/permissions';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Where "view details" lands, per underlying collection key. */
const TARGET: Record<string, (id: string) => { page: Page; params?: NavParams }> = {
  otasks: (id) => ({ page: 'otasks', params: { selOtask: id } }),
  mtasks: (id) => ({ page: 'mtasks', params: { selMtask: id } }),
  committees: (id) => ({ page: 'committees', params: { selCommittee: id } }),
  projects: (id) => ({ page: 'projectDetail', params: { selProject: id } }),
  auditReps: () => ({ page: 'auditDetail' }),
  audit: () => ({ page: 'auditDetail' }),
  regReports: () => ({ page: 'reglog' }),
  retReports: () => ({ page: 'reportDetail' }),
  finModels: () => ({ page: 'finDetail' }),
  correspondence: (id) => ({ page: 'docDetail', params: { selDoc: id } }),
  meetings: (id) => ({ page: 'meetingDetail', params: { selMeeting: id } }),
  leaves: (id) => ({ page: 'leaves', params: { selLeave: id } }),
};

/* Card groups (mirroring the dashboard filter-card concept). */
type GroupKey = 'all' | 'myTasks' | 'minuteTasks' | 'committees' | 'projects' | 'reports' | 'leaves';
interface GroupDef { key: GroupKey; ar: string; en: string; accent: string; icBg: string; icFg: string; icon: ReactNode; secs: string[] }

const IC = (d: string) => <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{d.split('|').map((p, i) => <path key={i} d={p} />)}</svg>;

const GROUPS: GroupDef[] = [
  { key: 'all', ar: 'جميع العناصر', en: 'All items', accent: '#1e4634', icBg: '#e9f0ec', icFg: '#1e4634', icon: IC('M4 6h16M4 12h16M4 18h16'), secs: [] },
  { key: 'myTasks', ar: 'مهام فريقي', en: 'Team tasks', accent: '#2f6aa8', icBg: '#e6eef6', icFg: '#2f6aa8', icon: IC('M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2|M9 3h6v4H9z|m9 14 2 2 4-4'), secs: ['myTasks'] },
  { key: 'minuteTasks', ar: 'مهام محاضر الاجتماعات', en: 'Minute tasks', accent: '#7a4d94', icBg: '#f3ecf6', icFg: '#7a4d94', icon: IC('M8 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 8 3.5Z|M13.5 3.5V8h4.5|M9 12.5h6M9 16h4'), secs: ['minuteTasks'] },
  { key: 'committees', ar: 'مهام اللجان', en: 'Committee tasks', accent: '#2b8a8a', icBg: '#e4f2f2', icFg: '#2b8a8a', icon: IC('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11'), secs: ['committees'] },
  { key: 'projects', ar: 'المشاريع ومراحل المشاريع', en: 'Projects & phases', accent: '#3a6ea5', icBg: '#e9f0f6', icFg: '#3a6ea5', icon: IC('M3 8a2 2 0 0 1 2-2h3.3c.5 0 1 .2 1.4.6l1.1 1.2c.4.4.9.6 1.4.6H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'), secs: ['projects'] },
  { key: 'reports', ar: 'التقارير وملاحظات التدقيق', en: 'Reports & audit', accent: '#a9791f', icBg: '#fbf0d6', icFg: '#a9791f', icon: IC('M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z|M14 2v6h6|M8 13h8M8 17h5'), secs: ['auditReports', 'reportLog', 'reportCenter', 'finReports'] },
];

const SEC2GROUP: Record<string, GroupKey> = (() => {
  const m: Record<string, GroupKey> = {};
  GROUPS.forEach((g) => g.secs.forEach((s) => { m[s] = g.key; }));
  return m;
})();

// Persist the selected card + search across detail navigation (screen remounts).
let lastGroup: GroupKey = 'all';
let lastSearch = '';
let lastOwner = '';

export function CompletionReview() {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const data = useStore((s) => s.data);
  const users = useStore((s) => s.users);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const { goto } = useNav();
  const { showToast } = useToast();

  const [group, setGroup] = useState<GroupKey>(lastGroup);
  const [search, setSearch] = useState(lastSearch);
  const [owner, setOwner] = useState(lastOwner);
  const [returnFor, setReturnFor] = useState<{ sec: string; id: string } | null>(null);
  const [reason, setReason] = useState('');
  const pick = (g: GroupKey) => { setGroup(g); lastGroup = g; };
  const onSearch = (v: string) => { setSearch(v); lastSearch = v; };
  const onOwner = (v: string) => { setOwner(v); lastOwner = v; };

  if (cu.type !== 'chair') {
    return <Fade><div style={{ padding: 44, textAlign: 'center', color: '#9aa39b', fontSize: 14 }}>{rl('هذا القسم مخصص لرئيس القطاع.', 'This section is for the Sector Head.')}</div></Fade>;
  }

  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };
  const userName = (id: string) => { const u = users.find((x) => x.id === id); return u ? tr(u.name) : ''; };

  // Oldest-waiting first: collections unshift newest, so reverse the aggregation.
  const all = pendingCompletionItems(data).slice().reverse().map(({ sec, coll, r }) => {
    const ownerStr = OWNER_OF[String(coll.key)]?.(r) || '';
    const requester = (ownerStr && ownerStr.trim()) ? tr(ownerStr) : (userName(r._mowner || '') || rl('غير محدد', 'Unassigned'));
    const reqAt = r._mcompAt || r._mlog?.[0]?.at || r.lastUpdate || r.lastDate || '—';
    const lastUpd = r.lastUpdate || r.lastDate || r._mlog?.[0]?.at || '—';
    const progress = typeof r.progress === 'number' ? r.progress : undefined;
    const atts: string[] = Array.from(new Set([r.attachment, ...(r.attachments || [])].filter((a: any): a is string => !!a && !!String(a).trim())));
    const notes = (r.notes || r.desc || r.summary || '').toString().trim();
    return {
      sec, collKey: String(coll.key), id: r.id, group: SEC2GROUP[sec] || 'all',
      pendingStatus: coll.status(r),
      typeLabel: secName(sec), title: tr(coll.title(r)), requester,
      reqAt: dl(reqAt), lastUpd: dl(lastUpd), progress, atts, notes,
    };
  });

  const counts: Record<GroupKey, number> = { all: all.length, myTasks: 0, minuteTasks: 0, committees: 0, projects: 0, reports: 0, leaves: 0 };
  all.forEach((x) => { counts[x.group as GroupKey] = (counts[x.group as GroupKey] || 0) + 1; });

  const owners = Array.from(new Set(all.map((x) => x.requester))).filter(Boolean);
  const q = search.trim();
  const rows = all.filter((x) => {
    if (group !== 'all' && x.group !== group) return false;
    if (owner && x.requester !== owner) return false;
    if (q && !(x.title.includes(q) || x.typeLabel.includes(q) || x.requester.includes(q))) return false;
    return true;
  });

  const openDetail = (collKey: string, id: string) => { const tg = TARGET[collKey]?.(id) || { page: 'dashboard' as Page }; goto(tg.page, tg.params); };

  const approve = (sec: string, id: string) => {
    mutate((d) => {
      const coll = pendingCompletionItems(d).find((x) => x.sec === sec && x.r.id === id)?.coll;
      const rec = coll?.get(d).find((x: any) => x.id === id);
      if (coll && rec) {
        const finalStatus = finalOf(coll.status(rec));
        coll.setStatus(rec, finalStatus);
        if (typeof rec.progress === 'number') rec.progress = 100;
        rec._mret = ''; rec._mrev = false; rec._mapproved = true;
        rec._mlog = rec._mlog || [];
        rec._mlog.unshift({ at: lang === 'en' ? 'Just now' : 'الآن', to: finalStatus, note: rl('اعتمد رئيس القطاع ', 'Approved by the Sector Head: ') + finalStatus, chair: true, by: cu.name });
      }
    });
    showToast(rl('تم اعتماد الاكتمال', 'Completion approved'));
  };

  const doReturn = () => {
    if (!returnFor) return;
    const rsn = reason.trim();
    if (!rsn) { showToast(rl('يرجى إدخال سبب الإرجاع', 'Please enter a return reason')); return; }
    const { sec, id } = returnFor;
    mutate((d) => {
      const coll = pendingCompletionItems(d).find((x) => x.sec === sec && x.r.id === id)?.coll;
      const rec = coll?.get(d).find((x: any) => x.id === id);
      if (coll && rec) {
        coll.setStatus(rec, 'قيد التنفيذ');
        rec._mret = rsn; rec._mrev = false; rec._mapproved = false;
        rec._mlog = rec._mlog || [];
        rec._mlog.unshift({ at: lang === 'en' ? 'Just now' : 'الآن', to: 'قيد التنفيذ', note: rl('أعاد رئيس القطاع البند للتعديل: ', 'Returned for edits: ') + rsn, chair: true, by: cu.name });
      }
    });
    setReturnFor(null); setReason('');
    showToast(rl('تمت إعادة البند للتعديل', 'Item returned for edits'));
  };

  const activeDef = GROUPS.find((g) => g.key === group)!;
  const metaLbl: CSSProperties = { fontSize: 10, color: '#9aa39b', fontWeight: 600, marginBottom: 2 };
  const metaVal: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#2a332d' };
  const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#fff', borderRadius: 10, padding: '9px 12px', paddingInlineStart: 36, fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };

  return (
    <Fade>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('قيد مراجعة الاكتمال', 'Completion review')}</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('كل العناصر التي حدّدها المسؤولون كمنجزة وتنتظر اعتماد رئيس القطاع لتصبح «مكتمل».', 'All items marked done by owners, awaiting the Sector Head’s approval to become “Completed”.')}</p>
      </div>

      {/* FILTER CARDS */}
      <div className="rg-comp" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {GROUPS.map((g) => {
          const on = group === g.key;
          return (
            <div key={g.key} onClick={() => pick(g.key)} style={{
              cursor: 'pointer', borderRadius: 16, padding: '15px 16px', transition: 'all .15s',
              background: on ? '#fff' : '#f7f9f7', border: '1.5px solid ' + (on ? g.accent : '#e6ece7'),
              boxShadow: on ? '0 10px 26px -16px ' + g.accent : '0 1px 2px rgba(23,40,32,.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? g.icBg : '#eef1ec', color: on ? g.icFg : '#9aa39b' }}>{g.icon}</span>
                <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.5px', color: on ? g.accent : '#c3cec4' }}>{counts[g.key]}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.35, color: '#17211c' }}>{lang === 'en' ? g.en : g.ar}</div>
            </div>
          );
        })}
      </div>

      {/* TOOLBAR: search + owner filter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 220 }}>
          <svg style={{ position: 'absolute', insetInlineStart: 12 }} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.9}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={rl('بحث باسم العنصر…', 'Search item name…')} style={inputStyle} />
        </div>
        <Dropdown value={owner} onChange={onOwner} options={[{ v: '', label: rl('كل المسؤولين', 'All owners') }, ...owners.map((o) => ({ v: o, label: o }))]} opt={{ size: 'sm', minWidth: '180px' }} />
      </div>

      {/* CONTENT */}
      <div className="glass" style={{ borderRadius: 20, padding: '22px 24px', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 40px -22px rgba(23,40,32,.16)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
          <span style={{ width: 8, height: 26, borderRadius: 6, flex: 'none', background: activeDef.accent }} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#17211c' }}>{lang === 'en' ? activeDef.en : activeDef.ar}</h2>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6d7973', background: '#f2f4f0', borderRadius: 20, padding: '3px 11px' }}>{rows.length}</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 34, textAlign: 'center', fontSize: 13.5, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد عناصر بانتظار اعتماد الاكتمال هنا.', 'No items awaiting completion approval here.')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((row) => (
              <div key={row.collKey + ':' + row.id} onClick={() => openDetail(row.collKey, row.id)} style={{ border: '1px solid #eef1ec', borderRadius: 14, padding: '15px 17px', background: '#fbfcfb', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 7, padding: '4px 9px', background: '#eef4f0', color: '#1f4a37' }}>{row.typeLabel}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: '#fbf0d6', color: '#a9791f' }}>{tr(row.pendingStatus)}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#17211c', marginBottom: 10, lineHeight: 1.4 }}>{row.title}</div>
                    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                      <div><div style={metaLbl}>{rl('طلب الاعتماد', 'Requested by')}</div><div style={metaVal}>{row.requester}</div></div>
                      <div><div style={metaLbl}>{rl('تاريخ الطلب', 'Requested on')}</div><div style={metaVal}>{row.reqAt}</div></div>
                      <div><div style={metaLbl}>{rl('آخر تحديث', 'Last update')}</div><div style={metaVal}>{row.lastUpd}</div></div>
                      {row.progress !== undefined && <div><div style={metaLbl}>{rl('نسبة الإنجاز', 'Progress')}</div><div style={metaVal}>{row.progress}%</div></div>}
                    </div>
                    {!!row.notes && <div style={{ marginTop: 10, fontSize: 12, color: '#3c4a42', lineHeight: 1.6, background: '#f7f8f6', borderRadius: 10, padding: '8px 11px' }}>{tr(row.notes)}</div>}
                    {row.atts.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {row.atts.map((a, i) => (
                          <span key={i} onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f7f8f6', border: '1px solid #eef1ec', borderRadius: 8, padding: '4px 9px', fontSize: 10.5, color: '#3c4a42' }}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#b0433b" strokeWidth={1.7} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                            <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr(a)}</span>
                            <AttachmentDownload name={a} size={20} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none', minWidth: 150 }}>
                    <button onClick={(e) => { e.stopPropagation(); approve(row.sec, row.id); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{row.pendingStatus === CLOSED_PENDING ? rl('اعتماد الإغلاق', 'Approve closure') : rl('اعتماد الاكتمال', 'Approve')}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setReturnFor({ sec: row.sec, id: row.id }); setReason(''); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f7e6e4', border: '1px solid #f0d3cf', color: '#b0433b', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>{rl('إرجاع للتعديل', 'Return')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {returnFor && createPortal(
        <div onClick={() => setReturnFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(23,33,28,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'ovBg .2s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: 440, maxWidth: '100%', animation: 'ovCard .25s ease' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #eef0ec' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{rl('إرجاع البند للتعديل', 'Return item for edits')}</h2>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <label style={{ fontSize: 12, color: '#5b6b62', fontWeight: 600, display: 'block', marginBottom: 6 }}>{rl('سبب الإرجاع', 'Return reason')}</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={rl('وضّح ما يلزم تعديله…', 'Explain what needs fixing…')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #eef0ec', display: 'flex', gap: 10 }}>
              <button onClick={doReturn} style={{ background: '#b0433b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{rl('إرجاع', 'Return')}</button>
              <button onClick={() => setReturnFor(null)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#5b6b62', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Fade>
  );
}
