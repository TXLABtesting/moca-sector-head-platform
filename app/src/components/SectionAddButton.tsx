import { useState, type CSSProperties, type ReactNode } from 'react';
import { useCurrentUser } from '../store/useCurrentUser';
import { useI18n } from '../i18n/i18n';
import { can } from '../domain/permissions';
import { sectionFormKind } from '../screens/member/workflow';
import { MemberForm } from '../screens/member/MemberForm';

/** In-page "add" entry point for a section (never in the navbar).
 *
 *  - With `title`: renders the page header — title/description on the inline
 *    start (right in RTL) and the add button on the opposite side; on small
 *    screens the button wraps below the title full-width (.page-head CSS).
 *  - With `header`: renders just the button row at the top of the page,
 *    aligned to the inline end — for pages whose title lives inside a child
 *    component.
 *  - Otherwise: a standalone button row (legacy placement).
 *
 *  Renders no button unless the current user can add/edit in the section. */
export function SectionAddButton({ section, title, desc, header, style }: {
  section: string; title?: ReactNode; desc?: ReactNode; header?: boolean; style?: CSSProperties;
}) {
  const cu = useCurrentUser();
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [open, setOpen] = useState(false);

  const canAdd = cu.type !== 'chair' && (can(cu, section, 'add') || can(cu, section, 'edit'));
  if (!canAdd && title === undefined) return null;

  const kind = sectionFormKind(section);
  const label = kind === 'finance' ? rl('تقرير جديد', 'New report')
    : kind === 'audit' ? rl('ملاحظة جديدة', 'New note')
    : kind === 'minutes' ? rl('بند جديد', 'New item')
    : kind === 'correspondence' ? rl('إضافة وارد/صادر جديد', 'New correspondence')
    : kind === 'committee' ? rl('لجنة / بند جديد', 'New committee item')
    : kind === 'leave' ? rl('طلب إجازة جديد', 'New leave request')
    : kind === 'followup' ? rl('متابعة جديدة', 'New follow-up')
    : rl('إضافة / تحديث', 'Add / update');

  const btn = canAdd ? (
    <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -10px rgba(30,70,52,.45)' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      {label}
    </button>
  ) : null;

  const modal = open ? <MemberForm open onClose={() => setOpen(false)} section={section} /> : null;

  if (title !== undefined) {
    return (
      <>
        <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16, ...style }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#17211c' }}>{title}</h1>
            {desc && <p style={{ margin: 0, fontSize: 13, color: '#7d867f' }}>{desc}</p>}
          </div>
          {btn && <div className="page-head-action" style={{ flex: 'none' }}>{btn}</div>}
        </div>
        {modal}
      </>
    );
  }

  if (header) {
    return (
      <>
        <div className="page-head-action" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14, ...style }}>{btn}</div>
        {modal}
      </>
    );
  }

  return (
    <>
      <div className="page-head-action" style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16, ...style }}>{btn}</div>
      {modal}
    </>
  );
}
