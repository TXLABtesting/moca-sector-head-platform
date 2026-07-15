import { useState } from 'react';
import { Fade } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { WFS, SECTIONS } from '../domain/permissions';
import { mColl, editableCollections } from './member/workflow';
import { MemberForm } from './member/MemberForm';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function TeamWorkspace() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const [form, setForm] = useState<{ section: string; editId: string | null } | null>(null);

  const wf = (st: string): [string, string] => WFS[st] || WFS['مسودة'];
  const secName = (k: string) => { const s = SECTIONS.find((x) => x.k === k); return s ? (lang === 'en' ? s.en : s.ar) : k; };

  const groups = editableCollections(cu).map((sec) => {
    const coll = mColl(sec);
    const items = coll ? coll.get(data).map((r: any) => ({ id: r.id, title: coll.title(r), status: r._mrev ? 'بانتظار مراجعة رئيس القطاع' : (r._mret ? 'أعيد للتعديل' : coll.status(r)), log: r._mlog || [] })) : [];
    return { sec, label: secName(sec), items };
  });

  // aggregate change log across the member's editable records
  const changeLog: { title: string; entry: any }[] = [];
  editableCollections(cu).forEach((sec) => {
    const coll = mColl(sec); if (!coll) return;
    coll.get(data).forEach((r: any) => { (r._mlog || []).forEach((e: any) => changeLog.push({ title: coll.title(r), entry: e })); });
  });

  return (
    <Fade style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('لوحة فريق المكتب', 'Office Team Workspace')}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{rl('أضف وحدّث البنود التي يراها رئيس القطاع — كلٌّ حسب صلاحياته.', 'Add and update the items the Sector Head sees — each within their own permissions.')}</p>
      </div>

      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map((g) => {
            const s = SECTIONS.find((x) => x.k === g.sec);
            return (
              <div key={g.sec} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: '#ebf2ec', color: '#2b5c44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={s ? s.icon : 'note'} size={17} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: '#17211c' }}>{g.label}</span>
                  <button onClick={() => setForm({ section: g.sec, editId: null })} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة', 'Add')}</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {g.items.slice(0, 8).map((it) => {
                    const [bg, fg] = wf(it.status);
                    return (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fbfcfa', border: '1px solid #eef1ec', borderRadius: 11, padding: '9px 11px' }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: '#17211c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr(it.title)}</div>
                        <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '3px 9px', background: bg, color: fg }}>{tr(it.status)}</span>
                        <button onClick={() => setForm({ section: g.sec, editId: it.id })} style={{ flex: 'none', background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('تعديل', 'Edit')}</button>
                      </div>
                    );
                  })}
                  {g.items.length > 8 && <div style={{ fontSize: 11, color: '#9aa39b', padding: '4px 2px' }}>+{g.items.length - 8} {rl('بند', 'items')}</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('سجل التعديلات', 'Change log')}</h3>
          {changeLog.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد تعديلات بعد', 'No changes yet')}</div>}
          {changeLog.slice(0, 30).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f4f6f3' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.entry.sent ? '#c9a24b' : '#1f8a5b', marginTop: 6, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#2a332d', lineHeight: 1.5 }}>{tr(c.title)} — <b>{c.entry.to}</b>{c.entry.sent ? ' · ' + rl('أُرسل للمراجعة', 'sent for review') : ''}</div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{(c.entry.by || '') + ' · ' + (c.entry.at || '')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {form && <MemberForm open onClose={() => setForm(null)} section={form.section} editId={form.editId} />}
    </Fade>
  );
}
