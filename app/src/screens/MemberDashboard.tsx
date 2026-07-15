import { useState } from 'react';
import { Fade } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { useCurrentUser } from '../store/useCurrentUser';
import { WFS, SECTIONS } from '../domain/permissions';
import { MEMBER_DIRECTIVES, MEMBER_RECENT } from '../domain/workflow';
import { mColl, editableCollections } from './member/workflow';
import { MemberForm } from './member/MemberForm';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Item { id: string; sec: string; title: string; status: string; review: boolean; returned: boolean; reason: string }

export function MemberDashboard() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const mutate = useStore((s) => s.mutate);
  const mutateWork = useStore((s) => s.mutateWork);
  const { showToast } = useToast();
  const [form, setForm] = useState<{ section: string; editId: string | null } | null>(null);

  const wf = (st: string): [string, string] => WFS[st] || WFS['مسودة'];
  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };

  const secItems = (sec: string): Item[] => {
    const coll = mColl(sec);
    if (coll) {
      return coll.get(data).map((r: any) => ({
        id: r.id, sec, title: coll.title(r),
        status: r._mrev ? 'بانتظار مراجعة رئيس القطاع' : (r._mret ? 'أعيد للتعديل' : coll.status(r)),
        review: !!r._mrev, returned: !!r._mret, reason: r._mret || '',
      }));
    }
    return work.filter((x) => x.owner === cu.id && x.section === sec).map((x) => ({ id: x.id, sec, title: x.title, status: x.status, review: x.status === 'بانتظار مراجعة رئيس القطاع', returned: x.status === 'أعيد للتعديل', reason: x.reason || '' }));
  };

  const groups = editableCollections(cu).map((sec) => ({ sec, label: secName(sec), items: secItems(sec).slice(0, 6) }));
  const units: Item[] = editableCollections(cu).flatMap((sec) => secItems(sec));
  const pending = units.filter((x) => x.review || x.status === 'بانتظار مراجعة رئيس القطاع' || x.status === 'مرسل للمراجعة');
  const returned = units.filter((x) => x.returned || x.status === 'أعيد للتعديل');
  const directives = MEMBER_DIRECTIVES[cu.id] || [];
  const recent = MEMBER_RECENT[cu.id] || [];

  const findRecord = (id: string) => {
    for (const sec of editableCollections(cu)) {
      const coll = mColl(sec);
      if (coll) { const r = coll.get(data).find((x: any) => x.id === id); if (r) return { real: true, sec }; }
    }
    return { real: false, sec: '' };
  };

  const sendForReview = (id: string) => {
    const rec = findRecord(id);
    if (rec.real) { mutate((d) => { const coll = mColl(rec.sec)!; const r = coll.get(d).find((x: any) => x.id === id); if (r) { r._mrev = true; r._mret = ''; } }); }
    else { mutateWork((w) => { const it = w.find((x) => x.id === id); if (it) { it.status = 'بانتظار مراجعة رئيس القطاع'; it.reason = undefined; } }); }
    showToast(rl('تم إرسال البند لمراجعة رئيس القطاع', 'Sent for Sector Head review'));
  };

  return (
    <Fade style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('مرحباً، ', 'Welcome, ') + cu.name}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{cu.job}</p>
      </div>

      {returned.map((it) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fdf3f2', border: '1px solid #f3d9d6', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#b0433b" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" /><path d="M12 8v4m0 4h.01" /></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#17211c' }}>{tr(it.title)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: '#f7e6e4', color: '#b0433b' }}>{tr(it.status)}</span>
            </div>
            {it.reason && <div style={{ fontSize: 12.5, color: '#9a3f38', lineHeight: 1.6 }}><strong>{rl('سبب الإرجاع', 'Return reason')}:</strong> {it.reason}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 'none', alignSelf: 'center' }}>
            <button onClick={() => setForm({ section: it.sec, editId: it.id })} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '8px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{rl('تعديل', 'Edit')}</button>
            <button onClick={() => sendForReview(it.id)} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{rl('إعادة الإرسال', 'Resend')}</button>
          </div>
        </div>
      ))}

      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('أقسامي — إضافة وتحديث', 'My sections — add & update')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groups.map((g) => {
                const s = SECTIONS.find((x) => x.k === g.sec);
                return (
                  <div key={g.sec} style={{ border: '1px solid #eef1ec', borderRadius: 15, padding: '14px 15px', background: '#fbfcfa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                      <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: '#ebf2ec', color: '#2b5c44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={s ? s.icon : 'note'} size={17} /></span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: '#17211c' }}>{g.label}</span>
                      <button onClick={() => setForm({ section: g.sec, editId: null })} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة', 'Add')}</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {g.items.length === 0 && <div style={{ fontSize: 12, color: '#9aa39b', padding: '4px 2px' }}>{rl('لا توجد بنود بعد', 'No items yet')}</div>}
                      {g.items.map((it) => {
                        const [bg, fg] = wf(it.status);
                        return (
                          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #eef1ec', borderRadius: 11, padding: '9px 11px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(it.title)}</div></div>
                            <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', background: bg, color: fg }}>{tr(it.status)}</span>
                            <button onClick={() => setForm({ section: it.sec, editId: it.id })} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('تعديل', 'Edit')}</button>
                            {!it.review && it.status !== 'معتمد' && <button onClick={() => sendForReview(it.id)} style={{ flex: 'none', background: '#1e4634', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إرسال', 'Send')}</button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('بنود بانتظار مراجعة رئيس القطاع', 'Awaiting Sector Head review')}</h3>
            {pending.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد بنود بانتظار المراجعة', 'No items awaiting review')}</div>}
            {pending.map((it) => {
              const [bg, fg] = wf(it.status);
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid #f4f6f3' }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{tr(it.title)}</div><div style={{ fontSize: 11, color: '#9aa39b', marginTop: 2 }}>{secName(it.sec)}</div></div>
                  <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: bg, color: fg }}>{tr(it.status)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'linear-gradient(160deg,#1e4634,#17372a)', borderRadius: 20, boxShadow: '0 14px 34px -16px rgba(20,45,32,.5)', padding: '20px 22px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#c9a24b" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5 7.7 12 12 5l4.3 7L20 8.5 18.3 19H5.7z" /></svg><h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{rl('توجيهات رئيس القطاع', 'Sector Head directives')}</h3></div>
            {directives.length === 0 && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', padding: '6px 0' }}>{rl('لا توجد توجيهات حالياً', 'No directives right now')}</div>}
            {directives.map((d, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 13px', marginBottom: 9 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: '#fff' }}>{d.text}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginTop: 6 }}>{d.date}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('آخر النشاط', 'Recent activity')}</h3>
            {recent.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f4f6f3' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b', marginTop: 6, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, color: '#2a332d', lineHeight: 1.5 }}>{r.text}</div><div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{r.date}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {form && <MemberForm open onClose={() => setForm(null)} section={form.section} editId={form.editId} />}
    </Fade>
  );
}
