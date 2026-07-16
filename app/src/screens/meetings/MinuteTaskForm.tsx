import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { DateField } from '../../components/DateField';
import { FileUploadField } from '../../components/FileUploadField';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import type { MinuteTask } from '../../data/types';
import { MT_STATUSES } from './mtShared';

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
const secHead = (t: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px' }}>
    <span style={{ width: 5, height: 16, borderRadius: 4, background: '#1e4634' }} />
    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#17211c' }}>{t}</span>
  </div>
);

/** Add/edit a meeting-minutes task in the SAME shared record the chair sees.
 *  The related meeting/minute must be chosen first; owner defaults to the creator. */
export function MinuteTaskForm({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { tr } = useI18n();
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const existing = taskId ? data.mtasks.find((x) => x.id === taskId) : null;
  const pool = Array.from(new Set([...data.members.map((m) => m.name), ...data.sectorManagers.map((m) => m.name)]));

  // Related meeting/minute options: seeded/created minutes + meetings already grouped in the tasks table.
  const meetingOpts = useMemo(() => {
    const m = new Map<string, { mDate: string; dept: string }>();
    data.mtasks.forEach((tk) => { if (!m.has(tk.meeting)) m.set(tk.meeting, { mDate: tk.mDate, dept: tk.dept }); });
    data.meetings.forEach((mt) => { if (!m.has(mt.title)) m.set(mt.title, { mDate: mt.date, dept: mt.entity || 'مكتب رئيس القطاع' }); });
    return m;
  }, [data.mtasks, data.meetings]);

  const [meeting, setMeeting] = useState(existing?.meeting || '');
  const [f, setF] = useState<Record<string, string>>(() => existing ? {
    task: existing.task, desc: existing.desc || '', dept: existing.dept, due: existing.due === '—' ? '' : existing.due,
    status: existing.status, prog: String(existing.prog ?? ''), notes: existing.notes || '',
  } : { task: '', desc: '', dept: '', due: '', status: 'لم يبدأ', prog: '', notes: '' });
  const [owner, setOwner] = useState(existing?.owner || cu.name);
  const [participants, setParticipants] = useState<string[]>(() => existing?.participants ? [...existing.participants] : []);
  const [atts, setAtts] = useState<string[]>(() => existing?.attachments ? [...existing.attachments] : []);
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const pickMeeting = (title: string) => {
    setMeeting(title);
    const info = meetingOpts.get(title);
    if (info && !existing) setF((p) => ({ ...p, dept: info.dept }));
  };

  const save = (send: boolean) => {
    if (!meeting) { showToast('يرجى اختيار الاجتماع / المحضر المرتبط أولاً'); return; }
    if (!(f.task || '').trim()) { showToast('يرجى إدخال عنوان المهمة'); return; }
    const info = meetingOpts.get(meeting);
    mutate((d) => {
      let tk: MinuteTask & { _mrev?: boolean; _mret?: string; _mowner?: string; _mlog?: unknown[] };
      if (existing) tk = d.mtasks.find((x) => x.id === taskId)! as never;
      else {
        tk = { id: 'mtk' + Math.floor(Math.random() * 1e9), mDate: '', meeting: '', dept: '', task: '', owner: cu.name, support: 'لا يوجد', prerequisite: 'لا يوجد', budget: 'لا يوجد', dependencies: 'لا يوجد', status: 'لم يبدأ', due: '—', notes: '', directives: [], reviewed: false };
        d.mtasks.unshift(tk);
        tk._mowner = cu.id;
      }
      if (!tk) return;
      tk.meeting = meeting;
      tk.mDate = existing ? tk.mDate : (info?.mDate || tk.mDate || '—');
      tk.dept = (f.dept || '').trim() || info?.dept || '—';
      tk.task = f.task.trim(); tk.desc = (f.desc || '').trim();
      tk.owner = owner || cu.name; tk.participants = participants.filter(Boolean);
      tk.due = (f.due || '').trim() || '—'; tk.status = f.status || 'لم يبدأ';
      tk.prog = Math.max(0, Math.min(100, parseInt(f.prog, 10) || 0));
      tk.attachments = atts; tk.notes = (f.notes || '').trim();
      tk.lastUpdate = 'الآن — ' + cu.name;
      if (send) { tk._mrev = true; tk._mret = ''; tk._mowner = tk._mowner || cu.id; }
      (tk._mlog = tk._mlog || []).unshift({ at: 'الآن', to: send ? 'بانتظار مراجعة رئيس القطاع' : (existing ? 'تحديث بيانات المهمة' : 'إنشاء المهمة'), sent: !!send, by: cu.name });
    });
    showToast(send ? 'أُرسلت المهمة لرئيس القطاع للمراجعة — ظاهرة لديه في مهام المحاضر' : (existing ? 'حُفظت تعديلات المهمة' : 'حُفظت المهمة'));
    onClose();
  };

  return (
    <Modal open onClose={onClose} width={680}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{existing ? 'تعديل مهمة المحضر' : 'إضافة مهمة جديدة'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>تُحفظ في نفس سجل مهام المحاضر الذي يراه رئيس القطاع — لا يُنشأ سجل مكرر عند التعديل.</p>

      {secHead('الاجتماع / المحضر المرتبط')}
      <Dropdown value={meeting} options={[...meetingOpts.keys()].map((tt) => ({ v: tt, label: tr(tt) }))} onChange={pickMeeting} opt={{ block: true, size: 'sm', placeholder: 'اختر الاجتماع أو المحضر المرتبط…' }} />
      {meeting && meetingOpts.get(meeting) && (
        <div style={{ fontSize: 11, color: '#7d867f', marginTop: 6 }}>تاريخ الاجتماع: {meetingOpts.get(meeting)!.mDate}</div>
      )}

      {secHead('بيانات المهمة')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>عنوان المهمة</Label><textarea value={f.task} onChange={setI('task')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>وصف المهمة (اختياري)</Label><textarea value={f.desc} onChange={setI('desc')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
        <div><Label>المسؤول عن التنفيذ</Label><Dropdown value={owner} options={pool.map((n) => ({ v: n, label: tr(n) }))} onChange={setOwner} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>الجهة / الإدارة المعنية</Label><input value={f.dept} onChange={setI('dept')} style={inputStyle} /></div>
        <div><Label>تاريخ الاستحقاق</Label><DateField value={f.due} onChange={(v) => setF((p) => ({ ...p, due: v }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px', gap: 10 }}>
          <div><Label>الحالة</Label><Dropdown value={f.status} options={MT_STATUSES.map((s) => ({ v: s, label: tr(s) }))} onChange={(v) => setF((p) => ({ ...p, status: v }))} opt={{ block: true, size: 'sm' }} /></div>
          <div><Label>الإنجاز %</Label><input value={f.prog} onChange={setI('prog')} placeholder="%" style={{ ...inputStyle, textAlign: 'center' }} /></div>
        </div>
      </div>

      {secHead('مشاركون إضافيون')}
      <div>
        <Dropdown value="" options={pool.filter((n) => n !== owner && !participants.includes(n)).map((n) => ({ v: n, label: tr(n) }))} onChange={(v) => { if (v) setParticipants((p) => [...p, v]); }} opt={{ block: true, size: 'sm', placeholder: 'إضافة مشارك…' }} />
        {participants.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
            {participants.map((n) => (
              <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e4634', background: '#eef5f0', color: '#1e4634', borderRadius: 20, padding: '4px 9px', fontSize: 11.5, fontWeight: 700 }}>
                {tr(n)}
                <button type="button" onClick={() => setParticipants((p) => p.filter((x) => x !== n))} style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {secHead('المرفقات')}
      <FileUploadField files={atts} onChange={setAtts} />

      {secHead('ملاحظات')}
      <textarea value={f.notes} onChange={setI('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>حفظ كمسودة</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>إرسال لرئيس القطاع</button>
      </div>
    </Modal>
  );
}
