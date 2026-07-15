import { ICN } from '../shared/constants';
import type { CSSProperties } from 'react';

interface IconProps {
  name: keyof typeof ICN | string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
}

/** Renders an icon from the shared ICN registry (24x24 stroke paths). */
export function Icon({ name, size = 20, stroke = 'currentColor', strokeWidth = 1.6, style, className }: IconProps) {
  const path = (ICN as Record<string, string>)[name as string] || '';
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}
