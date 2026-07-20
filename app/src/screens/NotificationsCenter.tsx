import { useState } from 'react';
import { Fade } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { buildNotifications, loadRead, markRead, markAllRead, dayLabel, KIND_STYLE, KIND_LABELS, type Notif } from '../layout/notifData';
import { WF } from '../domain/approval';
import { mColl } from './member/workflow';

/** Notifications Center: every alert in one place, grouped by day (newest
 *  first), with read/unread state, filters and search. Clicking an alert
 *  opens the exact related item. The chair's approval decisions now live on
 *  the dashboard "Chair approvals" tab; here we only point to them. */
export function NotificationsCenter() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const users = useStore((s) => s.users);
  const { goto } = useNav();
  const [tick, setTick] = useState(0);
  void tick;

  const [q, setQ] = useState('');
  const [fSec, setFSec] = useState('');
  const [fKind, setFKind] = useState('');
  const [fRead, setFRead] = useState<'' | 'unread' | 'read'>('');

  const all = buildNotifications(cu, data, work, users, lang, tr);
  const read = loadRead(cu.id);
  const unread = all.filter((n) => !read.has(n.key)).length;

  const secOpts = [{ v: '', label: rl('كل الأقسام', 'All sections') }, ...Array.from(new Set(all.map((n) => n.meta))).map((m) => ({ v: m, label: m }))];
  const kindOpts = [{ v: '', label: rl('كل الأنواع', 'All types') }, ...KIND_LABELS.filter((k) => all.some((n) => n.kind === k.k)).map((k) => ({ v: k.k, label: lang === 'en' ? k.en : k.ar }))];

  const list = all.filter((n) => {
    if (fSec && n.meta !== fSec) return false;
    if (fKind && n.kind !== fKind) return false;
    if (fRead === 'unread' && read.has(n.key)) return false;
    if (fRead === 'read' && !read.has(n.key)) return false;
    if (q.trim() && !(n.title.includes(q.trim()) || n.sub.includes(q.trim()) || n.meta.includes(q.trim()))) return false;
    return true;
  });

  // group by day, already sorted newest-first
  const groups: { day: number; items: Notif[] }[] = [];
  list.forEach((n) => {
    const g = groups.find((x) => x.day === n.day);
    if (g) g.items.push(n); else groups.push({ day: n.day, items: [n] });
  });

  const openNotif = (n: Notif) => {
    markRead(cu.id, n.key);
    setTick((t) => t + 1);
    if (n.page !== 'notifications') goto(n.page, n.params);
  };

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ border: '1px solid ' + (on ? '#1e4634' : '#e2e6df'), background: on ? '#eef3f0' : '#fff', color: on ? '#1e4634' : '#5b6b62', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );

  return (
    <Fade style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 700, color: '#17211c' }}>{rl('مركز التنبيهات', 'Notifications Center')}</h1>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#a9791f', background: '#fbf2df', borderRadius: 20, padding: '4px 12px' }}>{unread} {rl('غير مقروء', 'unread')}</span>
        <button onClick={() => { markAllRead(cu.id, all.map((n) => n.key)); setTick((t) => t + 1); }} style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {rl('تحديد الكل كمقروء', 'Mark all as read')}
        </button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6d7973' }}>
        {rl('كل التنبيهات في مكان واحد — النقر على أي تنبيه يفتح البند المرتبط به مباشرة.', 'All alerts in one place — clicking any alert opens its exact related item.')}
      </p>

      {cu.type === 'chair' && (() => {
        const REVIEW_DOC_SECS = ['correspondence', 'minutes', 'minuteTasks', 'committees', 'auditReports', 'reportLog', 'finReports', 'myTasks', 'reportCenter'];
        let n = 0;
        REVIEW_DOC_SECS.forEach((sec) => { const coll = mColl(sec); if (coll) coll.get(data).forEach((r: { _mrev?: boolean }) => { if (r._mrev) n++; }); });
        n += work.filter((w) => w.status === WF.pending && w.section !== 'projects' && w.section !== 'leaves').length;
        n += data.projects.filter((p) => p.status === 'بانتظار الاعتماد' || p.status === 'لم يبدأ' || (p.extendReq && !(p.extendReq as { decided?: boolean }).decided)).length;
        n += data.leaves.filter((l) => l.status === 'بانتظار الاعتماد').length;
        if (n === 0) return null;
        return (
          <div onClick={() => goto('dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderRadius: 16, padding: '15px 18px', background: '#fbf7ee', border: '1.5px solid #ecdcae' }}>
            <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf2df', color: '#a9791f' }}>
              <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#17211c' }}>{rl('بنود بانتظار اعتمادك', 'Items awaiting your approval')}</div>
              <div style={{ fontSize: 11.5, color: '#8a6a1f', marginTop: 2 }}>{rl('كل الاعتمادات موحّدة الآن في «اعتماد رئيس القطاع» باللوحة الرئيسية — اضغط للانتقال.', 'All approvals are now unified under “Chair approvals” on the dashboard — click to go.')}</div>
            </div>
            <span style={{ flex: 'none', fontSize: 13, fontWeight: 800, color: '#a9791f', background: '#fbf2df', borderRadius: 20, padding: '5px 14px' }}>{n}</span>
          </div>
        );
      })()}

      {/* filters */}
      <div className="glass" style={{ borderRadius: 16, padding: '12px 14px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', insetInlineStart: 12 }} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.9}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={rl('ابحث في التنبيهات…', 'Search notifications…')} style={{ width: '100%', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 9, padding: '9px 12px', paddingInlineStart: 38, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <Dropdown value={fSec} options={secOpts} onChange={setFSec} opt={{ size: 'sm', minWidth: '150px' }} />
        <Dropdown value={fKind} options={kindOpts} onChange={setFKind} opt={{ size: 'sm', minWidth: '150px' }} />
        {chip(fRead === '', rl('الكل', 'All'), () => setFRead(''))}
        {chip(fRead === 'unread', rl('غير مقروء', 'Unread'), () => setFRead(fRead === 'unread' ? '' : 'unread'))}
        {chip(fRead === 'read', rl('مقروء', 'Read'), () => setFRead(fRead === 'read' ? '' : 'read'))}
      </div>

      {/* grouped list */}
      {groups.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 18, padding: 44, textAlign: 'center', color: '#9aa39b', fontSize: 13.5, boxShadow: '0 2px 6px rgba(23,40,32,.04)' }}>
          {rl('لا توجد تنبيهات مطابقة', 'No matching notifications')}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.day} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#17211c' }}>{dayLabel(g.day, lang)}</h2>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5b6b62', background: '#eef1ec', borderRadius: 20, padding: '3px 11px' }}>
              {g.items.length} {g.items.length === 1 ? rl('تنبيه', 'notification') : rl('تنبيهات', 'notifications')}
            </span>
            <div style={{ flex: 1, height: 1, background: '#e8ebe6' }} />
          </div>
          <div style={{ background: '#ffffff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.14)' }}>
            {g.items.map((n, i) => {
              const st = KIND_STYLE[n.kind];
              const isRead = read.has(n.key);
              return (
                <button key={n.key} onClick={() => openNotif(n)} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, width: '100%', padding: '14px 18px', border: 'none', borderBottom: i < g.items.length - 1 ? '1px solid #f2f4f0' : 'none', background: isRead ? 'transparent' : '#f6faf7', cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f4f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isRead ? 'transparent' : '#f6faf7'; }}>
                  <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: st.bg, color: st.fg }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={st.icon} /></svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: isRead ? 600 : 800, color: '#17211c', lineHeight: 1.5 }}>{n.title}</span>
                    {n.sub && <span style={{ fontSize: 12, color: '#5b6b62', lineHeight: 1.55 }}>{n.sub}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: '#9aa39b' }}>
                      <span style={{ fontWeight: 700, color: '#7d867f' }}>{n.meta}</span>
                      <span>·</span>
                      <span>{n.time}</span>
                      <span>·</span>
                      <span style={{ fontWeight: 700, color: isRead ? '#9aa39b' : '#1f8a5b' }}>{isRead ? rl('مقروء', 'Read') : rl('غير مقروء', 'Unread')}</span>
                    </span>
                  </span>
                  {!isRead && <span style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: '#1f8a5b', marginTop: 12 }} />}
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#b3bbb2" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 10, transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}><path d="m9 6 6 6-6 6" /></svg>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Fade>
  );
}
