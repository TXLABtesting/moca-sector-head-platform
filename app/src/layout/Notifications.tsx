import { useState } from 'react';
import { useStore } from '../store/store';
import { useNav, type Page, type NavParams } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { mColl, OWNER_OF, ownedBy } from '../screens/member/workflow';
import { SECTIONS, SEC_PAGE } from '../domain/permissions';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Kind = 'returned' | 'approved' | 'review' | 'meeting' | 'directive' | 'leave';

interface Notif {
  key: string; kind: Kind;
  title: string; sub: string; meta: string;
  page: Page; params?: NavParams;
}

/** Collections that carry the member↔chair loop (one section per collection). */
const SCAN_SECS = ['correspondence', 'followups', 'projects', 'minutes', 'committees', 'leaves', 'auditReports', 'reportLog', 'myTasks'];

/** Where a notification lands: the item's own detail where one exists, else the section page. */
const TARGET: Record<string, (id: string) => { page: Page; params?: NavParams }> = {
  projects: (id) => ({ page: 'projectDetail', params: { selProject: id } }),
  correspondence: (id) => ({ page: 'docDetail', params: { selDoc: id } }),
  meetings: (id) => ({ page: 'meetingDetail', params: { selMeeting: id } }),
  otasks: (id) => ({ page: 'otasks', params: { selOtask: id } }),
  committees: () => ({ page: 'committees' }),
  leaves: () => ({ page: 'leaves' }),
  audit: () => ({ page: 'auditDetail' }),
  regReports: () => ({ page: 'reglog' }),
  actions: () => ({ page: 'actions' }),
};

const KIND_STYLE: Record<Kind, { bg: string; fg: string; icon: string }> = {
  returned: { bg: '#f7e6e4', fg: '#b0433b', icon: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' },
  approved: { bg: '#e2f0e8', fg: '#2e7d55', icon: 'M20 6 9 17l-5-5' },
  review: { bg: '#fbf2df', fg: '#a9791f', icon: 'M22 12h-5l-2 3h-6l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z' },
  meeting: { bg: '#e6eef6', fg: '#3a6ea5', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  directive: { bg: '#fbf2df', fg: '#a9791f', icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' },
  leave: { bg: '#f0eaf6', fg: '#7a4fa3', icon: 'M8 3v4M16 3v4M3.5 10.5h17M3.5 8.5A3.5 3.5 0 0 1 7 5h10a3.5 3.5 0 0 1 3.5 3.5v9A3.5 3.5 0 0 1 17 21H7a3.5 3.5 0 0 1-3.5-3.5v-9Z' },
};

const seenKey = (uid: string) => 'moca.seenNotifs.' + uid;
function loadSeen(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || '[]')); } catch { return new Set(); }
}
function saveSeen(uid: string, keys: string[]) {
  try { localStorage.setItem(seenKey(uid), JSON.stringify(keys.slice(0, 200))); } catch { /* noop */ }
}

/** Header bell: live alerts for the current role; clicking one navigates
 *  straight to the item (or its section) it belongs to. */
