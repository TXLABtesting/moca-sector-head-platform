import { useState } from 'react';
import { useStore } from '../store/store';
import { useI18n } from '../i18n/i18n';
import { useToast } from './Toast';
import { useCurrentUser } from '../store/useCurrentUser';

/**
 * Sector Head notes on a report. The chair adds/deletes dated notes; everyone
 * else who can view the report sees them read-only. Notes live in the shared
 * `data.reportNotes[noteKey]` so they sync across clients via the demo backend.
 */
export function ChairNotes({ noteKey }: { noteKey: string }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const cu = useCurrentUser();
  const isChair = cu.type === 'chair';
  const notes = data.reportNotes?.[noteKey] || [];
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    const date = new Date().toISOString().slice(0, 10);
    mutate((d) => {
      d.reportNotes ||= {};
      (d.reportNotes[noteKey] ||= []).push({ text: t, date, author: cu.name });
    });
    setText('');
    showToast(rl('تمت إضافة ملاحظة رئيس القطاع', 'Sector Head note added'));
  };
  const del = (i: number) => mutate((d) => { d.reportNotes?.[noteKey]?.splice(i, 1); });

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
        <span style={{ width: 4, height: 18, borderRadius: 3, background: '#1f4a37' }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#17211c' }}>{rl('ملاحظات رئيس القطاع', 'Sector Head notes')}</h3>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -18px rgba(23,40,32,.14)' }}>
        {notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: isChair ? 16 : 0 }}>
            {notes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: '#f5f8f5', borderRadius: 12, padding: '12px 14px', borderInlineStart: '3px solid #1f4a37' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#26302a', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 6 }}>{tr(n.author)} · {n.date}</div>
                </div>
                {isChair && <button onClick={() => del(i)} title={rl('حذف', 'Delete')} style={{ flex: 'none', width: 26, height: 26, border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 13 }}>✕</button>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: '#9aa39b', padding: '4px 2px', marginBottom: isChair ? 14 : 0 }}>{rl('لا توجد ملاحظات على هذا التقرير بعد.', 'No notes on this report yet.')}</div>
        )}
        {isChair && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={rl('اكتب ملاحظتك على هذا التقرير…', 'Write your note on this report…')} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={add} disabled={!text.trim()} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 7, background: text.trim() ? '#1f4a37' : '#c3cec4', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: text.trim() ? 'pointer' : 'default' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{rl('إضافة ملاحظة', 'Add note')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
