import { useState } from 'react';
import { Modal } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { DateField } from '../../components/DateField';
import { FileUploadField } from '../../components/FileUploadField';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import { mColl, sectionFormKind, memberDefaultSection } from './workflow';
import { SECTIONS } from '../../domain/permissions';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props { open: boolean; onClose: () => void; section: string; editId?: string | null }

const STATUS_OPTS = ['مسودة', 'قيد التحديث', 'قيد المتابعة', 'قيد التنفيذ', 'بانتظار اعتماد رئيس القطاع', 'متأخر', 'مكتمل', 'معتمد'];
const PRI_OPTS = ['عالية', 'متوسطة', 'منخفضة'];

export function MemberForm({ open, onClose, section, editId }: Props) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const mutate = useStore((s) => s.mutate);
  const mutateWork = useStore((s) => s.mutateWork);
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);
  const { showToast } = useToast();

  const sec = section || memberDefaultSection(cu.id);
  const kind = sectionFormKind(sec);
  const coll = mColl(sec);

  // initial form values (load from existing record if editing)
  const initial: any = (() => {
    if (editId && coll) {
      const r = coll.get(data).find((x: any) => x.id === editId);
      if (r) return { ...coll.load(r) };
    }
    if (editId) {
      const w = work.find((x) => x.id === editId);
      if (w) return { title: w.title, note: '', fstatus: w.status };
    }
    return { title: '', note: '', fstatus: '' };
  })();

  const [f, setF] = useState<any>(initial);
  const set = (k: string) => (v: string) => setF((p: any) => ({ ...p, [k]: v }));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p: any) => ({ ...p, [k]: e.target.value }));

  const secObj = SECTIONS.find((s) => s.k === sec);
  const secName = secObj ? (lang === 'en' ? secObj.en : secObj.ar) : sec;

  const save = (send: boolean) => {
    const title = (f.title || '').trim();
    if (!title) { showToast(rl('يرجى إدخال العنوان', 'Please enter a title')); return; }
    if (coll) {
      mutate((d) => {
        let r: any;
        if (editId) {
          r = coll.get(d).find((x: any) => x.id === editId);
          if (r) {
            const nn = coll.make({ ...f }, cu.name);
            // never reset composite parts the form doesn't edit (timeline, tasks, scope…)
            const KEEP = new Set(['id', 'timeline', 'tasks', 'scope', 'attachments', 'directives', 'members', 'decisions', 'meetings', 'actions', 'keyPoints', 'no', 'stage']);
            Object.keys(nn).forEach((k) => { if (!KEEP.has(k)) r[k] = nn[k]; });
          }
        } else {
          r = coll.make({ ...f }, cu.name); r._mowner = cu.id; coll.get(d).unshift(r);
        }
        if (r) {
          r._mret = ''; r._mrev = !!send;
          if (send) r._mowner = r._mowner || cu.id;
          r._mlog = r._mlog || [];
          r._mlog.unshift({ at: lang === 'en' ? 'Just now' : 'الآن', to: send ? 'بانتظار اعتماد رئيس القطاع' : (f.fstatus || coll.status(r)), note: (f.note || '').trim(), sent: !!send, by: cu.name });
        }
      });
    } else {
      // sections without a shared collection (e.g. finReports, recommendations) → workflow items
      const status = send ? 'بانتظار اعتماد رئيس القطاع' : ((f.fstatus || '').trim() || 'مسودة');
      mutateWork((w) => {
        const it = editId ? w.find((x) => x.id === editId) : undefined;
        if (it) { it.title = title; it.status = status; it.date = rl('اليوم', 'Today'); if (send) it.reason = undefined; }
        else w.unshift({ id: 'wf' + Date.now(), owner: cu.id, section: sec, title, status, date: rl('اليوم', 'Today') });
      });
    }
    showToast(send ? rl('تم الإرسال لمراجعة رئيس القطاع — ظاهر لديه الآن', 'Sent for review — visible to Sector Head') : rl('تم الحفظ في السجل المشترك', 'Saved to the shared record'));
    onClose();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
  const DATE_KEYS = new Set(['start', 'due', 'fdate', 'deadline']);
  const Field = ({ label, k, ph }: { label: string; k: string; ph?: string }) => (
    <div><Label>{label}</Label>{DATE_KEYS.has(k)
      ? <DateField value={f[k] || ''} onChange={(v) => setF((p: any) => ({ ...p, [k]: v }))} />
      : <input value={f[k] || ''} onChange={setI(k)} placeholder={ph} style={inputStyle} />}</div>
  );

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#17211c' }}>{editId ? rl('تحديث البند', 'Update item') : rl('بند جديد', 'New item')}</h3>
        <span style={{ fontSize: 11.5, color: '#9aa39b' }}>{secName}</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>{rl('يُحفظ في نفس السجل الذي يراه رئيس القطاع.', 'Saved to the same record the Sector Head sees.')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Field label={rl('العنوان', 'Title')} k="title" /></div>

        {kind === 'project' && (<>
          <Field label={rl('المسؤول', 'Owner')} k="owner" />
          <div><Label>{rl('الأولوية', 'Priority')}</Label><Dropdown value={f.priority || ''} options={PRI_OPTS.map((v) => ({ v, label: tr(v) }))} onChange={set('priority')} opt={{ block: true, size: 'sm' }} /></div>
          <Field label={rl('الميزانية', 'Budget')} k="budget" />
          <Field label={rl('نسبة الإنجاز %', 'Progress %')} k="progress" />
          <Field label={rl('تاريخ البدء', 'Start date')} k="start" />
          <Field label={rl('تاريخ الانتهاء', 'Due date')} k="due" />
          <div style={{ gridColumn: '1 / -1' }}><Field label={rl('الخطوة القادمة', 'Next step')} k="next" /></div>
          <div style={{ gridColumn: '1 / -1' }}><Field label={rl('المخرج النهائي', 'Final deliverable')} k="final" /></div>
        </>)}

        {kind === 'correspondence' && (<>
          <div><Label>{rl('النوع', 'Direction')}</Label><Dropdown value={f.dir || 'صادر'} options={['صادر', 'وارد'].map((v) => ({ v, label: tr(v) }))} onChange={set('dir')} opt={{ block: true, size: 'sm' }} /></div>
          <Field label={rl('نوع المستند', 'Doc type')} k="docType" />
          <Field label={rl('الجهة', 'Entity')} k="entity" />
          <Field label={rl('التاريخ', 'Date')} k="fdate" />
          <Field label={rl('المرسل', 'Sender')} k="sender" />
          <Field label={rl('المستلم', 'Recipient')} k="recipient" />
          <Field label={rl('المتابع', 'Follow-up')} k="followup" />
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>{rl('المرفق', 'Attachment')}</Label>
            <FileUploadField multiple={false} files={f.attachment ? [String(f.attachment)] : []} onChange={(fs) => setF((p: any) => ({ ...p, attachment: fs[0] || '' }))} />
          </div>
        </>)}

        {kind === 'audit' && (<>
          <Field label={rl('الجهة / المجال', 'Area')} k="entity" />
          <div><Label>{rl('الأهمية', 'Importance')}</Label><Dropdown value={f.imp || ''} options={PRI_OPTS.map((v) => ({ v, label: tr(v) }))} onChange={set('imp')} opt={{ block: true, size: 'sm' }} /></div>
          <Field label={rl('المسؤول', 'Owner')} k="respOwner" />
          <Field label={rl('تاريخ التنفيذ', 'Due')} k="due" />
          <div style={{ gridColumn: '1 / -1' }}><Field label={rl('آلية الإغلاق', 'Corrective action')} k="action" /></div>
        </>)}

        {kind === 'finance' && (<>
          <Field label={rl('النوع', 'Type')} k="docType" />
          <Field label={rl('الجهة', 'Entity')} k="entity" />
          <Field label={rl('المسؤول', 'Owner')} k="respOwner" />
        </>)}

        {kind === 'leave' && (<>
          <Field label={rl('النوع', 'Type')} k="docType" />
          <Field label={rl('الإدارة', 'Dept')} k="entity" />
          <Field label={rl('من', 'Start')} k="start" />
          <Field label={rl('إلى', 'End')} k="due" />
          <Field label={rl('البديل', 'Backup')} k="backup" />
        </>)}

        {(kind === 'minutes' || kind === 'committee') && (
          <Field label={rl('التاريخ', 'Date')} k="fdate" />
        )}

        <div><Label>{rl('الحالة', 'Status')}</Label><Dropdown value={f.fstatus || ''} options={STATUS_OPTS.map((v) => ({ v, label: tr(v) }))} onChange={set('fstatus')} opt={{ block: true, size: 'sm', placeholder: rl('اختر الحالة', 'Select status') }} /></div>

        <div style={{ gridColumn: '1 / -1' }}><Label>{rl('ملاحظات', 'Notes')}</Label><textarea onChange={setI('note')} defaultValue={f.note || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ كمسودة', 'Save as draft')}</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إرسال لرئيس القطاع', 'Send to Sector Head')}</button>
      </div>
    </Modal>
  );
}
