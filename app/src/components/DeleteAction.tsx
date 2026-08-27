import { useState, type CSSProperties } from 'react';
import { useCurrentUser } from '../store/useCurrentUser';
import { useI18n } from '../i18n/i18n';
import { useToast } from './Toast';
import { can } from '../domain/permissions';
import { Modal } from './ui';

/**
 * Explicit, permission-gated delete control that maps to the `d` (حذف) grant.
 *
 * Renders nothing unless the current user may delete in `section`
 * (`can(cu, section, 'del')`, which the Sector Head/`all` bypasses). On click it
 * asks for confirmation, then runs `onConfirm` — the caller removes the record
 * from its collection via `mutate`, and dataSync propagates the DELETE to the
 * backend (which independently re-checks `section:del`).
 *
 * Two visual variants:
 *  - `icon` (default): a compact trash button for card/row corners.
 *  - `text`: an inline labelled button for toolbars/detail views.
 */
export function DeleteAction({
  section,
  onConfirm,
  itemName,
  variant = 'icon',
  title,
  style,
}: {
  section: string;
  onConfirm: () => void;
  /** Human label of the record, shown in the confirm dialog for clarity. */
  itemName?: string;
  variant?: 'icon' | 'text';
  /** Optional override for the confirm heading (defaults to a generic delete prompt). */
  title?: string;
  style?: CSSProperties;
}) {
  const cu = useCurrentUser();
  const { lang } = useI18n();
  const { showToast } = useToast();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [open, setOpen] = useState(false);

  if (!can(cu, section, 'del')) return null;

  const confirm = () => {
    setOpen(false);
    onConfirm();
    showToast(rl('تم الحذف', 'Deleted'));
  };

  const trash = (
    <svg width={variant === 'text' ? 14 : 15} height={variant === 'text' ? 14 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );

  const trigger = variant === 'text' ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      title={rl('حذف', 'Delete')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fbecec', color: '#b4302f', border: '1px solid #f3d6d6', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', ...style }}
    >
      {trash}{rl('حذف', 'Delete')}
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      title={rl('حذف', 'Delete')}
      aria-label={rl('حذف', 'Delete')}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: '#fbecec', color: '#b4302f', border: '1px solid #f3d6d6', borderRadius: 9, cursor: 'pointer', flex: 'none', ...style }}
    >
      {trash}
    </button>
  );

  return (
    <>
      {trigger}
      <Modal open={open} onClose={() => setOpen(false)} width={420}>
        <div style={{ textAlign: 'center', padding: '4px 4px 2px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fbecec', color: '#b4302f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#17211c' }}>
            {title || rl('تأكيد الحذف', 'Confirm delete')}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#7d867f', lineHeight: 1.7 }}>
            {itemName
              ? rl(`سيتم حذف «${itemName}» نهائياً. لا يمكن التراجع عن هذا الإجراء.`, `“${itemName}” will be permanently deleted. This action cannot be undone.`)
              : rl('سيتم حذف هذا العنصر نهائياً. لا يمكن التراجع عن هذا الإجراء.', 'This item will be permanently deleted. This action cannot be undone.')}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: '#f4f6f2', color: '#3c4a42', border: '1px solid #e2e6df', borderRadius: 11, padding: '10px 20px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {rl('إلغاء', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={confirm}
              style={{ background: '#b4302f', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 20px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {rl('حذف نهائي', 'Delete')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
