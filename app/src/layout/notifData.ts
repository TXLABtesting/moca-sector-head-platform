import type { AppData } from '../data/types';
import type { Page, NavParams } from '../store/nav';
import type { SeedUser } from '../domain/permissions';
import { SECTIONS, SEC_PAGE } from '../domain/permissions';
import { mColl, OWNER_OF, ownedBy } from '../screens/member/workflow';
import { chairNotesForUser } from '../domain/reportNotes';
import { todayPlus } from '../shared/today';
import { AR_MONTHS } from '../shared/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type NotifKind = 'returned' | 'approved' | 'review' | 'meeting' | 'directive' | 'leave' | 'update';

export interface Notif {
  key: string; kind: NotifKind;
  title: string; sub: string; meta: string;
  page: Page; params?: NavParams;
  day: number;      // 0 = today, 1 = yesterday, larger = older
  time: string;     // display time within the day
  ord: number;      // ascending = newest first
}

interface WorkItem { id: string; owner: string; section: string; title: string; status: string; reason?: string; directive?: string }

/** Collections that carry the member↔chair loop (one section per collection). */
const SCAN_SECS = ['correspondence', 'projects', 'minutes', 'minuteTasks', 'committees', 'leaves', 'auditReports', 'reportLog', 'finReports', 'myTasks', 'reportCenter'];

/** Where a notification lands: the exact item where a detail exists, else the section page. */
const TARGET: Record<string, (id: string) => { page: Page; params?: NavParams }> = {
  projects: (id) => ({ page: 'projectDetail', params: { selProject: id } }),
  correspondence: (id) => ({ page: 'docDetail', params: { selDoc: id } }),
  meetings: (id) => ({ page: 'meetingDetail', params: { selMeeting: id } }),
  otasks: (id) => ({ page: 'otasks', params: { selOtask: id } }),
  committees: (id) => ({ page: 'committees', params: { selCommittee: id } }),
  leaves: (id) => ({ page: 'leaves', params: { selLeave: id } }),
  audit: () => ({ page: 'auditDetail' }),
  regReports: () => ({ page: 'reglog' }),
  retReports: () => ({ page: 'reportDetail' }),
  mtasks: (id) => ({ page: 'mtasks', params: { selMtask: id } }),
  auditReps: () => ({ page: 'auditDetail' }),
  finModels: () => ({ page: 'finDetail' }),
};

export const KIND_LABELS: { k: NotifKind; ar: string; en: string }[] = [
  { k: 'review', ar: 'بانتظار المراجعة', en: 'Awaiting review' },
  { k: 'returned', ar: 'أعيد للتعديل', en: 'Returned' },
  { k: 'approved', ar: 'اعتماد', en: 'Approved' },
  { k: 'directive', ar: 'توجيه', en: 'Directive' },
  { k: 'update', ar: 'طلب تحديث', en: 'Update requested' },
  { k: 'meeting', ar: 'اجتماعات', en: 'Meetings' },
  { k: 'leave', ar: 'إجازات', en: 'Leaves' },
];

/* ---- deterministic pseudo-timestamps (demo data has no real clock) ---- */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const DAY_POOL = [0, 0, 1, 1, 3, 5]; // weighted toward recent days
const M_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dayLabel(day: number, lang: string): string {
  if (day === 0) return lang === 'en' ? 'Today' : 'اليوم';
  if (day === 1) return lang === 'en' ? 'Yesterday' : 'أمس';
  const d = todayPlus(-day);
  return d.getDate() + ' ' + (lang === 'en' ? M_EN : AR_MONTHS)[d.getMonth()] + ' ' + d.getFullYear();
}
function stamp(key: string, fresh: boolean, lang: string): { day: number; time: string; ord: number } {
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  if (fresh) return { day: 0, time: rl('الآن', 'Just now'), ord: 0 };
  const h = hash(key);
  const day = DAY_POOL[h % DAY_POOL.length];
  const hour = 8 + (h % 9);           // 8..16
  const min = [5, 20, 35, 50][(h >> 3) % 4];
  const ap = hour < 12 ? rl('ص', 'AM') : rl('م', 'PM');
  let hh = hour % 12; if (hh === 0) hh = 12;
  const time = hh + ':' + String(min).padStart(2, '0') + ' ' + ap;
  return { day, time, ord: day * 10000 + (24 - hour) * 100 + (60 - min) };
}
/** A record edited this session carries a "just now" log entry. */
const isFresh = (r: any): boolean => {
  const at = r?._mlog?.[0]?.at;
  return at === 'الآن' || at === 'Just now';
};

