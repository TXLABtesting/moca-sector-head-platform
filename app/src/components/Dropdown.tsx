import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/i18n';

export interface DDOption { v: string; label: string }

export interface DropdownOpts {
  placeholder?: string;
  size?: 'sm' | 'md';
  fontSize?: string;
  block?: boolean;
  minWidth?: string;
  maxWidth?: string;
  borderColor?: string;
  bg?: string;
  color?: string;
  radius?: string;
  weight?: number;
  btnStyle?: CSSProperties;
  popMinWidth?: string;
  popMaxWidth?: string;
}

interface DropdownProps {
  value: string;
  options: DDOption[];
  onChange: (v: string) => void;
  opt?: DropdownOpts;
}

/** Portal-based dropdown matching the prototype's renderDD (fixed-position popup,
 *  flips up near the viewport bottom, closes on outside click / scroll). */
export function Dropdown({ value, options, onChange, opt = {} }: DropdownProps) {
  const { dir } = useI18n();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; right: number; width: number; btnTop: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const sel = options.find((o) => String(o.v) === String(value));
  const label = sel ? sel.label : (opt.placeholder || '');
  const sm = opt.size === 'sm';
  const fs = opt.fontSize || (sm ? '12px' : '13px');

  const close = useCallback(() => { setOpen(false); setRect(null); }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-dd],[data-dd-pop]')) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) { close(); return; }
    const b = btnRef.current;
    if (b) {
      const r = b.getBoundingClientRect();
      setRect({ top: r.bottom, left: r.left, right: r.right, width: r.width, btnTop: r.top });
    }
    setOpen(true);
  };

  const btnStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    width: opt.block ? '100%' : 'auto', minWidth: opt.minWidth || 'auto', maxWidth: opt.maxWidth || 'none',
    border: '1px solid ' + (open ? '#1e4634' : (opt.borderColor || '#e2e6df')),
    background: opt.bg || '#f7f8f6', color: opt.color || '#2a332d',
    borderRadius: opt.radius || '10px', padding: sm ? '7px 11px' : '9px 13px',
    fontSize: fs, fontWeight: opt.weight || 600, fontFamily: 'inherit', cursor: 'pointer',
    lineHeight: 1.2, boxShadow: open ? '0 0 0 3px rgba(30,70,52,.10)' : 'none',
    transition: 'border-color .15s,box-shadow .15s', whiteSpace: 'nowrap', ...opt.btnStyle,
  };

  let pop = null;
  if (open && rect) {
    const vpH = window.innerHeight;
    const below = vpH - rect.top;
    const above = rect.btnTop;
    const flip = below < 240 && above > below;
    const mh = Math.min(328, Math.max(140, (flip ? above : below) - 14));
    const vpos: CSSProperties = flip ? { bottom: (vpH - rect.btnTop + 6) + 'px' } : { top: (rect.top + 6) + 'px' };
    const side: CSSProperties = dir === 'rtl'
      ? { right: Math.max(6, window.innerWidth - rect.right) + 'px' }
      : { left: Math.max(6, rect.left) + 'px' };
    pop = createPortal(
      <div data-dd-pop dir={dir} style={{
        position: 'fixed', ...side, ...vpos, zIndex: 600,
        minWidth: Math.max(rect.width, 140) + 'px', maxWidth: opt.popMaxWidth || '320px',
        maxHeight: mh + 'px', overflowY: 'auto', background: '#fff',
        border: '1px solid #edf0ea', borderRadius: 14,
        boxShadow: '0 14px 40px -12px rgba(23,40,32,.30),0 3px 10px rgba(23,40,32,.06)',
        padding: 6, animation: 'ddIn .16s ease',
      }}>
        {options.map((o, i) => {
          const isSel = String(o.v) === String(value);
          return (
            <div key={i}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); close(); onChange(o.v); }}
              onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f4f6f2'; }}
              onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '9px 11px', borderRadius: 9, fontSize: fs, fontWeight: isSel ? 700 : 500,
                color: isSel ? '#1e4634' : '#3c4a42', background: isSel ? '#eef3f0' : 'transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .12s',
              }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
              {isSel && (
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#1e4634" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </div>
          );
        })}
      </div>,
      document.body
    );
  }

  return (
    <div data-dd dir={dir} style={{ position: 'relative', display: opt.block ? 'block' : 'inline-block', verticalAlign: 'middle' }}>
      <button ref={btnRef} type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggle(); }} style={btnStyle}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', opacity: .5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {pop}
    </div>
  );
}
