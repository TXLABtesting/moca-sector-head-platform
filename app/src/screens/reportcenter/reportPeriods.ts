import type { RegReport } from '../../data/types';

/* Frequency-driven receipt tracking for the Reports Register.
   Each report tracks, per year, whether it was received in each period of its
   frequency: monthly → 12 months, quarterly → 4 quarters, semiannual → 2 halves,
   annual → 1, bi-weekly → 26 periods, weekly → 52. "On demand" has no fixed grid. */

/** The prototype's anchor year; legacy jan..may fields belong to it. */
export const LEGACY_YEAR = '2026';

/** Frequencies offered when creating/editing a register report (most → least frequent). */
export const REG_FREQS = ['أسبوعي', 'كل أسبوعين', 'شهري', 'ربع سنوي', 'نصف سنوي', 'سنوي', 'حسب الحاجة'];

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'];
const LEGACY_MONTH_KEYS: Record<string, keyof RegReport> = { m1: 'jan', m2: 'feb', m3: 'mar', m4: 'apr', m5: 'may' };

export interface RPeriod { key: string; label: string; short: string }

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** The list of periods a report of this frequency is tracked against, in order. */
export function periodsForFreq(freq: string): RPeriod[] {
  switch (freq) {
    case 'شهري':
      return MONTHS.map((m, i) => ({ key: 'm' + (i + 1), label: m, short: MONTHS_EN[i] }));
    case 'ربع سنوي':
      return range(4).map((q) => ({ key: 'q' + q, label: 'الربع ' + ORD[q], short: 'ر' + q }));
    case 'نصف سنوي':
      return range(2).map((h) => ({ key: 'h' + h, label: 'النصف ' + ORD[h], short: 'ن' + h }));
    case 'سنوي':
      return [{ key: 'y1', label: 'التقرير السنوي', short: 'سنة' }];
    case 'كل أسبوعين':
      return range(26).map((b) => ({ key: 'b' + b, label: 'الفترة ' + b, short: '' + b }));
    case 'أسبوعي':
      return range(52).map((w) => ({ key: 'w' + w, label: 'الأسبوع ' + w, short: '' + w }));
    default:
      return []; // حسب الحاجة — لا فترات ثابتة
  }
}

/** Receipt status of one period in a given year, falling back to legacy 2026 month fields. */
export function periodStatus(r: RegReport, year: string, key: string): string {
  const p = r.periods?.[year]?.[key];
  if (p != null && p !== '') return p;
  if (year === LEGACY_YEAR && LEGACY_MONTH_KEYS[key]) {
    const v = r[LEGACY_MONTH_KEYS[key]] as string | undefined;
    if (v) return v;
  }
  return '—';
}

/** The most recent meaningful status within a year — used as the "current status". */
export function currentStatus(r: RegReport, year: string): string {
  const ps = periodsForFreq(r.freq);
  for (let i = ps.length - 1; i >= 0; i--) {
    const s = periodStatus(r, year, ps[i].key);
    if (s && s !== '—') return s;
  }
  return '—';
}

/** Does the report have any recorded status in this year? */
export function hasYearData(r: RegReport, year: string): boolean {
  if (r.periods?.[year] && Object.values(r.periods[year]).some((v) => v && v !== '—')) return true;
  if (year === LEGACY_YEAR) return periodsForFreq(r.freq).some((p) => periodStatus(r, year, p.key) !== '—');
  return false;
}

/** Selectable years across the register: a sensible base range ∪ any year with data, newest first. */
export function registerYears(reports: RegReport[]): string[] {
  const ys = new Set<string>(['2025', '2026', '2027']);
  reports.forEach((r) => { ys.add(LEGACY_YEAR); Object.keys(r.periods || {}).forEach((y) => ys.add(y)); });
  return [...ys].sort().reverse();
}
