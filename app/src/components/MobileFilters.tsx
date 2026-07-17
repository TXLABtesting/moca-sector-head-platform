import { useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';

/** Responsive filter container: on desktop the children render as the usual
 *  inline filter row; on phones they collapse into a «فلاتر (n)» button that
 *  opens a bottom sheet with apply / clear / close actions. The children are
 *  controlled by the parent, so both renders share the same state. */
export function MobileFilters({ children, activeCount = 0, onClear, rowStyle, rowClassName }: {
  children: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  rowStyle?: CSSProperties;
  rowClassName?: string;
}) {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [open, setOpen] = useState(false);

  const footBtn: CSSProperties = { flex: 1, borderRadius: 11, padding: '12px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 };

  return (
    <>
      {/* desktop / tablet: the normal inline row */}
      <div className={'flt-desk' + (rowClassName ? ' ' + rowClassName : '')} style={rowStyle}>{children}</div>

      {/* phone: single button with the active-filter count */}
      <button type="button" className="flt-btn" onClick={() => setOpen(true)}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></svg>
        {rl('فلاتر', 'Filters')}
        {activeCount > 0 && <span className="flt-badge">{activeCount}</span>}
      </button>

      {open && (
        <>
          <div className="flt-scrim" onClick={() => setOpen(false)} />
          <div className="flt-sheet" role="dialog" aria-label={rl('الفلاتر', 'Filters')}>
            <div className="flt-sheet-head">
              <span style={{ fontSize: 15, fontWeight: 800, color: '#17211c', display: 'flex', alignItems: 'center', gap: 8 }}>
                {rl('الفلاتر', 'Filters')}
                {activeCount > 0 && <span className="flt-badge">{activeCount}</span>}
              </span>
              <button onClick={() => setOpen(false)} aria-label={rl('إغلاق', 'Close')} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e6df', background: '#f7f8f6', cursor: 'pointer', color: '#7d867f', fontSize: 15, fontFamily: 'inherit' }}>✕</button>
            </div>
            <div className="flt-sheet-body">{children}</div>
            <div className="flt-sheet-foot">
              <button onClick={() => setOpen(false)} style={{ ...footBtn, background: '#1e4634', color: '#fff', border: 'none' }}>{rl('تطبيق الفلاتر', 'Apply')}</button>
              {onClear && (
                <button onClick={() => { onClear(); }} style={{ ...footBtn, background: '#fff', color: '#b0433b', border: '1px solid #efd9d6' }}>{rl('مسح الفلاتر', 'Clear')}</button>
              )}
              <button onClick={() => setOpen(false)} style={{ ...footBtn, background: '#f2f4f0', color: '#3c4a42', border: '1px solid #e2e6df' }}>{rl('إغلاق', 'Close')}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
