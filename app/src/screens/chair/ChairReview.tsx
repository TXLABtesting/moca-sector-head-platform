import { useState } from 'react';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { Modal, Avatar } from '../../components/ui';
import { SECTIONS } from '../../domain/permissions';
import { mColl } from '../member/workflow';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Sections whose shared collections can carry member submissions (deduped by collection). */
const REVIEW_SECS = ['correspondence', 'followups', 'projects', 'minutes', 'committees', 'leaves', 'auditReports', 'reportLog', 'myTasks', 'reportCenter'];

interface Sub { id: string; title: string; ownerName: string; sectionName: string; note: string; isWork: boolean; sec: string }
interface ModalState { kind: 'return' | 'directive'; sub: Sub }

/** Chair-side review inbox: everything the office team sent for review,
 *  with approve / return-for-edit / directive / request-update. */
export function ChairReview() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const users = useStore((s) => s.users);
  const mutate = useStore((s) => s.mutate);
  const mutateWork = useStore((s) => s.mutateWork);
  const { showToast } = useToast();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [draft, setDraft] = useState('');

  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };
  const ownerName = (id: string) => users.find((u) => u.id === id)?.name || rl('فريق المكتب', 'Office team');

  const subs: Sub[] = [];
  REVIEW_SECS.forEach((sec) => {
    const coll = mColl(sec); if (!coll) return;
    coll.get(data).forEach((r: any) => {
      if (r._mrev) subs.push({ id: r.id, title: coll.title(r), ownerName: ownerName(r._mowner || ''), sectionName: secName(sec), note: r._mlog?.[0]?.note || '', isWork: false, sec });
    });
  });
  work.filter((w) => w.status === 'بانتظار مراجعة رئيس القطاع').forEach((w) => {
    subs.push({ id: w.id, title: w.title, ownerName: ownerName(w.owner), sectionName: secName(w.section), note: '', isWork: true, sec: w.section });
  });

  if (subs.length === 0) return null;

  const approve = (s: Sub) => {
    if (s.isWork) {
      mutateWork((w) => { const it = w.find((x) => x.id === s.id); if (it) { it.status = 'معتمد'; it.reason = undefined; } });
    } else {
      mutate((d) => {
        const coll = mColl(s.sec)!; const r = coll.get(d).find((x: any) => x.id === s.id);
        if (r) { r._mrev = false; r._mret = ''; r._mapproved = true; coll.setStatus(r, 'معتمد'); (r._mlog = r._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: 'معتمد', chair: true }); }
      });
    }
    showToast(rl('تم اعتماد البند — يظهر الآن معتمداً لدى العضو', 'Item approved — now shown as approved to the member'));
  };

  const requestUpdate = (s: Sub) => {
    if (!s.isWork) mutate((d) => { const coll = mColl(s.sec)!; const r = coll.get(d).find((x: any) => x.id === s.id); if (r) (r._mlog = r._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: rl('طلب تحديث', 'Update requested'), chair: true }); });
    showToast(rl('تم إرسال طلب تحديث إلى العضو', 'Update request sent to the member'));
  };

  const submitModal = () => {
    if (!modal) return;
    const s = modal.sub; const t = draft.trim();
    if (modal.kind === 'return') {
      const reason = t || rl('يرجى المراجعة والتعديل.', 'Please review and revise.');
      if (s.isWork) mutateWork((w) => { const it = w.find((x) => x.id === s.id); if (it) { it.status = 'أعيد للتعديل'; it.reason = reason; } });
      else mutate((d) => { const coll = mColl(s.sec)!; const r = coll.get(d).find((x: any) => x.id === s.id); if (r) { r._mret = reason; r._mrev = false; (r._mlog = r._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: 'أعيد للتعديل', note: reason, chair: true }); } });
      showToast(rl('تم إرجاع البند للتعديل — سيرى العضو السبب في لوحته', 'Returned for editing — the member will see the reason on their board'));
    } else {
      if (!s.isWork) mutate((d) => { const coll = mColl(s.sec)!; const r = coll.get(d).find((x: any) => x.id === s.id); if (r) { r._mdirective = t; (r._mlog = r._mlog || []).unshift({ at: rl('الآن', 'Just now'), to: rl('توجيه', 'Directive'), note: t, chair: true }); } });
      showToast(rl('تم إضافة التوجيه', 'Directive added'));
    }
    setDraft(''); setModal(null);
  };

  const btnBase: React.CSSProperties = { borderRadius: 8, padding: '6px 12px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };

  return (
    <>
      <div className="glass" style={{ borderRadius: 20, padding: '20px 22px', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 16px 40px -22px rgba(23,40,32,.16)', marginBottom: 20, border: '1.5px solid #c9a24b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
          <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf2df', color: '#a9791f' }}>
            <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-5l-2 3h-6l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#17211c' }}>{rl('بنود من فريق المكتب بانتظار مراجعتك', 'Team submissions awaiting your review')}</h2>
            <div style={{ fontSize: 11.5, color: '#8a6a1f', marginTop: 2 }}>{rl('أرسلها الأعضاء من لوحاتهم — قرارك يصلهم فوراً.', 'Sent by members from their boards — your decision reaches them instantly.')}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#a9791f', background: '#fbf2df', borderRadius: 20, padding: '4px 13px' }}>{subs.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          {subs.map((s) => (
            <div key={(s.isWork ? 'w' : 'r') + s.id} style={{ border: '1px solid #f0e6cf', borderRadius: 13, padding: '13px 15px', background: '#fdfbf6', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar name={s.ownerName} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45 }}>{tr(s.title)}</div>
                  <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 2 }}>{s.ownerName} · {s.sectionName}</div>
                </div>
                <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: '#fbf2df', color: '#a9791f' }}>{tr('بانتظار مراجعة رئيس القطاع')}</span>
              </div>
              {s.note && <div style={{ fontSize: 11.5, color: '#6a5a2b', background: '#fbf7ee', border: '1px solid #f0e6cf', borderRadius: 9, padding: '7px 11px', lineHeight: 1.6 }}><b>{rl('ملاحظة العضو', 'Member note')}:</b> {s.note}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => approve(s)} style={{ ...btnBase, background: '#1f4a37', color: '#fff', border: 'none' }}>{rl('اعتماد', 'Approve')}</button>
                <button onClick={() => { setDraft(''); setModal({ kind: 'directive', sub: s }); }} style={{ ...btnBase, background: '#fbf3df', color: '#8a6a1f', border: '1px solid #ecdcae' }}>{rl('إضافة توجيه', 'Add directive')}</button>
                <button onClick={() => requestUpdate(s)} style={{ ...btnBase, background: '#f2f4f0', color: '#3c4a42', border: '1px solid #e2e6df' }}>{rl('طلب تحديث', 'Request update')}</button>
                <button onClick={() => { setDraft(''); setModal({ kind: 'return', sub: s }); }} style={{ ...btnBase, background: '#fdf3f2', color: '#b0433b', border: '1px solid #f3d9d6' }}>{rl('إرجاع للتعديل', 'Return for edit')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} width={480}>
        {modal && (
          <>
            <h3 style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 700, color: '#17211c' }}>
              {modal.kind === 'return' ? rl('إرجاع البند للتعديل', 'Return for editing') : rl('إضافة توجيه', 'Add directive')}
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>{tr(modal.sub.title)} — {modal.sub.ownerName}</p>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus
              placeholder={modal.kind === 'return' ? rl('اكتبي سبب الإرجاع ليظهر للعضو…', 'Write the return reason for the member…') : rl('اكتبي التوجيه…', 'Write the directive…')}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 11, padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
              <button onClick={submitModal} style={{ background: modal.kind === 'return' ? '#b0433b' : '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                {modal.kind === 'return' ? rl('إرجاع للتعديل', 'Return') : rl('إرسال التوجيه', 'Send directive')}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
