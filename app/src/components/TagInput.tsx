import { useState } from 'react';
import { useI18n } from '../i18n/i18n';

/** Free multi-value input: type a value and press Enter (or comma / newline) to
 *  add it as a removable chip. Several can be pasted at once (comma/newline
 *  separated). Known values are offered as suggestions but never enforced — any
 *  name outside the list is accepted. */
export function TagInput({ values, onChange, suggestions = [], placeholder, listId }: {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  listId?: string;
}) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [text, setText] = useState('');
  const dl = listId || 'taginput-' + Math.abs(hashStr(suggestions.join('|'))).toString(36);

  const add = (raw: string) => {
    const parts = String(raw).split(/[،,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    parts.forEach((n) => { if (!next.includes(n)) next.push(n); });
    onChange(next);
    setText('');
  };

  const inputStyle: React.CSSProperties = { flex: 1, minWidth: 140, boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17211c', outline: 'none' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } }}
          list={suggestions.length ? dl : undefined}
          placeholder={placeholder || rl('اكتب اسمًا ثم اضغط Enter…', 'Type a name then press Enter…')}
          style={inputStyle}
        />
        {suggestions.length > 0 && (
          <datalist id={dl}>
            {suggestions.filter((n) => !values.includes(n)).map((n) => <option key={n} value={n} />)}
          </datalist>
        )}
        <button type="button" onClick={() => add(text)} disabled={!text.trim()}
          style={{ flex: 'none', background: text.trim() ? '#1e4634' : '#e2e6df', color: '#fff', border: 'none', borderRadius: 10, padding: '0 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: text.trim() ? 'pointer' : 'default' }}>
          {rl('إضافة', 'Add')}
        </button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
          {values.map((n) => (
            <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e4634', background: '#eef5f0', color: '#1e4634', borderRadius: 20, padding: '4px 10px', fontSize: 11.5, fontWeight: 700 }}>
              {tr(n)}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== n))}
                style={{ border: 'none', background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