/** Build the full, sorted (newest-first) notification list for the current user. */
export function buildNotifications(
  cu: SeedUser, data: AppData, work: WorkItem[], users: SeedUser[],
  lang: string, tr: (s: string | null | undefined) => string,
): Notif[] {
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const isChair = cu.type === 'chair';
  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };
  const userName = (id: string) => { const u = users.find((x) => x.id === id); return u ? tr(u.name) : rl('فريق المكتب', 'Office team'); };
  const target = (collKey: string, id: string) => TARGET[collKey]?.(id) || { page: 'dashboard' as Page };

  const items: Notif[] = [];
  const push = (n: Omit<Notif, 'day' | 'time' | 'ord'>, fresh: boolean) => {
    items.push({ ...n, ...stamp(n.key, fresh, lang) });
  };

  if (isChair) {
    SCAN_SECS.forEach((sec) => {
      const coll = mColl(sec); if (!coll) return;
      coll.get(data).forEach((r: any) => {
        if (!r._mrev) return;
        const tg = target(String(coll.key), r.id);
        push({
          key: 'rev:' + r.id, kind: 'review',
          title: rl('بانتظار مراجعتك: ', 'Awaiting your review: ') + tr(coll.title(r)),
          sub: rl('من ', 'From ') + userName(r._mowner || ''),
          meta: secName(sec), page: tg.page, params: tg.params,
        }, isFresh(r));
      });
    });
    work.filter((w) => w.status === 'بانتظار اعتماد رئيس القطاع').forEach((w) => {
      push({ key: 'revw:' + w.id, kind: 'review', title: rl('بانتظار مراجعتك: ', 'Awaiting your review: ') + tr(w.title), sub: rl('من ', 'From ') + userName(w.owner), meta: secName(w.section), page: 'notifications' }, false);
    });
    data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد').forEach((m) => {
      push({ key: 'mtg:' + m.id, kind: 'meeting', title: rl('طلب اجتماع بانتظار الاعتماد: ', 'Meeting awaiting approval: ') + tr(m.subject), sub: tr(m.proposed), meta: rl('الاجتماعات', 'Meetings'), page: 'reqmeetings', params: { selMeeting: m.id } }, false);
    });
    data.leaves.filter((l) => l.status === 'بانتظار الاعتماد').forEach((l) => {
      push({ key: 'lv:' + l.id, kind: 'leave', title: rl('طلب إجازة بانتظار الاعتماد: ', 'Leave request awaiting approval: ') + tr(l.person), sub: tr(l.type) + ' · ' + tr(l.start), meta: rl('الإجازات', 'Leaves'), page: 'leaves', params: { selLeave: l.id } }, isFresh(l));
    });
  } else {
    SCAN_SECS.forEach((sec) => {
      const coll = mColl(sec); if (!coll) return;
      coll.get(data).forEach((r: any) => {
        const mine = r._mowner === cu.id || ownedBy(OWNER_OF[String(coll.key)]?.(r) || '', cu.name);
        if (!mine) return;
        const tg = target(String(coll.key), r.id);
        if (r._mret) {
          push({ key: 'ret:' + r.id, kind: 'returned', title: rl('أعيد للتعديل: ', 'Returned for edits: ') + tr(coll.title(r)), sub: rl('سبب الإرجاع: ', 'Reason: ') + r._mret, meta: secName(sec), page: tg.page, params: tg.params }, isFresh(r));
        } else if (r._mdirective) {
          push({ key: 'dir:' + r.id, kind: 'directive', title: rl('توجيه من رئيس القطاع: ', 'Directive from the Sector Head: ') + tr(coll.title(r)), sub: r._mdirective, meta: secName(sec), page: tg.page, params: tg.params }, isFresh(r));
        } else if (r._mapproved) {
          push({ key: 'app:' + r.id, kind: 'approved', title: rl('تم الاعتماد: ', 'Approved: ') + tr(coll.title(r)), sub: rl('اعتمده رئيس القطاع', 'Approved by the Sector Head'), meta: secName(sec), page: tg.page, params: tg.params }, isFresh(r));
        }
      });
    });
    work.filter((w) => w.owner === cu.id && w.status === 'أعيد للتعديل').forEach((w) => {
      push({ key: 'retw:' + w.id, kind: 'returned', title: rl('أعيد للتعديل: ', 'Returned for edits: ') + tr(w.title), sub: rl('سبب الإرجاع: ', 'Reason: ') + (w.reason || ''), meta: secName(w.section), page: (SEC_PAGE[w.section] || 'dashboard') as Page }, false);
    });
    work.filter((w) => w.owner === cu.id && w.directive).forEach((w) => {
      push({ key: 'dirw:' + w.id, kind: 'directive', title: rl('توجيه من رئيس القطاع: ', 'Directive from the Sector Head: ') + tr(w.title), sub: w.directive!, meta: secName(w.section), page: (SEC_PAGE[w.section] || 'dashboard') as Page }, true);
    });
    (data.updateRequests || []).filter((u) => ownedBy(u.owner, cu.name)).forEach((u) => {
      push({ key: 'upd:' + u.id, kind: 'update', title: rl('طلب تحديث من رئيس القطاع: ', 'Update requested by the Sector Head: ') + tr(u.title), sub: u.note ? tr(u.note) : rl('يرجى تحديث هذا البند وإعادة إرساله.', 'Please update this item and resubmit.'), meta: secName(u.section), page: (SEC_PAGE[u.section] || 'dashboard') as Page }, true);
    });
    // Sector Head notes on a report the member is responsible for.
    chairNotesForUser(data, cu).forEach((h) => {
      push({ key: 'rnote:' + h.key + ':' + h.note.date + ':' + h.note.text.slice(0, 24), kind: 'directive', title: rl('ملاحظة رئيس القطاع على ', 'Sector Head note on ') + (lang === 'en' ? h.en : h.ar), sub: tr(h.note.text), meta: rl('مركز التقارير', 'Report Center'), page: h.page }, true);
    });
    data.reqMeetings.forEach((m: any) => {
      if (m._mowner !== cu.id) return;
      if (m.status === 'تم اقتراح موعد آخر') {
        push({ key: 'mtgp:' + m.id, kind: 'meeting', title: rl('اقترح رئيس القطاع موعدًا آخر: ', 'The Sector Head proposed another time: ') + tr(m.subject), sub: (m.newDate ? tr(m.newDate) + (m.newTime ? ' - ' + m.newTime : '') : ''), meta: rl('الاجتماعات', 'Meetings'), page: 'reqmeetings', params: { selMeeting: m.id } }, true);
      } else if (m.status === 'معتمد') {
        push({ key: 'mtga:' + m.id, kind: 'approved', title: rl('تم اعتماد الاجتماع: ', 'Meeting approved: ') + tr(m.subject), sub: rl('يمكن إضافته إلى تقويم Outlook', 'Can be added to Outlook calendar'), meta: rl('الاجتماعات', 'Meetings'), page: 'reqmeetings', params: { selMeeting: m.id } }, true);
      }
    });
  }

  return items.sort((a, b) => a.ord - b.ord);
}

