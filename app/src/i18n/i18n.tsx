import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { DICT, UITEXT } from '../shared/dict';
import { MON } from '../shared/constants';

export type Lang = 'ar' | 'en';

interface I18nCtx {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  /** UITEXT key → localized label (falls back to the key). */
  t: (key: string) => string;
  /** DICT lookup: Arabic source → English when lang==='en'. */
  tr: (s: string | undefined | null) => string;
  /** Localize an Arabic date string (month names + "اليوم"). */
  dl: (d: string | undefined | null) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

const LANG_KEY = 'moca.lang';

function readLang(): Lang {
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'ar' || v === 'en') return v; } catch { /* ignore */ }
  return 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const toggleLang = useCallback(() => setLang(lang === 'ar' ? 'en' : 'ar'), [lang, setLang]);

  const t = useCallback((key: string) => {
    const entry = UITEXT[key];
    if (!entry) return key;
    return lang === 'ar' ? entry[0] : entry[1];
  }, [lang]);

  const tr = useCallback((s: string | undefined | null) => {
    if (lang === 'ar' || s == null || typeof s !== 'string') return (s ?? '') as string;
    return DICT[s] !== undefined ? DICT[s] : s;
  }, [lang]);

  const dl = useCallback((d: string | undefined | null) => {
    if (lang === 'ar' || !d) return (d ?? '') as string;
    let r = String(d);
    for (const k in MON) r = r.split(k).join((MON as Record<string, string>)[k]);
    return r.split('اليوم').join('Today');
  }, [lang]);

  const value = useMemo<I18nCtx>(() => ({
    lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang, toggleLang, t, tr, dl,
  }), [lang, setLang, toggleLang, t, tr, dl]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n must be used within I18nProvider');
  return c;
}
