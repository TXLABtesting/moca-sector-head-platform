import { type CSSProperties } from 'react';
import { Fade, Badge } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useI18n } from '../i18n/i18n';
import { useNav } from '../store/nav';
import { useStore } from '../store/store';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';
import { PS, AS } from '../shared/constants';
import { initials } from '../shared/helpers';
import { MinuteTasks } from './meetings/MinuteTasks';

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
          const [bg, fg] = PS[mt.status as keyof typeof PS] || ['#eee', '#555'];
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
                <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: '4px 10px', background: bg, color: fg }}>{tr(mt.status)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Fade>
  );
}

// ------------------------------------------------------------------ meeting detail
function MeetingDetail() {
  const { t, tr, dl } = useI18n();
  const { params } = useNav();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const cu = useCurrentUser();
  const canStatus = can(cu, 'minutes', 'status');

  const mt = data.meetings.find((m) => m.id === params.selMeeting);
  if (!mt) {
    return <Fade><div style={{ padding: 40, textAlign: 'center', color: '#8a938c', fontSize: 14 }}>—</div></Fade>;
  }

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
            <div style={{ fontSize: 12.5, color: '#8a938c', marginBottom: 16 }}>{dl(mt.date)} · {t('ownerShort')} {tr(mt.owner)}</div>
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
                      <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 3 }}>{tr(a.owner)} · {t('dueWord')} {dl(a.due)}</div>
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
