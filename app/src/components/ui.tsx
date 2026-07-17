import { type ReactNode, type CSSProperties, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AV } from '../shared/constants';
import { initials, memberImg } from '../shared/helpers';

/** Page fade-in wrapper (matches the prototype's fadeUp). */
export function Fade({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ animation: 'fadeUp .16s ease', ...style }}>{children}</div>;
}

/** Status pill. */
export function Badge({ bg, fg, children, style }: { bg: string; fg: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: bg, color: fg, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}

export function statusPair(map: Record<string, readonly string[]>, key: string, fallback: readonly string[] = ['#eceeeb', '#6d7973']): readonly string[] {
  return map[key] || fallback;
}

function hashIdx(s: string, n: number): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

/** Avatar: uses the member photo when known, otherwise coloured initials. */
export function Avatar({ name, size = 40, img, radius = '50%' }: { name: string; size?: number; img?: string; radius?: string | number }) {
  const src = img || memberImg(name);
  if (src) {
    return <img src={src} alt={name} style={{ width: size, height: size, flex: 'none', borderRadius: radius, objectFit: 'cover', objectPosition: 'top', display: 'block' }} />;
  }
  const [bg, fg] = AV[hashIdx(name || '؟', AV.length)];
  return (
    <span style={{
      width: size, height: size, flex: 'none', borderRadius: radius, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: bg, color: fg,
      fontSize: Math.round(size * 0.36), fontWeight: 700,
    }}>{initials(name)}</span>
  );
}

/** Modal overlay: dimmed site visible behind, opaque white card. */
export function Modal({ open, onClose, children, width = 520, padded = true }: {
  open: boolean; onClose: () => void; children: ReactNode; width?: number | string; padded?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div onClick={onClose} className="modal-scrim" style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(23,33,28,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      animation: 'ovBg .18s ease', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" style={{
        background: '#ffffff', borderRadius: 22, width, maxWidth: '100%', maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 30px 80px -20px rgba(19,43,32,.5)',
        padding: padded ? '24px 26px' : 0, animation: 'ovCard .24s cubic-bezier(.22,1,.36,1)',
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Right/left side drawer panel (RTL-aware), opaque white. */
export function Drawer({ open, onClose, children, width = 460 }: {
  open: boolean; onClose: () => void; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(23,33,28,.4)', display: 'flex', justifyContent: 'flex-start', animation: 'ovBg .18s ease' }}>
      <div onClick={(e) => e.stopPropagation()} className="aud-drawer" style={{
        marginInlineStart: 'auto', width, maxWidth: '92vw', height: '100%', background: '#fff',
        boxShadow: '0 0 60px rgba(10,25,18,.28)', overflowY: 'auto', animation: 'slideInX .24s ease',
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Standard glass card used across the main content area. */
export function Card({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={'glass ' + className} style={{
      borderRadius: 20, boxShadow: '0 1px 2px rgba(20,45,32,.04),0 14px 34px -18px rgba(20,45,32,.2)',
      padding: '20px 22px', ...style,
    }}>{children}</div>
  );
}
