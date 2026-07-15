import { useState, type CSSProperties } from 'react';
import { useCurrentUser } from '../store/useCurrentUser';
import { useI18n } from '../i18n/i18n';
import { can } from '../domain/permissions';
import { sectionFormKind } from '../screens/member/workflow';
import { MemberForm } from '../screens/member/MemberForm';

/** In-page "add" entry point for a section (replaces the old navbar button).
 *  Renders nothing unless the current user can add/edit in the section.
 *  Place at the bottom of the section's content. */
export function SectionAddButton({ section, style }: { section: string; style?: CSSProperties }) {
  const cu = useCurrentUser();
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [open, setOpen] = useState(false);

  const canAdd = cu.type !== 'chair' && (can(cu, section, 'add') || can(cu, section, 'edit'));
  if (!canAdd) return null;

  const kind = sectionFormKind(section);
  const label = kind === 'finance' ? rl('تقرير جديد', 'New report')
    : kind === 'audit' ? rl('ملاحظة جديدة', 'New note')
    : kind === 'minutes' ? rl('بند جديد', 'New item')
    : kind === 'correspondence' ? rl('صادر/وارد جديد', 'New correspondence')
    : kind === 'committee' ? rl('لجنة / بند جديد', 'New committee item')
    : kind === 'leave' ? rl('طلب إجازة جديد', 'New leave request')
    : kind === 'followup' ? rl('متابعة جديدة', 'New follow-up')
    : rl('إضافة / تحديث', 'Add / update');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16, ...style }}>
        <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {label}
        </button>
      </div>
      {open && <MemberForm open onClose={() => setOpen(false)} section={section} />}
    </>
  );
}
