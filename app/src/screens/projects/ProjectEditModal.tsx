import { useState } from 'react';
import { Modal } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { DateField } from '../../components/DateField';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { useCurrentUser } from '../../store/useCurrentUser';
import { UNITS } from '../../shared/constants';
import type { Project } from '../../data/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_OPTS = ['لم يبدأ', 'قيد التنفيذ', 'متأخر', 'مكتمل', 'يحتاج قرار', 'بانتظار الاعتماد'];
const PRI_OPTS = ['عالية', 'متوسطة', 'منخفضة'];

/** Full project editor for permitted members: every existing component of the
 *  project is editable — core info, dates, budget, description, final output,
 *  next step, risks, and the scope bullets. Timeline/tasks/directives/attachments
 *  are preserved untouched (they have their own in-tab actions). */
export function ProjectEditModal({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const cu = useCurrentUser();
  const data = useStore((s) => s.data);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();

  const editing = !!project;
  const [f, setF] = useState<any>(() => project ? {
    name: project.name, nameEn: project.nameEn || '', owner: project.owner, unit: project.unit || 'قطاع الخدمات المركزية',
    status: project.status, priority: project.priority, progress: String(project.progress ?? ''), budget: String(project.budget ?? ''),
    startDate: project.startDate || '', dueDate: project.dueDate || '', deadline: project.deadline || '',
    desc: project.desc || '', finalOutput: project.finalOutput || '', nextStep: project.nextStep || '',
    risks: project.risks || '', scope: (project.scope || []).join('\n'), updateNote: '',
    endUser: project.endUser || '', supplier: project.supplier || '', poNumber: project.poNumber || '',
    dependencies: project.dependencies || '', milestones: (project.milestones || []).join('\n'),
  } : {
    name: '', nameEn: '', owner: cu.name, unit: 'قطاع الخدمات المركزية', status: 'لم يبدأ', priority: 'متوسطة',
    progress: '0', budget: '', startDate: '', dueDate: '', deadline: '', desc: '', finalOutput: '',
    nextStep: '', risks: '', scope: '', updateNote: '',
    endUser: '', supplier: '', poNumber: '', dependencies: '', milestones: '',
  });

  const set = (k: string) => (v: string) => setF((p: any) => ({ ...p, [k]: v }));
  const setI = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p: any) => ({ ...p, [k]: e.target.value }));

  const ownerNames = Array.from(new Set([
    ...data.members.map((m) => m.name),
    ...data.sectorManagers.map((m) => m.name),
    ...(f.owner ? [f.owner] : []),
  ]));
  const unitOpts = Array.from(new Set(['قطاع الخدمات المركزية', ...UNITS, ...(f.unit ? [f.unit] : [])]));

  const save = (send: boolean) => {
    const name = (f.name || '').trim();
    if (!name) { showToast(rl('يرجى إدخال اسم المشروع', 'Please enter the project name')); return; }
    mutate((d) => {
      let p: any;
      if (editing) p = d.projects.find((x) => x.id === project!.id);
      else {
        p = { id: 'p' + Date.now(), no: String(d.projects.length + 1).padStart(2, '0'), stage: 'PLANNING',
          lastDate: 'اليوم', chairmanNotes: '', people: [], attachments: [], timeline: [], tasks: [], scope: [] };
        d.projects.unshift(p);
        p._mowner = cu.id;
      }
      if (!p) return;
      p.name = name; p.nameEn = (f.nameEn || '').trim(); p.owner = f.owner || cu.name; p.unit = f.unit;
      p.status = f.status; p.priority = f.priority;
      p.progress = Math.max(0, Math.min(100, parseInt(f.progress, 10) || 0));
      p.budget = parseInt(String(f.budget).replace(/[^\d]/g, ''), 10) || 0;
      p.startDate = (f.startDate || '').trim(); p.dueDate = (f.dueDate || '').trim(); p.deadline = (f.deadline || '').trim();
      p.desc = (f.desc || '').trim(); p.finalOutput = (f.finalOutput || '').trim(); p.nextStep = (f.nextStep || '').trim();
      p.risks = (f.risks || '').trim();
      p.scope = String(f.scope || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
      p.endUser = (f.endUser || '').trim();
      p.supplier = (f.supplier || '').trim();
      p.poNumber = (f.poNumber || '').trim();
      p.dependencies = (f.dependencies || '').trim();
      p.milestones = String(f.milestones || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
      const note = (f.updateNote || '').trim();
      if (note) (p.timeline = p.timeline || []).unshift({ text: note, by: cu.name, date: 'اليوم' });
      if (send) { p._mrev = true; p._mret = ''; p._mowner = p._mowner || cu.id; }
      (p._mlog = p._mlog || []).unshift({
        at: rl('الآن', 'Just now'),
        to: send ? 'بانتظار اعتماد رئيس القطاع' : (editing ? rl('تحديث بيانات المشروع', 'Project data updated') : rl('إنشاء المشروع', 'Project created')),
        note, sent: !!send, by: cu.name,
      });
    });
    showToast(send
      ? rl('تم الحفظ والإرسال لمراجعة رئيس القطاع', 'Saved and sent for Sector Head review')
      : rl('تم حفظ جميع بيانات المشروع', 'All project data saved'));
    onClose();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none' };
  const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6b62', margin: '2px 0 6px' }}>{children}</div>;
  const Field = ({ label, k, ph }: { label: string; k: string; ph?: string }) => (
    <div><Label>{label}</Label><input value={f[k] || ''} onChange={setI(k)} placeholder={ph} style={inputStyle} /></div>
  );
  const Area = ({ label, k, rows = 3, ph }: { label: string; k: string; rows?: number; ph?: string }) => (
    <div style={{ gridColumn: '1 / -1' }}><Label>{label}</Label><textarea value={f[k] || ''} onChange={setI(k)} rows={rows} placeholder={ph} style={{ ...inputStyle, resize: 'vertical' }} /></div>
  );

  return (
    <Modal open onClose={onClose} width={640}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#17211c' }}>
          {editing ? rl('تعديل المشروع — جميع المكونات', 'Edit project — all components') : rl('مشروع جديد', 'New project')}
        </h3>
        {editing && <span style={{ fontSize: 11, color: '#9aa39b' }}>{tr(project!.name)}</span>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9aa39b' }}>
        {rl('التعديلات تقع على نفس السجل الذي يراه رئيس القطاع. التحديثات والمهام والتوجيهات والمرفقات تُدار من تبويباتها ولا تتأثر.', 'Edits apply to the same record the Sector Head sees. Updates, tasks, directives and attachments are managed from their tabs and are not affected.')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Field label={rl('اسم المشروع', 'Project name')} k="name" /></div>
        <Field label={rl('الاسم الإنجليزي', 'English name')} k="nameEn" />
        <div><Label>{rl('المسؤول', 'Owner')}</Label><Dropdown value={f.owner} options={ownerNames.map((n) => ({ v: n, label: tr(n) }))} onChange={set('owner')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('الوحدة التنظيمية', 'Org unit')}</Label><Dropdown value={f.unit} options={unitOpts.map((u) => ({ v: u, label: tr(u) }))} onChange={set('unit')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('الحالة', 'Status')}</Label><Dropdown value={f.status} options={STATUS_OPTS.map((s) => ({ v: s, label: tr(s) }))} onChange={set('status')} opt={{ block: true, size: 'sm' }} /></div>
        <div><Label>{rl('الأولوية', 'Priority')}</Label><Dropdown value={f.priority} options={PRI_OPTS.map((s) => ({ v: s, label: tr(s) }))} onChange={set('priority')} opt={{ block: true, size: 'sm' }} /></div>
        <Field label={rl('نسبة الإنجاز %', 'Progress %')} k="progress" />
        <Field label={rl('الميزانية (درهم)', 'Budget (AED)')} k="budget" />
        <div><Label>{rl('تاريخ البدء', 'Start date')}</Label><DateField value={f.startDate || ''} onChange={set('startDate')} /></div>
        <div><Label>{rl('الانتهاء المتوقع', 'Expected finish')}</Label><DateField value={f.dueDate || ''} onChange={set('dueDate')} /></div>
        <div><Label>{rl('الموعد النهائي', 'Deadline')}</Label><DateField value={f.deadline || ''} onChange={set('deadline')} /></div>
        <div><Label>{rl('الخطوة القادمة', 'Next step')}</Label><input value={f.nextStep || ''} onChange={setI('nextStep')} style={inputStyle} /></div>
        <Area label={rl('وصف المشروع', 'Description')} k="desc" />
        <Area label={rl('المخرج النهائي للمشروع', 'Final deliverable')} k="finalOutput" rows={2} />
        <Area label={rl('نطاق المشروع (سطر لكل بند)', 'Project scope (one line per bullet)')} k="scope" rows={4} />
        <Area label={rl('خطة المراحل الرئيسية (مرحلة لكل سطر)', 'Key milestones plan (one phase per line)')} k="milestones" rows={4} />
        <Field label={rl('المستخدم النهائي', 'End user')} k="endUser" />
        <Field label={rl('اسم المورد', 'Supplier')} k="supplier" />
        <div style={{ gridColumn: '1 / -1' }}><Field label={rl('رقم طلب الشراء / العقد / طلب التوريد', 'PO / contract / supply-request no.')} k="poNumber" /></div>
        <Area label={rl('الاعتماديات (ما يعتمد عليه المشروع)', 'Dependencies')} k="dependencies" rows={2} />
        <Area label={rl('المخاطر', 'Risks')} k="risks" rows={2} />
        <Area label={rl('ملاحظة تحديث (اختياري — تُضاف إلى سجل التحديثات)', 'Update note (optional — added to the updates log)')} k="updateNote" rows={2} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
        <button onClick={() => save(false)} style={{ background: '#fff', border: '1px solid #cdd8ce', color: '#1e4634', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ', 'Save')}</button>
        <button onClick={() => save(true)} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ وإرسال لرئيس القطاع', 'Save & send to Sector Head')}</button>
      </div>
    </Modal>
  );
}
