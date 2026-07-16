import { useState } from 'react';
import { Fade } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { AS, PR } from '../shared/constants';
import { SectionAddButton } from '../components/SectionAddButton';

interface Act {
  id: string; title: string; source: string; sourceType: string; owner: string;
  priority: string; due: string; status: string;
  kind: 'action' | 'audit' | 'mtask' | 'otask';
}

const SRC_COLOR: Record<string, [string, string]> = {
  'مشروع': ['#e6eef6', '#3a6ea5'], 'اجتماع': ['#f3ecf6', '#7a4d94'], 'صادر أو وارد': ['#e2f0e8', '#2e7d55'],
  'تدقيق': ['#fbf0d6', '#a9791f'], 'مهمة محضر': ['#f3ecf6', '#7a4d94'], 'مهمة مكتب': ['#e6eef6', '#2f6aa8'],
};

export function Actions() {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { goto } = useNav();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const [aPr, setAPr] = useState('');
  const [aStatus, setAStatus] = useState('');
  const [aSrc, setASrc] = useState('');

  const oNoDue = (tk: { end?: string }) => !tk.end || !String(tk.end).trim();
  const oNeedsAttn = (tk: { status: string; end?: string }) => tk.status !== 'مكتمل' && (tk.status === 'متأخر' || tk.status === 'يحتاج توجيه' || tk.status === 'بانتظار اعتماد' || oNoDue(tk));
  const needsSupport = (tk: { support?: string }) => !!tk.support && tk.support !== 'لا يوجد';

  const all: Act[] = [
    ...data.actions.map((a) => ({ id: a.id, title: a.title, source: a.source, sourceType: a.sourceType, owner: a.owner, priority: a.priority, due: a.due, status: a.status, kind: 'action' as const })),
    ...data.audit.filter((a) => a.status !== 'مغلق').map((a) => ({ id: a.id, title: 'متابعة ملاحظة التدقيق: ' + a.area, source: 'تدقيق: إدارة الشؤون الإدارية 2025 — ملاحظة ' + a.num, sourceType: 'تدقيق', owner: a.owner, priority: a.imp, due: a.due, status: a.status, kind: 'audit' as const })),
    ...data.mtasks.filter((tk) => tk.status !== 'مكتمل' && tk.status !== 'ملغي').map((tk) => ({ id: tk.id, title: tk.task.length > 70 ? tk.task.slice(0, 70) + '…' : tk.task, source: 'مهمة محضر: ' + tk.meeting, sourceType: 'مهمة محضر', owner: tk.owner, priority: needsSupport(tk) ? 'عالية' : 'متوسطة', due: tk.due, status: tk.status, kind: 'mtask' as const })),
    ...data.otasks.filter(oNeedsAttn).map((tk) => ({ id: tk.id, title: tk.title, source: 'مهمة مكتب: ' + tk.dept, sourceType: 'مهمة مكتب', owner: tk.owner, priority: (tk.status === 'متأخر' || tk.status === 'يحتاج توجيه') ? 'عالية' : 'متوسطة', due: tk.end || '—', status: tk.status, kind: 'otask' as const })),
  ];

  const filtered = all.filter((a) => {
    if (aPr && a.priority !== aPr) return false;
    if (aStatus && a.status !== aStatus) return false;
    if (aSrc && a.sourceType !== aSrc) return false;
    return true;
  });

  const setStatus = (a: Act, v: string) => {
    mutate((d) => {
      const coll = a.kind === 'audit' ? d.audit : a.kind === 'mtask' ? d.mtasks : a.kind === 'otask' ? d.otasks : d.actions;
      const o = (coll as { id: string; status: string }[]).find((x) => x.id === a.id);
      if (o) o.status = v;
    });
  };

  const prOpts = ['', 'عالية', 'متوسطة', 'منخفضة'].map((v) => ({ v, label: v ? tr(v) : rl('كل الأولويات', 'All priorities') }));
  const stOpts = ['', 'مفتوح', 'قيد التنفيذ', 'مكتمل', 'متأخر'].map((v) => ({ v, label: v ? tr(v) : rl('كل الحالات', 'All statuses') }));
  const srcOpts = ['', 'مشروع', 'اجتماع', 'صادر أو وارد', 'تدقيق', 'مهمة محضر', 'مهمة مكتب'].map((v) => ({ v, label: v ? tr(v) : rl('كل المصادر', 'All sources') }));

  const gridCols = '3fr 1.2fr 1.4fr 1fr 1.1fr 1.3fr';

  return (
    <Fade>
      <SectionAddButton section="followups" title={rl('الإجراءات والمتابعات', 'Actions & follow-ups')} desc={rl('كل الإجراءات المفتوحة عبر أقسام المنصة', 'All open actions across the platform')} />
      <div style={{ background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.65)', borderRadius: 22, boxShadow: '0 10px 36px -12px rgba(30,60,40,.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: '#7d867f', fontWeight: 500 }}>{rl('تصفية:', 'Filter:')}</span>
        <Dropdown value={aPr} options={prOpts} onChange={setAPr} opt={{ size: 'sm' }} />
        <Dropdown value={aStatus} options={stOpts} onChange={setAStatus} opt={{ size: 'sm' }} />
        <Dropdown value={aSrc} options={srcOpts} onChange={setASrc} opt={{ size: 'sm' }} />
      </div>
      <div style={{ background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.65)', borderRadius: 22, boxShadow: '0 10px 36px -12px rgba(30,60,40,.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', overflow: 'hidden' }}>
        <div className="trow" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, padding: '13px 20px', background: 'rgba(255,255,255,.35)', borderBottom: '1px solid rgba(255,255,255,.5)', fontSize: 11.5, fontWeight: 600, color: '#7d867f' }}>
          <div>{rl('الإجراء', 'Action')}</div><div>{rl('المصدر', 'Source')}</div><div>{rl('المسؤول', 'Owner')}</div><div>{rl('الأولوية', 'Priority')}</div><div>{rl('الاستحقاق', 'Due')}</div><div>{rl('الحالة', 'Status')}</div>
        </div>
        {filtered.map((a) => {
          const pr = (PR as Record<string, readonly string[]>)[a.priority] || ['#eee', '#555', '#999'];
          const [sb, sf] = SRC_COLOR[a.sourceType] || ['#eee', '#555'];
          const [b, f] = (AS as Record<string, readonly string[]>)[a.status] || ['#eee', '#555'];
          const openTask = a.kind === 'mtask' ? () => goto('mtasks') : a.kind === 'otask' ? () => goto('otasks') : undefined;
          return (
            <div key={a.kind + a.id} className="trow" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, padding: '13px 20px', borderBottom: '1px solid #f2f4f0', alignItems: 'center' }}>
              <div onClick={openTask} style={{ cursor: openTask ? 'pointer' : 'default' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2a332d', lineHeight: 1.4 }}>{tr(a.title)}</div>
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 2 }}>{tr(a.source)}</div>
              </div>
              <div><span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 6, padding: '4px 9px', background: sb, color: sf }}>{tr(a.sourceType)}</span></div>
              <div style={{ fontSize: 12.5, color: '#3c4a42' }}>{tr(a.owner)}</div>
              <div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#3c4a42' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: pr[2] }} />{tr(a.priority)}</span></div>
              <div style={{ fontSize: 12, color: '#3c4a42', fontWeight: 600 }}>{a.due === '—' ? '—' : dl(a.due)}</div>
              <div><Dropdown value={a.status} options={['مفتوح', 'قيد التنفيذ', 'مكتمل', 'متأخر'].map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setStatus(a, v)} opt={{ bg: b, color: f, weight: 700, size: 'sm', borderColor: 'transparent', block: true }} /></div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{rl('لا توجد إجراءات مطابقة', 'No matching actions')}</div>}
      </div>
    </Fade>
  );
}
