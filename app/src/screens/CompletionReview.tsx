import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Fade } from '../components/ui';
import { AttachmentDownload } from '../components/AttachmentDownload';
import { useStore } from '../store/store';
import { useNav, type Page, type NavParams } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { useCurrentUser } from '../store/useCurrentUser';
import { pendingCompletionItems, DONE, OWNER_OF } from './member/workflow';
import { SECTIONS } from '../domain/permissions';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Where "view details" lands, per underlying collection key. */
const TARGET: Record<string, (id: string) => { page: Page; params?: NavParams }> = {
  otasks: (id) => ({ page: 'otasks', params: { selOtask: id } }),
  mtasks: (id) => ({ page: 'mtasks', params: { selMtask: id } }),
  committees: (id) => ({ page: 'committees', params: { selCommittee: id } }),
  projects: (id) => ({ page: 'projectDetail', params: { selProject: id } }),
  auditReps: () => ({ page: 'auditDetail' }),
  regReports: () => ({ page: 'reglog' }),
  retReports: () => ({ page: 'reportDetail' }),
  finModels: () => ({ page: 'finDetail' }),
  correspondence: (id) => ({ page: 'docDetail', params: { selDoc: id } }),
  meetings: (id) => ({ page: 'meetingDetail', params: { selMeeting: id } }),
  leaves: (id) => ({ page: 'leaves', params: { selLeave: id } }),
};

export function CompletionReview() {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const data = useStore((s) => s.data);
  const users = useStore((s) => s.users);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const { goto } = useNav();
  const { showToast } = useToast();

  const [returnFor, setReturnFor] = useState<{ sec: string; id: string; collKey: string } | null>(null);
  const [reason, setReason] = useState('');

  // Chair-only screen.
  if (cu.type !== 'chair') {
    return <Fade><div style={{ padding: 44, textAlign: 'center', color: '#9aa39b', fontSize: 14 }}>{rl('هذا القسم مخصص لرئيس القطاع.', 'This section is for the Sector Head.')}</div></Fade>;
  }

  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };
  const userName = (id: string) => { const u = users.find((x) => x.id === id); return u ? tr(u.name) : ''; };

  const items = pendingCompletionItems(data);

  const rowsData = items.map(({ sec, coll, r }) => {
    const ownerStr = OWNER_OF[String(coll.key)]?.(r) || '';
    const requester = (ownerStr && ownerStr.trim()) ? tr(ownerStr) : userName(r._mowner || '');
    const reqAt = r._mcompAt || r._mlog?.[0]?.at || r.lastUpdate || r.lastDate || '—';
    const lastUpd = r.lastUpdate || r.lastDate || r._mlog?.[0]?.at || '—';
    const progress = typeof r.progress === 'number' ? r.progress : undefined;
    const atts: string[] = Array.from(new Set([r.attachment, ...(r.attachments || [])].filter((a: any): a is string => !!a && !!String(a).trim())));
    const notes = (r.notes || r.desc || r.summary || '').toString().trim();
    return {
      sec, collKey: String(coll.key), id: r.id, r,
      typeLabel: secName(sec), title: tr(coll.title(r)),
      requester: requester || rl('غير محدد', 'Unassigned'),
      reqAt: dl(reqAt), lastUpd: dl(lastUpd), progress, atts, notes,
    };
  });

  const openDetail = (collKey: string, id: string) => { const tg = TARGET[collKey]?.(id) || { page: 'dashboard' as Page }; goto(tg.page, tg.params); };

  const approve = (sec: string, id: string) => {
    mutate((d) => {
      const coll = pendingCompletionItems(d).find((x) => x.sec === sec && x.r.id === id)?.coll;
      const rec = coll?.get(d).find((x: any) => x.id === id);
      if (coll && rec) {
        coll.setStatus(rec, DONE);
        if (typeof rec.progress === 'number') rec.progress = 100;
        rec._mret = ''; rec._mrev = false; rec._mapproved = true;
        rec._mlog = rec._mlog || [];
        rec._mlog.unshift({ at: lang === 'en' ? 'Just now' : 'الآن', to: DONE, note: rl('اعتمد رئيس القطاع الاكتمال', 'Completion approved by the Sector Head'), chair: true, by: cu.name });
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

  const card: CSSProperties = { background: '#fff', border: '1px solid #eef1ec', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.12)', padding: '16px 18px' };
  const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: '3px 9px', background: '#eef4f0', color: '#1f4a37' };
  const metaLbl: CSSProperties = { fontSize: 10, color: '#9aa39b', fontWeight: 600, marginBottom: 2 };
  const metaVal: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#2a332d' };

  return (
    <Fade>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('قيد مراجعة الاكتمال', 'Completion review')}</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('كل العناصر التي حدّدها المسؤولون كمنجزة وتنتظر اعتماد رئيس القطاع لتصبح «مكتمل».', 'All items marked done by owners, awaiting the Sector Head’s approval to become “Completed”.')}</p>
      </div>

      {rowsData.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9aa39b', fontSize: 13.5, padding: '44px 18px' }}>{rl('لا توجد عناصر بانتظار اعتماد الاكتمال حالياً.', 'No items awaiting completion approval.')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rowsData.map((row) => (
            <div key={row.collKey + ':' + row.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={chip}>{row.typeLabel}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: '#fbf0d6', color: '#a9791f' }}>{rl('مكتمل قيد الاعتماد', 'Completion pending')}</span>
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
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f7f8f6', border: '1px solid #eef1ec', borderRadius: 8, padding: '4px 9px', fontSize: 10.5, color: '#3c4a42' }}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#b0433b" strokeWidth={1.7} style={{ flex: 'none' }}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                          <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr(a)}</span>
                          <AttachmentDownload name={a} size={20} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none', minWidth: 150 }}>
                  <button onClick={() => openDetail(row.collKey, row.id)} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('عرض التفاصيل', 'View details')}</button>
                  <button onClick={() => approve(row.sec, row.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{rl('اعتماد الاكتمال', 'Approve completion')}
                  </button>
                  <button onClick={() => { setReturnFor({ sec: row.sec, id: row.id, collKey: row.collKey }); setReason(''); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f7e6e4', border: '1px solid #f0d3cf', color: '#b0433b', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>{rl('إرجاع للتعديل', 'Return for edits')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
