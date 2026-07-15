import type { CSSProperties } from 'react';
import { parseAr, pad2 } from '../shared/helpers';
import { AR_MONTHS } from '../shared/constants';

/** Native date picker over the platform's Arabic date strings ("30 سبتمبر 2026").
 *  Shows empty for unparseable values (e.g. "مستمر") and only overwrites on change,
 *  so untouched legacy values are preserved. Clearing the picker stores ''. */
export function DateField({ value, onChange, style }: {
  value: string;
  onChange: (arabicDate: string) => void;
  style?: CSSProperties;
}) {
  const d = parseAr(value || '');
  const iso = d ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) : '';
  return (
    <input
      type="date"
      value={iso}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) { onChange(''); return; }
        const [y, m, day] = v.split('-').map(Number);
        if (!y || !m || !day) { onChange(''); return; }
        onChange(day + ' ' + (AR_MONTHS as readonly string[])[m - 1] + ' ' + y);
      }}
      style={{
        width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6',
        borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none',
        ...style,
      }}
    />
  );
}
