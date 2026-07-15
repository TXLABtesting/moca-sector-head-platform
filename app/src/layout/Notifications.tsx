import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { buildNotifications, loadRead, markRead, markAllRead, KIND_STYLE, type Notif } from './notifData';

/** Header bell: compact dropdown of the latest alerts with read/unread state.
 *  Clicking an alert opens the exact related item; "view all" opens the
 *  Notifications Center page. */
export function NotificationsBell() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const users = useStore((s) => s.users);
  const { goto } = useNav();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  void tick;
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    window.addEventListener('moca-notif-read', f);
    return () => window.removeEventListener('moca-notif-read', f);
  }, []);

  const list = buildNotifications(cu, data, work, users, lang, tr);
  const read = loadRead(cu.id);
  const unseenCount = list.filter((n) => !read.has(n.key)).length;
  const top = list.slice(0, 8);

  const openNotif = (n: Notif) => {
    markRead(cu.id, n.key);
    setTick((t) => t + 1);
    setOpen(false);
    goto(n.page, n.params);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} title={rl('التنبيهات', 'Notifications')} style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, border: '1px solid #ebeee9', background: open ? '#f2f7f4' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3c4a42', boxShadow: '0 1px 2px rgba(20,45,32,.04)' }}>
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5a5 5 0 0 0-5 5c0 4-1.5 5.5-1.5 5.5h13S17 15.5 17 11.5a5 5 0 0 0-5-5Z" /><path d="M10 19.5a2 2 0 0 0 4 0M12 4v2.5" /></svg>
        {unseenCount > 0 && (
          <span style={{ position: 'absolute', top: 4, insetInlineEnd: 4, minWidth: 16, height: 16, borderRadius: 9, background: '#b0433b', color: '#fff', border: '2px solid #fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>{unseenCount > 9 ? '9+' : unseenCount}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 590 }} />
          <div style={{ position: 'absolute', top: 50, insetInlineEnd: 0, width: 390, maxWidth: '86vw', background: '#fff', border: '1px solid #edf0ea', borderRadius: 16, boxShadow: '0 16px 44px -12px rgba(23,40,32,.3),0 3px 10px rgba(23,40,32,.07)', padding: 8, zIndex: 600, animation: 'fadeUp .14s ease', maxHeight: '72vh', overflowY: 'auto' }}>
            <div style={{ padding: '8px 11px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#17211c' }}>{rl('التنبيهات', 'Notifications')}</span>
              <span style={{ fontSize: 10.5, color: '#9aa39b' }}>{unseenCount} {rl('غير مقروء', 'unread')}</span>
            </div>
            {top.length === 0 && (
              <div style={{ padding: '26px 12px', textAlign: 'center', color: '#9aa39b', fontSize: 12.5 }}>{rl('لا توجد تنبيهات حالياً', 'No notifications right now')}</div>
            )}
            {top.map((n) => {
              const st = KIND_STYLE[n.kind];
              const isRead = read.has(n.key);
              return (
                <button key={n.key} onClick={() => openNotif(n)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 11px', border: 'none', background: isRead ? 'transparent' : '#f6faf7', cursor: 'pointer', textAlign: 'start', borderRadius: 12, fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f4f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isRead ? 'transparent' : '#f6faf7'; }}>
                  <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: st.bg, color: st.fg }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={st.icon} /></svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: isRead ? 600 : 800, color: '#17211c', lineHeight: 1.45 }}>{n.title}</span>
                    {n.sub && <span style={{ fontSize: 11, color: '#5b6b62', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.sub}</span>}
                    <span style={{ fontSize: 10, color: '#9aa39b' }}>{n.meta} · {n.time}</span>
                  </span>
                  {!isRead && <span style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: '#1f8a5b', marginTop: 8 }} />}
                </button>
              );
            })}
            <div style={{ display: 'flex', gap: 8, padding: '8px 6px 4px', borderTop: '1px solid #f0f2ee', marginTop: 4 }}>
              <button onClick={() => { setOpen(false); goto('notifications'); }} style={{ flex: 1, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                {rl('عرض كل التنبيهات', 'View all notifications')}
              </button>
              <button onClick={() => { markAllRead(cu.id, list.map((n) => n.key)); setTick((t) => t + 1); }} style={{ flex: 'none', background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                {rl('تحديد الكل كمقروء', 'Mark all read')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