export function NotificationsBell() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const users = useStore((s) => s.users);
  const { goto } = useNav();
  const [open, setOpen] = useState(false);
  const [seenTick, setSeenTick] = useState(0); // re-render after marking seen

  const isChair = cu.type === 'chair';
  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };
  const userName = (id: string) => { const u = users.find((x) => x.id === id); return u ? tr(u.name) : rl('فريق المكتب', 'Office team'); };
  const target = (collKey: string, id: string) => TARGET[collKey]?.(id) || { page: 'dashboard' as Page };

  const items: Notif[] = [];

  if (isChair) {
    SCAN_SECS.forEach((sec) => {
      const coll = mColl(sec); if (!coll) return;
      coll.get(data).forEach((r: any) => {
        if (!r._mrev) return;
        const tg = target(String(coll.key), r.id);
        items.push({
          key: 'rev:' + r.id, kind: 'review',
          title: rl('بانتظار مراجعتك: ', 'Awaiting your review: ') + tr(coll.title(r)),
          sub: rl('من ', 'From ') + userName(r._mowner || ''),
          meta: secName(sec), page: tg.page, params: tg.params,
        });
      });
    });
    work.filter((w) => w.status === 'بانتظار مراجعة رئيس القطاع').forEach((w) => {
      items.push({ key: 'revw:' + w.id, kind: 'review', title: rl('بانتظار مراجعتك: ', 'Awaiting your review: ') + tr(w.title), sub: rl('من ', 'From ') + userName(w.owner), meta: secName(w.section), page: 'dashboard' });
    });
    data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد').forEach((m) => {
      items.push({ key: 'mtg:' + m.id, kind: 'meeting', title: rl('طلب اجتماع بانتظار الاعتماد: ', 'Meeting awaiting approval: ') + tr(m.subject), sub: tr(m.proposed), meta: rl('الاجتماعات', 'Meetings'), page: 'reqmeetings', params: { selMeeting: m.id } });
    });
    data.leaves.filter((l) => l.status === 'بانتظار الاعتماد').forEach((l) => {
      items.push({ key: 'lv:' + l.id, kind: 'leave', title: rl('طلب إجازة بانتظار الاعتماد: ', 'Leave request awaiting approval: ') + tr(l.person), sub: tr(l.type) + ' · ' + tr(l.start), meta: rl('الإجازات', 'Leaves'), page: 'leaves' });
    });
  } else {
    SCAN_SECS.forEach((sec) => {
      const coll = mColl(sec); if (!coll) return;
      coll.get(data).forEach((r: any) => {
        const mine = r._mowner === cu.id || ownedBy(OWNER_OF[String(coll.key)]?.(r) || '', cu.name);
        if (!mine) return;
        const tg = target(String(coll.key), r.id);
        if (r._mret) {
          items.push({ key: 'ret:' + r.id, kind: 'returned', title: rl('أعيد للتعديل: ', 'Returned for edits: ') + tr(coll.title(r)), sub: rl('سبب الإرجاع: ', 'Reason: ') + r._mret, meta: secName(sec), page: tg.page, params: tg.params });
        } else if (r._mdirective) {
          items.push({ key: 'dir:' + r.id, kind: 'directive', title: rl('توجيه من رئيس القطاع: ', 'Directive from the Sector Head: ') + tr(coll.title(r)), sub: r._mdirective, meta: secName(sec), page: tg.page, params: tg.params });
        } else if (r._mapproved) {
          items.push({ key: 'app:' + r.id, kind: 'approved', title: rl('تم الاعتماد: ', 'Approved: ') + tr(coll.title(r)), sub: rl('اعتمده رئيس القطاع', 'Approved by the Sector Head'), meta: secName(sec), page: tg.page, params: tg.params });
        }
      });
    });
    work.filter((w) => w.owner === cu.id && w.status === 'أعيد للتعديل').forEach((w) => {
      items.push({ key: 'retw:' + w.id, kind: 'returned', title: rl('أعيد للتعديل: ', 'Returned for edits: ') + tr(w.title), sub: rl('سبب الإرجاع: ', 'Reason: ') + (w.reason || ''), meta: secName(w.section), page: (SEC_PAGE[w.section] || 'dashboard') as Page });
    });
    data.reqMeetings.forEach((m: any) => {
      if (m._mowner !== cu.id) return;
      if (m.status === 'تم اقتراح موعد آخر') {
        items.push({ key: 'mtgp:' + m.id, kind: 'meeting', title: rl('اقترح رئيس القطاع موعدًا آخر: ', 'The Sector Head proposed another time: ') + tr(m.subject), sub: (m.newDate ? tr(m.newDate) + (m.newTime ? ' - ' + m.newTime : '') : ''), meta: rl('الاجتماعات', 'Meetings'), page: 'reqmeetings', params: { selMeeting: m.id } });
      } else if (m.status === 'معتمد') {
        items.push({ key: 'mtga:' + m.id, kind: 'approved', title: rl('تم اعتماد الاجتماع: ', 'Meeting approved: ') + tr(m.subject), sub: rl('يمكن إضافته إلى تقويم Outlook', 'Can be added to Outlook calendar'), meta: rl('الاجتماعات', 'Meetings'), page: 'reqmeetings', params: { selMeeting: m.id } });
      }
    });
  }

  const list = items.slice(0, 30);
  void seenTick;
  const seen = loadSeen(cu.id);
  const unseen = list.filter((n) => !seen.has(n.key)).length;

  const toggle = () => {
    setOpen((v) => {
      if (!v) { saveSeen(cu.id, [...new Set([...seen, ...list.map((n) => n.key)])]); setSeenTick((t) => t + 1); }
      return !v;
    });
  };

  const openNotif = (n: Notif) => {
    setOpen(false);
    goto(n.page, n.params);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={toggle} title={rl('التنبيهات', 'Notifications')} style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, border: '1px solid #ebeee9', background: open ? '#f2f7f4' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3c4a42', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5a5 5 0 0 0-5 5c0 4-1.5 5.5-1.5 5.5h13S17 15.5 17 11.5a5 5 0 0 0-5-5Z" /><path d="M10 19.5a2 2 0 0 0 4 0M12 4v2.5" /></svg>
        {unseen > 0 && (
          <span style={{ position: 'absolute', top: 4, insetInlineEnd: 4, minWidth: 16, height: 16, borderRadius: 9, background: '#b0433b', color: '#fff', border: '2px solid #fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>{unseen > 9 ? '9+' : unseen}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 590 }} />
          <div style={{ position: 'absolute', top: 50, insetInlineEnd: 0, width: 380, maxWidth: '86vw', background: '#fff', border: '1px solid #edf0ea', borderRadius: 16, boxShadow: '0 16px 44px -12px rgba(23,40,32,.3),0 3px 10px rgba(23,40,32,.07)', padding: 8, zIndex: 600, animation: 'fadeUp .14s ease', maxHeight: '72vh', overflowY: 'auto' }}>
            <div style={{ padding: '8px 11px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#17211c' }}>{rl('التنبيهات', 'Notifications')}</span>
              <span style={{ fontSize: 10.5, color: '#9aa39b' }}>{list.length} {rl('تنبيه', 'alerts')}</span>
            </div>
            {list.length === 0 && (
              <div style={{ padding: '26px 12px', textAlign: 'center', color: '#9aa39b', fontSize: 12.5 }}>{rl('لا توجد تنبيهات حالياً', 'No notifications right now')}</div>
            )}
            {list.map((n) => {
              const st = KIND_STYLE[n.kind];
              return (
                <button key={n.key} onClick={() => openNotif(n)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', padding: '10px 11px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', borderRadius: 12, fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f7f4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: st.bg, color: st.fg }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={st.icon} /></svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45 }}>{n.title}</span>
                    {n.sub && <span style={{ fontSize: 11, color: '#5b6b62', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.sub}</span>}
                    <span style={{ fontSize: 10, color: '#9aa39b' }}>{n.meta}</span>
                  </span>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#b3bbb2" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 6, transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}><path d="m9 6 6 6-6 6" /></svg>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