/* ---- read/unread state (persisted per user) ---- */
const readKey = (uid: string) => 'moca.notifRead.' + uid;
export function loadRead(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(readKey(uid)) || '[]')); } catch { return new Set(); }
}
export function saveRead(uid: string, keys: Iterable<string>) {
  try { localStorage.setItem(readKey(uid), JSON.stringify([...keys].slice(-400))); } catch { /* noop */ }
}
function announce() {
  try { window.dispatchEvent(new Event('moca-notif-read')); } catch { /* noop */ }
}
export function markRead(uid: string, key: string) {
  const s = loadRead(uid); s.add(key); saveRead(uid, s); announce();
}
export function markAllRead(uid: string, keys: string[]) {
  const s = loadRead(uid); keys.forEach((k) => s.add(k)); saveRead(uid, s); announce();
}

export const KIND_STYLE: Record<NotifKind, { bg: string; fg: string; icon: string }> = {
  returned: { bg: '#f7e6e4', fg: '#b0433b', icon: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' },
  approved: { bg: '#e2f0e8', fg: '#2e7d55', icon: 'M20 6 9 17l-5-5' },
  review: { bg: '#fbf2df', fg: '#a9791f', icon: 'M22 12h-5l-2 3h-6l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z' },
  meeting: { bg: '#e6eef6', fg: '#3a6ea5', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  directive: { bg: '#fbf2df', fg: '#a9791f', icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' },
  update: { bg: '#e9f0f6', fg: '#3a6ea5', icon: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5' },
  leave: { bg: '#f0eaf6', fg: '#7a4fa3', icon: 'M8 3v4M16 3v4M3.5 10.5h17M3.5 8.5A3.5 3.5 0 0 1 7 5h10a3.5 3.5 0 0 1 3.5 3.5v9A3.5 3.5 0 0 1 17 21H7a3.5 3.5 0 0 1-3.5-3.5v-9Z' },
};
