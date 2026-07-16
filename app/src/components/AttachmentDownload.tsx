import { useI18n } from '../i18n/i18n';
import { downloadNamedFile } from '../shared/fileGen';

/** Small download icon button placed next to any displayed attachment name. */
export function AttachmentDownload({ name, size = 26 }: { name: string; size?: number }) {
  const { lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  return (
    <button
      type="button"
      title={rl('تحميل المرفق', 'Download attachment')}
      onClick={(e) => { e.stopPropagation(); downloadNamedFile(name); }}
      style={{ flex: 'none', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9f0ec', border: '1px solid #cfe0d4', color: '#1e4634', borderRadius: 8, cursor: 'pointer' }}
    >
      <svg width={Math.round(size * 0.52)} height={Math.round(size * 0.52)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
    </button>
  );
}
