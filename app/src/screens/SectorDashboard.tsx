import { useState } from 'react';
import { Fade, Badge } from '../components/ui';
import { Icon } from '../components/Icon';
import { DemoHint } from '../components/DemoHint';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../components/Toast';
import { useCurrentUser } from '../store/useCurrentUser';
import { WFS, SCOPES } from '../domain/permissions';
import { PS, PUNIT } from '../shared/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Sector/department-manager home: scoped to their own department, with a
 *  direct channel to send updates/reports/notes to the Sector Head. */
export function SectorDashboard() {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const { goto } = useNav();
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const mutateWork = useStore((s) => s.mutateWork);
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const scope = SCOPES.find((s) => s.v === cu.scope);
  const deptName = scope ? scope.ar : cu.scope;
  const deptLabel = scope ? (lang === 'en' ? scope.en : scope.ar) : cu.scope;

  // department projects: match the org-unit map against the manager's scope name
  const deptKey = deptName.replace('إدارة ', '').split(' ')[0]; // e.g. "الشؤون"
  const myProjects = data.projects.filter((p) => {
    const unit = (PUNIT as Record<string, string>)[p.id] || p.unit || '';
    return deptKey.length >= 3 && unit.includes(deptKey);
  });
  const mySent = work.filter((w) => w.owner === cu.id);
  const myAudit = data.audit.filter((a) => a.status !== 'مغلق');

  const send = () => {
    const t = title.trim();
    if (!t) { showToast(rl('يرجى إدخال عنوان التحديث', 'Please enter a title')); return; }
    mutateWork((w) => {
      w.unshift({ id: 'sm' + Date.now(), owner: cu.id, section: 'followups', title: t + (note.trim() ? ' — ' + note.trim() : ''), status: 'بانتظار مراجعة رئيس القطاع', date: rl('اليوم', 'Today') });
    });
    setTitle(''); setNote('');
    showToast(rl('أُرسل التحديث إلى رئيس القطاع — يظهر في لوحتها الآن', 'Update sent to the Sector Head — visible on her board now'));
  };

  const wfPair = (st: string): [string, string] => WFS[st] || WFS['مسودة'];

  return (
    <Fade style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#17211c' }}>{rl('مرحباً، ', 'Welcome, ') + cu.name}</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#3a6ea5', background: '#e6eef6', border: '1px solid #d3e0ec', borderRadius: 20, padding: '4px 12px' }}>
          <Icon name="scale" size={13} />{rl('مدير إدارة — وصول محدود بنطاق: ', 'Dept. manager — access limited to: ') + deptLabel}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#7d867f' }}>{cu.job}</p>
      <DemoHint />

      <div className="rg3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13, marginBottom: 20 }}>
        <Kpi label={rl('مشاريع إدارتي', 'My dept. projects')} value={myProjects.length} accent="#3a6ea5" bg="#e6eef6" icon="folder" onClick={() => goto('projects')} />
        <Kpi label={rl('ملاحظات تدقيق مفتوحة على إدارتي', 'Open audit notes on my dept.')} value={myAudit.length} accent="#a9791f" bg="#fbf0d6" icon="chart" onClick={() => goto('reportcenter')} />
        <Kpi label={rl('بنودي المرسلة لرئيس القطاع', 'My items sent to the Sector Head')} value={mySent.length} accent="#7a4d94" bg="#f1e8f5" icon="send" />
      </div>

      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* dept projects (view-only) */}
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('مشاريع إدارتي', 'My department projects')}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 11.5, color: '#9aa39b' }}>{rl('عرض فقط — التعديل من صلاحية فريق المكتب', 'View only — editing belongs to the office team')}</p>
            {myProjects.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لا توجد مشاريع مسندة لإدارتك حالياً', 'No projects assigned to your department right now')}</div>}
            {myProjects.map((p) => {
              const [bg, fg] = ((PS as Record<string, readonly string[]>)[p.status] || ['#eceeeb', '#6d7973']) as string[];
              return (
                <div key={p.id} onClick={() => goto('projectDetail', { selProject: p.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid #f4f6f3', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c' }}>{tr(p.name)}</div>
                    <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 2 }}>{tr(p.owner)}{p.dueDate ? ' · ' + dl(p.dueDate) : ''}</div>
                  </div>
                  <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 64, height: 6, background: '#eef0ec', borderRadius: 20, overflow: 'hidden' }}><div style={{ height: '100%', width: (p.progress || 0) + '%', background: p.status === 'متأخر' ? '#b0433b' : '#3a6ea5', borderRadius: 20 }} /></div>
                    <Badge bg={bg} fg={fg}>{tr(p.status)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {/* my sent items + their status (the loop, seen from stakeholder #3) */}
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#17211c' }}>{rl('بنودي المرسلة وحالتها', 'My sent items & their status')}</h3>
            {mySent.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: '#9aa39b', background: '#f7f9f6', borderRadius: 12 }}>{rl('لم ترسل بنوداً بعد — استخدم النموذج المجاور', 'Nothing sent yet — use the form beside')}</div>}
            {mySent.map((w) => {
              const [bg, fg] = wfPair(w.status);
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderBottom: '1px solid #f4f6f3' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#17211c', lineHeight: 1.5 }}>{w.title}</div>
                    {w.reason && <div style={{ fontSize: 11.5, color: '#9a3f38', marginTop: 3 }}><b>{rl('سبب الإرجاع', 'Return reason')}:</b> {w.reason}</div>}
                    <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{w.date}</div>
                  </div>
                  <Badge bg={bg} fg={fg}>{tr(w.status)}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* send channel to the chief */}
        <div style={{ background: 'linear-gradient(160deg,#1e4634,#17372a)', borderRadius: 20, boxShadow: '0 14px 34px -16px rgba(20,45,32,.5)', padding: '20px 22px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#c9a24b" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{rl('إرسال تحديث / ملاحظة لرئيس القطاع', 'Send an update / note to the Sector Head')}</h3>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 11.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.7 }}>{rl('يظهر البند فوراً في صندوق مراجعة رئيس القطاع بحالة «بانتظار مراجعة رئيس القطاع».', 'The item instantly appears in the Sector Head’s review inbox as “Awaiting Sector Head review”.')}</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={rl('عنوان التحديث أو الملاحظة…', 'Update / note title…')}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.09)', color: '#fff', borderRadius: 11, padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 9 }} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder={rl('التفاصيل (اختياري)…', 'Details (optional)…')}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.09)', color: '#fff', borderRadius: 11, padding: '11px 13px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 12 }} />
          <button onClick={send} style={{ width: '100%', background: '#c9a24b', color: '#132b20', border: 'none', borderRadius: 11, padding: '12px 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إرسال إلى رئيس القطاع', 'Send to the Sector Head')}</button>
        </div>
      </div>
    </Fade>
  );
}

function Kpi({ label, value, accent, bg, icon, onClick }: { label: string; value: number; accent: string; bg: string; icon: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="glass" style={{ borderRadius: 16, padding: '16px 17px', boxShadow: '0 1px 2px rgba(23,40,32,.04),0 14px 34px -18px rgba(20,45,32,.2)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color: accent }}><Icon name={icon} size={19} /></span>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: accent }}>{value}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c', lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}
