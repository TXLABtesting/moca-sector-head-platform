import { useState, type CSSProperties } from 'react';
import { Fade, Badge } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useI18n } from '../i18n/i18n';
import { useNav } from '../store/nav';
import { useStore } from '../store/store';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { useToast } from '../components/Toast';
import { PS, AS } from '../shared/constants';
import { initials } from '../shared/helpers';
import { MinuteTasks } from './meetings/MinuteTasks';
import { MinutesForm } from './meetings/MinutesForm';

const DETAIL_CARD: CSSProperties = {
  background: '#ffffff', border: 'none', borderRadius: 24,
  boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)',
};

export function Meetings() {
  const { page } = useNav();
  if (page === 'mtasks') return <MinuteTasks />;
  if (page === 'meetingDetail') return <MeetingDetail />;
  return <MinutesList />;
}

// ------------------------------------------------------------------ minutes list
function MinutesList() {
  const { t, tr, dl, lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { goto } = useNav();
  const data = useStore((s) => s.data);
  const cu = useCurrentUser();
  const canEditMin = cu.type !== 'chair' && can(cu, 'minutes', 'edit');
  const canAddMin = cu.type !== 'chair' && (can(cu, 'minutes', 'add') || can(cu, 'minutes', 'edit'));
  const [mForm, setMForm] = useState<{ id: string | null } | null>(null);
  const meetings = data.meetings;
  const mtasks = data.mtasks;

  const lateMt = mtasks.filter((a) => a.status === 'متأخر').length;
  const doneMt = mtasks.filter((a) => a.status === 'مكتمل').length;

  const kpis = [
    { value: meetings.length, label: t('minutesCount'), color: '#17211c', open: () => goto('mtasks', {}) },
    { value: mtasks.length, label: rl('مهام الاجتماعات', 'Meeting tasks'), color: '#2f6aa8', open: () => goto('mtasks', {}) },
    { value: lateMt, label: t('overdueActions'), color: '#b0433b', open: () => goto('mtasks', { mtStatus: 'متأخر' }) },
    { value: doneMt, label: t('decisionsDone'), color: '#2e7d55', open: () => goto('mtasks', { mtStatus: 'مكتمل' }) },
  ];
  const tile: CSSProperties = {
    background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.65)', borderRadius: 22,
    boxShadow: '0 10px 36px -12px rgba(30,60,40,.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    padding: '16px 17px', cursor: 'pointer', transition: 'transform .12s,box-shadow .12s',
  };

  return (
    <Fade>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('محاضر الاجتماعات', 'Meeting minutes')}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('سجل المحاضر وقراراتها ومهامها', 'Minutes, their decisions and tasks')}</p>
        </div>
        {canAddMin && (
          <div className="page-head-action" style={{ flex: 'none' }}>
            <button onClick={() => setMForm({ id: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {rl('إضافة محضر اجتماع جديد', 'Add new meeting minutes')}
            </button>
          </div>
        )}
      </div>
      <div className="rg5" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} onClick={k.open} style={tile}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 14, color: '#7d867f', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {meetings.map((mt) => {
          const parts = mt.date.split(' ');
          const meta = mt as typeof mt & { _mret?: string };
          const stName = meta._mret ? 'أعيد للتعديل' : mt.status;
          const [bg, fg] = PS[stName as keyof typeof PS]
            || (stName === 'بانتظار مراجعة رئيس القطاع' ? ['#fbf0d6', '#a9791f']
            : stName === 'مسودة' ? ['#eceeeb', '#6d7973']
            : stName === 'أعيد للتعديل' ? ['#f7e6e4', '#b0433b'] : ['#eee', '#555']);
          const late = mt.actions.filter((a) => a.status === 'متأخر').length;
          return (
            <div key={mt.id} onClick={() => goto('meetingDetail', { selMeeting: mt.id })} style={{
              background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.65)', borderRadius: 22,
              boxShadow: '0 10px 36px -12px rgba(30,60,40,.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              padding: '18px 20px', cursor: 'pointer', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center',
            }}>
              <div style={{ width: 56, height: 56, flex: 'none', borderRadius: 12, background: '#e9f0ec', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1e4634' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{parts[0]}</div>
                <div style={{ fontSize: 10 }}>{dl(parts[1])}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#17211c', marginBottom: 8 }}>{tr(mt.title)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6b62', marginBottom: 8, minWidth: 0 }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><circle cx="9" cy="7" r="3.2" /><path d="M17 11h4M19 9v4" /></svg>
                  <span style={{ color: '#9aa39b', flex: 'none' }}>{t('ownerShort')}:</span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(mt.owner)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '4px 9px', background: '#f0f3ee', color: '#3c4a42' }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></svg>
                    {mt.attendees.length} {t('attendeesWord')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '4px 9px', background: '#e9f0ec', color: '#1f4a37' }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    {mt.actions.length} {t('actionWord')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {late > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '4px 10px', background: '#f7e6e4', color: '#b0433b' }}>{late} {t('overdueWord')}</span>
                )}
                <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '4px 10px', background: bg, color: fg }}>{tr(stName)}</span>
                <button onClick={(e) => { e.stopPropagation(); goto('meetingDetail', { selMeeting: mt.id }); }} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('فتح', 'Open')}</button>
                {canEditMin && (
                  <button onClick={(e) => { e.stopPropagation(); setMForm({ id: mt.id }); }} style={{ background: '#f4f6f2', color: '#2b5c44', border: '1px solid #dfe6dd', borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('تعديل', 'Edit')}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {mForm && <MinutesForm meetingId={mForm.id} onClose={() => setMForm(null)} />}
    </Fade>
  );
}

// ------------------------------------------------------------------ meeting detail
function MeetingDetail() {
  const { t, tr, dl, lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { params } = useNav();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const canStatus = can(cu, 'minutes', 'status');
  const isChair = cu.type === 'chair';
  const canEditMin = !isChair && can(cu, 'minutes', 'edit');
  const [editOpen, setEditOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const { showToast } = useToast();

  const mt = data.meetings.find((m) => m.id === params.selMeeting);
  if (!mt) {
    return <Fade><div style={{ padding: 40, textAlign: 'center', color: '#8a938c', fontSize: 14 }}>—</div></Fade>;
  }

  // chair-notes ↔ owner-replies thread carried on the shared record's log
  const meta = mt as typeof mt & { _mret?: string; _mlog?: { at: string; to?: string; note?: string; by?: string; chair?: boolean }[] };
  const thread = (meta._mlog || []).filter((e) => (e.note || '').trim());
  const sendNote = () => {
    const txt = noteDraft.trim();
    if (!txt) return;
    mutate((d) => {
      const m = d.meetings.find((x) => x.id === mt.id) as (typeof mt & { chairNotes?: string; _mlog?: unknown[] }) | undefined;
      if (!m) return;
      (m._mlog = m._mlog || []).unshift({
        at: 'الآن',
        to: isChair ? 'ملاحظة من رئيس القطاع على المحضر' : 'رد المسؤول عن المحضر',
        note: txt, chair: isChair, by: cu.name,
      });
      if (isChair) m.chairNotes = txt;
    });
    setNoteDraft('');
    showToast(isChair ? rl('أُضيفت الملاحظة — ستظهر للمسؤول عن المحضر فوراً', 'Note added — visible to the minutes owner') : rl('أُرسل الرد إلى رئيس القطاع', 'Reply sent to the Sector Head'));
  };

  const setActionStatus = (aid: string, val: string) => mutate((d) => {
    const m = d.meetings.find((x) => x.id === mt.id);
    const a = m?.actions.find((x) => x.id === aid);
    if (a) a.status = val;
  });

  const absentees = mt.absentees || [];

  return (
    <Fade>
      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...DETAIL_CARD, padding: '22px 24px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>{tr(mt.title)}</h2>
            <div style={{ fontSize: 12.5, color: '#8a938c', marginBottom: 16, lineHeight: 1.8 }}>
              {dl(mt.date)}{mt.time ? ' · ' + mt.time : ''} · {t('ownerShort')} {tr(mt.owner)}
              {mt.entity ? <span> · {rl('الجهة', 'Entity')}: {tr(mt.entity)}</span> : null}
              {mt.location ? <span> · {rl('المكان', 'Location')}: {/^https?:/.test(mt.location) ? <a href={mt.location} target="_blank" rel="noreferrer" style={{ color: '#2f6aa8' }}>{mt.location}</a> : tr(mt.location)}</span> : null}
            </div>
            {!!((mt as typeof mt & { _mret?: string })._mret) && (
              <div style={{ background: '#fdf3f2', border: '1.5px solid #e7b8b3', borderRadius: 11, padding: '11px 13px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#b0433b', fontWeight: 800, marginBottom: 3 }}>{rl('أُعيد للتعديل من رئيس القطاع — سبب الإرجاع', 'Returned by the Sector Head — reason')}</div>
                <div style={{ fontSize: 12.5, color: '#9a3a2b', lineHeight: 1.7 }}>{(mt as typeof mt & { _mret?: string })._mret}</div>
              </div>
            )}
            {canEditMin && (
              <button onClick={() => setEditOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 16 }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                {rl('تعديل المحضر', 'Edit minutes')}
              </button>
            )}
            {editOpen && <MinutesForm meetingId={mt.id} onClose={() => setEditOpen(false)} />}
            <div style={{ fontSize: 11, color: '#9aa39b', marginBottom: 6 }}>{t('meetingSummary')}</div>
            <p style={{ margin: 0, fontSize: 13.5, color: '#3c4a42', lineHeight: 1.7 }}>{tr(mt.summary)}</p>
          </div>

          <div style={{ ...DETAIL_CARD, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>{t('keyPoints')}</h3>
            {mt.keyPoints.map((kp, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', fontSize: 13.5, color: '#2a332d', lineHeight: 1.6 }}>
                <span style={{ color: '#c9a24b', fontWeight: 700 }}>•</span>{tr(kp)}
              </div>
            ))}
          </div>

          <div style={{ ...DETAIL_CARD, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>{t('decisions')}</h3>
            {mt.decisions.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', fontSize: 13.5, color: '#284c3a', lineHeight: 1.6 }}>
                <svg width={16} height={16} style={{ flex: 'none', marginTop: 2 }} viewBox="0 0 24 24" fill="none" stroke="#2b5c44" strokeWidth={2}><path d="M20 6 9 17l-5-5" /></svg>{tr(d)}
              </div>
            ))}
          </div>

          <div style={{ ...DETAIL_CARD, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>{t('actionsFromMinutes')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mt.actions.map((a) => {
                const [bg, fg] = AS[a.status as keyof typeof AS] || ['#eee', '#555'];
                return (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', background: '#f7f8f6', borderRadius: 11, padding: '12px 14px' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#2a332d', fontWeight: 500 }}>{tr(a.text)}</div>
                      <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 3 }}>
                        {tr(a.owner)}{(a.participants && a.participants.length) ? rl(' + مشاركون: ', ' + participants: ') + a.participants.map((n) => tr(n)).join('، ') : ''} · {t('dueWord')} {dl(a.due)}
                        {typeof a.prog === 'number' ? <span style={{ fontWeight: 800, color: '#1f4a37' }}> · {a.prog}%</span> : null}
                        {a.lastUpdate ? <span> · {rl('آخر تحديث', 'Last update')}: {a.lastUpdate}</span> : null}
                      </div>
                    </div>
                    {canStatus
                      ? <Dropdown value={a.status} options={['مفتوح', 'قيد التنفيذ', 'مكتمل', 'متأخر'].map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setActionStatus(a.id, v)} opt={{ size: 'sm', bg, color: fg, weight: 700, borderColor: 'transparent' }} />
                      : <Badge bg={bg} fg={fg}>{tr(a.status)}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...DETAIL_CARD, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>{t('attendees')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {mt.attendees.map((at, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#e9f0ec', color: '#2b5c44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{initials(tr(at.name))}</span>
                  <span style={{ fontSize: 12.5, color: '#2a332d' }}>{tr(at.name)}</span>
                </div>
              ))}
            </div>
            {absentees.length > 0 && (
              <>
                <div style={{ height: 1, background: '#eef0ec', margin: '14px 0' }} />
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#b0433b' }}>{t('absentees')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {absentees.map((ab, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#f7e6e4', color: '#b0433b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{initials(tr(ab.name))}</span>
                      <span style={{ fontSize: 12.5, color: '#2a332d' }}>{tr(ab.name)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ ...DETAIL_CARD, padding: 20, border: '1.5px solid #e9dcb8' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#8a6a1f' }}>{rl('ملاحظات رئيس القطاع والردود', 'Sector Head notes & replies')}</h3>
            {!!(mt.chairNotes && mt.chairNotes.trim()) && thread.length === 0 && (
              <div style={{ background: '#fbf7ee', border: '1px solid #efe3c9', borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6b5b1e', lineHeight: 1.7 }}>{mt.chairNotes}</div>
                <div style={{ fontSize: 9.5, color: '#a9791f', marginTop: 3 }}>{rl('رئيس القطاع', 'Sector Head')}</div>
              </div>
            )}
            {thread.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
                {thread.map((e, i) => (
                  <div key={i} style={{ background: e.chair ? '#fbf7ee' : '#f4f8f5', border: '1px solid ' + (e.chair ? '#efe3c9' : '#dfeae2'), borderRadius: 10, padding: '9px 11px' }}>
                    <div style={{ fontSize: 12, color: e.chair ? '#6b5b1e' : '#2b4a3a', lineHeight: 1.7 }}>{e.note}</div>
                    <div style={{ fontSize: 9.5, color: '#9aa39b', marginTop: 3 }}>{tr(e.at)} · {e.chair ? rl('رئيس القطاع', 'Sector Head') : tr(e.by || '')}</div>
                  </div>
                ))}
              </div>
            )}
            {thread.length === 0 && !(mt.chairNotes && mt.chairNotes.trim()) && (
              <div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 10 }}>{rl('لا توجد ملاحظات بعد', 'No notes yet')}</div>
            )}
            {(isChair || canEditMin) && (
              <>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder={isChair ? rl('اكتبي ملاحظتك على المحضر…', 'Write your note…') : rl('اكتب ردّك على ملاحظات رئيس القطاع…', 'Write your reply…')}
                  rows={2} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 11px', fontSize: 12, fontFamily: 'inherit', color: '#17211c', outline: 'none', resize: 'vertical' }} />
                <button onClick={sendNote} style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                  {isChair ? rl('إضافة ملاحظة', 'Add note') : rl('إرسال الرد', 'Send reply')}
                </button>
              </>
            )}
          </div>
          {!!(mt.attachments && mt.attachments.length > 1) && (
            <div style={{ ...DETAIL_CARD, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>{rl('مرفقات إضافية', 'More attachments')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {mt.attachments.slice(1).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12, color: '#2a332d' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7d867f" strokeWidth={1.8}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>{a}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mt.attachment && (
            <div style={{ ...DETAIL_CARD, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>{t('minutesAttachment')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7f8f6', borderRadius: 11, padding: '13px 14px' }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#b0433b" strokeWidth={1.6}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2a332d' }}>{tr(mt.attachment)}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa39b' }}>PDF</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Fade>
  );
}
