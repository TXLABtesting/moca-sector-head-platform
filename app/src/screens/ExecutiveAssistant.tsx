import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { useNav, type Page } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { useToast } from '../components/Toast';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Card { icon?: string; title: string; sub?: string; page?: Page; extra?: any }
interface Msg { user?: boolean; text?: string; cards?: Card[]; confirm?: { label: string; run: () => void }; done?: boolean }

export function ExecutiveAssistant() {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const { goto } = useNav();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const badge = data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد').length
    + data.projects.filter((p) => p.status === 'يحتاج قرار' || p.status === 'متأخر').length
    + data.correspondence.filter((c) => c.needsAction).length
    + data.otasks.filter((t) => t.status === 'متأخر').length;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, open]);

  useEffect(() => {
    if (open && msgs.length === 0) {
      const pend = data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد').length;
      const late = data.projects.filter((p) => p.status === 'متأخر').length;
      const corr = data.correspondence.filter((c) => c.needsAction).length;
      setMsgs([{ text: rl(`مرحباً ${cu.name.split(' ')[0]} 👋 لديك ${pend} اجتماع بانتظار الاعتماد، ${late} مشروع متأخر، و${corr} مستند يحتاج متابعة. كيف يمكنني المساعدة؟`, `Hi ${cu.name.split(' ')[0]} 👋 You have ${pend} meetings pending approval, ${late} delayed projects, and ${corr} documents needing follow-up. How can I help?`) }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const quick: { label: string; key: string }[] = [
    { label: rl('ملخص اليوم', 'Today summary'), key: 'summary' },
    { label: rl('يحتاج متابعتي', 'Needs my attention'), key: 'decisions' },
    { label: rl('اجتماعات بانتظار الاعتماد', 'Pending meetings'), key: 'pendmeet' },
    { label: rl('مهام بدون موعد نهائي', 'No-deadline tasks'), key: 'nodue' },
    { label: rl('مهام متأخرة', 'Overdue tasks'), key: 'late' },
    { label: rl('الصادر والوارد قيد المتابعة', 'Correspondence follow-up'), key: 'corr' },
    { label: rl('المخاطر المبكّرة', 'Early risks'), key: 'risks' },
  ];

  const answer = (label: string, key: string) => {
    const reply: Msg = { text: '' };
    if (key === 'summary') {
      const pend = data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد').length;
      const late = data.projects.filter((p) => p.status === 'متأخر').length;
      const corr = data.correspondence.filter((c) => c.needsAction).length;
      const leaves = data.leaves.filter((l) => l.status === 'بانتظار الاعتماد').length;
      reply.text = rl(`ملخص اليوم: ${pend} اجتماع بانتظار الاعتماد · ${late} مشروع متأخر · ${corr} مستند للمتابعة · ${leaves} طلب إجازة بانتظار الاعتماد.`, `Today: ${pend} meetings pending · ${late} delayed projects · ${corr} documents to follow up · ${leaves} leave requests pending.`);
    } else if (key === 'decisions') {
      const items = data.projects.filter((p) => p.status === 'متأخر' || p.status === 'يحتاج قرار');
      reply.text = rl(`لديك ${items.length} مشروع يحتاج متابعتك:`, `You have ${items.length} projects needing attention:`);
      reply.cards = items.slice(0, 4).map((p) => ({ title: p.name, sub: p.owner, page: 'projectDetail', extra: { selProject: p.id } }));
    } else if (key === 'pendmeet') {
      const ms = data.reqMeetings.filter((m) => m.status === 'بانتظار الاعتماد');
      reply.text = rl(`${ms.length} اجتماع بانتظار اعتمادك:`, `${ms.length} meetings await your approval:`);
      reply.cards = ms.slice(0, 4).map((m) => ({ title: m.subject, sub: m.proposed, page: 'reqmeetings' }));
      if (ms.length) reply.confirm = { label: rl(`اعتماد كل الاجتماعات (${ms.length})`, `Approve all meetings (${ms.length})`), run: () => { mutate((d) => { d.reqMeetings.forEach((m) => { if (m.status === 'بانتظار الاعتماد') { m.status = 'معتمد'; m.decision = 'تم الاعتماد'; } }); }); showToast(rl('تم اعتماد جميع الاجتماعات', 'All meetings approved')); } };
    } else if (key === 'nodue') {
      const ts = data.otasks.filter((t) => (!t.end || !t.end.trim()) && t.status !== 'مكتمل');
      reply.text = rl(`${ts.length} مهمة بدون موعد نهائي:`, `${ts.length} tasks without a deadline:`);
      reply.cards = ts.slice(0, 4).map((t) => ({ title: t.title, sub: t.owner, page: 'otasks' }));
    } else if (key === 'late') {
      const ts = data.otasks.filter((t) => t.status === 'متأخر');
      const lp = data.projects.filter((p) => p.status === 'متأخر');
      reply.text = rl(`${ts.length} مهمة متأخرة و${lp.length} مشروع متأخر.`, `${ts.length} overdue tasks and ${lp.length} delayed projects.`);
      reply.cards = [...ts.slice(0, 2).map((t) => ({ title: t.title, sub: t.owner, page: 'otasks' as Page })), ...lp.slice(0, 2).map((p) => ({ title: p.name, sub: p.owner, page: 'projectDetail' as Page, extra: { selProject: p.id } }))];
    } else if (key === 'corr') {
      const cs = data.correspondence.filter((c) => c.needsAction);
      reply.text = rl(`${cs.length} مستند يحتاج متابعة:`, `${cs.length} documents need follow-up:`);
      reply.cards = cs.slice(0, 4).map((c) => ({ title: c.name, sub: c.entity, page: 'docDetail', extra: { selDoc: c.id } }));
    } else if (key === 'risks') {
      const rk = data.projects.filter((p) => p.risks && p.risks.trim());
      reply.text = rl(`${rk.length} مشروع لديه مخاطر مسجّلة:`, `${rk.length} projects have logged risks:`);
      reply.cards = rk.slice(0, 4).map((p) => ({ title: p.name, sub: p.risks, page: 'projectDetail', extra: { selProject: p.id } }));
    } else {
      reply.text = rl('يمكنني مساعدتك بملخصات المشاريع والاجتماعات والمراسلات والمهام. اختر من الإجراءات السريعة.', 'I can summarize projects, meetings, correspondence and tasks. Pick a quick action.');
    }
    setMsgs((m) => [...m, { user: true, text: label }, reply]);
  };

  const submit = () => { const v = input.trim(); if (!v) return; setInput(''); answer(v, 'free'); };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="asst-fab" aria-label={rl('المساعد التنفيذي', 'Executive Assistant')} style={{ position: 'fixed', zIndex: 205, insetInlineEnd: 24, bottom: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'linear-gradient(135deg,#1e4634,#132b20)', color: '#fff', boxShadow: '0 0 0 4px rgba(247,250,246,.92), 0 16px 34px -10px rgba(19,43,32,.6), 0 5px 14px -4px rgba(19,43,32,.4)' }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" /><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>
          {badge > 0 && <span className="asst-fab-badge">{badge > 99 ? '99+' : badge}</span>}
        </button>
      )}
      {open && (
        <div className="asst-panel" style={{ position: 'fixed', zIndex: 210, insetInlineEnd: 26, bottom: 26, width: 412, maxWidth: 'calc(100vw - 36px)', height: 'min(670px,86vh)', display: 'flex', flexDirection: 'column', background: '#f6f8f4', borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(19,43,32,.5),0 8px 24px -12px rgba(19,43,32,.35)' }}>
          <div style={{ background: 'linear-gradient(135deg,#1e4634,#132b20)', color: '#fff', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8d5a2' }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" /></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{rl('المساعد التنفيذي', 'Executive Assistant')}</div>
              <div style={{ fontSize: 11, color: '#a9c0b1', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />{rl('متصل — جاهز للمساعدة', 'Online — ready to help')}</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>

          <div ref={scrollRef} className="asst-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 16px 8px' }}>
            {msgs.map((m, i) => (
              <div key={i} className="asst-row" style={{ display: 'flex', justifyContent: m.user ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <div style={{ maxWidth: '86%' }}>
                  {m.text && <div style={{ background: m.user ? '#1e4634' : '#fff', color: m.user ? '#fff' : '#2a332d', fontSize: 12.5, lineHeight: 1.6, padding: '11px 14px', borderRadius: 14, boxShadow: m.user ? 'none' : '0 1px 3px rgba(23,40,32,.08)' }}>{m.text}</div>}
                  {(m.cards || []).map((c, j) => (
                    <div key={j} onClick={() => { if (c.page) goto(c.page, c.extra); setOpen(false); }} style={{ marginTop: 8, background: '#fff', border: '1px solid #e6ece7', borderRadius: 12, padding: '10px 12px', cursor: c.page ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(23,40,32,.06)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c' }}>{c.title}</div>
                      {c.sub && <div style={{ fontSize: 11, color: '#8a938c', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>}
                    </div>
                  ))}
                  {m.confirm && !m.done && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button onClick={() => { m.confirm!.run(); setMsgs((all) => all.map((x, k) => k === i ? { ...x, done: true } : x)); }} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{m.confirm.label}</button>
                      <button onClick={() => setMsgs((all) => all.map((x, k) => k === i ? { ...x, done: true } : x))} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
                    </div>
                  )}
                  {m.done && <div style={{ marginTop: 6, fontSize: 11, color: '#1f8a5b', fontWeight: 600 }}>✓ {rl('تم', 'Done')}</div>}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 6 }}>
              {quick.map((q) => <button key={q.key} onClick={() => answer(q.label, q.key)} style={{ background: '#fff', border: '1px solid #d9e2da', color: '#2b5c44', borderRadius: 20, padding: '7px 13px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{q.label}</button>)}
            </div>
          </div>

          <div style={{ padding: 12, borderTop: '1px solid #e6ece7', display: 'flex', gap: 8, background: '#f6f8f4' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder={rl('اكتب سؤالك أو اطلب إجراءً…', 'Ask a question or request an action…')} style={{ flex: 1, border: '1px solid #d9e2da', background: '#fff', borderRadius: 12, padding: '11px 14px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#17211c' }} />
            <button onClick={submit} style={{ width: 44, flex: 'none', border: 'none', borderRadius: 12, background: '#1e4634', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg></button>
          </div>
        </div>
      )}
    </>
  );
}
