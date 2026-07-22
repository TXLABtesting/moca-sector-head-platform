import { useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { backendEnabled, uploadFile } from '../demo/demoBackend';

/** Uploaded files are stored as the bucket's public URL; show a clean filename
 *  (strip the bucket path and the random `<hash>_` upload prefix). */
function displayName(s: string): string {
  if (!/^https?:\/\//.test(s)) return s;
  try {
    const last = decodeURIComponent(new URL(s).pathname.split('/').pop() || s);
    return last.replace(/^[a-z0-9]+_/i, '');
  } catch { return s; }
}

/** File-type chip colours by extension. */
function extStyle(name: string): { bg: string; fg: string; label: string } {
  const s = name.toLowerCase();
  if (/\.(xlsx?|csv)$/.test(s)) return { bg: '#e2f0e8', fg: '#2e7d55', label: 'Excel' };
  if (/\.pdf$/.test(s)) return { bg: '#f7e6e4', fg: '#b0433b', label: 'PDF' };
  if (/\.(docx?|rtf)$/.test(s)) return { bg: '#e6eef6', fg: '#3a6ea5', label: 'Word' };
  if (/\.(pptx?)$/.test(s)) return { bg: '#fdeee2', fg: '#c2622a', label: 'PowerPoint' };
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(s)) return { bg: '#f0eaf6', fg: '#7a4fa3', label: 'صورة' };
  return { bg: '#eef1ec', fg: '#5b6b62', label: 'ملف' };
}

/** Dedicated file-upload field: click or drag to pick real files, preview
 *  images, and remove any file before saving. The record stores file names
 *  (demo — no server); sizes/thumbnails live only for freshly picked files. */
export function FileUploadField({ files, onChange, multiple = true }: {
  files: string[];
  onChange: (files: string[]) => void;
  multiple?: boolean;
}) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const inputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<Record<string, { size: string; preview?: string }>>({});
  const [dragOver, setDragOver] = useState(false);

  const addFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const picked = Array.from(list);
    // Each stored token is the bucket's public URL when the shared demo backend
    // is on (durable, shareable), otherwise the plain file name (local demo).
    const tokens: string[] = [];
    for (const file of picked) {
      const size = file.size >= 1048576
        ? (file.size / 1048576).toFixed(1) + ' MB'
        : Math.max(1, Math.round(file.size / 1024)) + ' KB';
      let token = file.name;
      if (backendEnabled) {
        const url = await uploadFile(file);
        if (url) token = url;
      }
      tokens.push(token);
      if (file.type.startsWith('image/')) {
        const rd = new FileReader();
        rd.onload = () => setMeta((m) => ({ ...m, [token]: { size, preview: String(rd.result) } }));
        rd.readAsDataURL(file);
      } else {
        setMeta((m) => ({ ...m, [token]: { size } }));
      }
    }
    onChange(multiple ? [...files.filter((f) => !tokens.includes(f)), ...tokens] : [tokens[0]]);
  };

  return (
    <div>
      <input ref={inputRef} type="file" multiple={multiple} style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        style={{
          border: '1.5px dashed ' + (dragOver ? '#1f8a5b' : '#cdd3ca'), borderRadius: 11,
          padding: '16px 14px', textAlign: 'center', cursor: 'pointer', userSelect: 'none',
          background: dragOver ? '#eef7f1' : '#f9faf8', color: '#7d867f', fontSize: 12.5, transition: 'all .15s',
        }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#1f8a5b' : '#b0b8af'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 5 }}><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
        <div style={{ fontWeight: 600, color: dragOver ? '#1f8a5b' : '#5b6b62' }}>
          {rl('اضغط لاختيار ملف أو اسحبه إلى هنا', 'Click to choose a file or drag it here')}
        </div>
        <div style={{ fontSize: 10.5, marginTop: 3 }}>{multiple ? rl('يمكن إرفاق أكثر من ملف', 'Multiple files allowed') : rl('ملف واحد', 'Single file')}</div>
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {files.map((fn, i) => {
            const label = displayName(fn);
            const es = extStyle(label);
            const m = meta[fn];
            const isUrl = /^https?:\/\//.test(fn);
            return (
              <div key={fn + i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7f9f6', border: '1px solid #eef1ec', borderRadius: 10, padding: '7px 10px' }}>
                {m?.preview ? (
                  <img src={m.preview} alt="" style={{ width: 34, height: 34, flex: 'none', borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e6df' }} />
                ) : (
                  <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 8, background: es.bg, color: es.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isUrl ? (
                    <a href={fn} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#1f6fb0', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{label}</a>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2a332d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                  )}
                  <div style={{ fontSize: 10, color: '#9aa39b' }}>{m?.size ? m.size + ' · ' : ''}{tr(es.label)}</div>
                </div>
                <button type="button" onClick={() => onChange(files.filter((_, x) => x !== i))} title={rl('إزالة', 'Remove')}
                  style={{ flex: 'none', width: 24, height: 24, border: 'none', borderRadius: 7, background: 'transparent', color: '#b0433b', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
