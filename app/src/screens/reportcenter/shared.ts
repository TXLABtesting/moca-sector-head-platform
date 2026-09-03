/* Shared constants/helpers for the Report Center screens.
   Ported from ReportCenter.dc.html; every var(--cXXXXXX,#hex) replaced by #hex. */
import { useStore } from '../../store/store';
import { AV } from '../../shared/constants';

export type Pair = [string, string];

/** importance (الأهمية) → [bg,fg] */
export const impMap: Record<string, Pair> = {
  'عالية': ['#f7e6e4', '#b0433b'],
  'متوسطة': ['#fbf0d6', '#a9791f'],
  'منخفضة': ['#e2f0e8', '#2e7d55'],
};

/** audit status → [bg,fg] */
export const AUS: Record<string, Pair> = {
  'مغلق': ['#e2f0e8', '#2e7d55'],
  'قيد التنفيذ': ['#fbf0d6', '#a9791f'],
  'مستمر': ['#e6eef6', '#3a6ea5'],
  'متأخر': ['#f7e6e4', '#b0433b'],
};

/** register status → [bg,fg] */
export const REGST: Record<string, Pair> = {
  // current report-log vocabulary
  'غير مطلوب': ['#f0f2ee', '#8a8078'],
  'لم يستلم': ['#f7e6e4', '#b0433b'],
  'قيد الاعتماد': ['#fbf0d6', '#a9791f'],
  'مستلم - في الموعد': ['#e2f0e8', '#2e7d55'],
  'مستلم - متأخر': ['#fbf0d6', '#a9791f'],
  'مستلم - متأخر جدا': ['#f7e6e4', '#b0433b'],
  // legacy values kept so older records still render
  'معتمد': ['#e2f0e8', '#2e7d55'],
  'تم التسليم': ['#e0f0ea', '#1f8a5b'],
  'بانتظار الاعتماد': ['#fbf0d6', '#a9791f'],
  'قيد المراجعة': ['#e6eef6', '#3a6ea5'],
  'مدمج': ['#efeaf4', '#7a4d94'],
  'متأخر': ['#f7e6e4', '#b0433b'],
  '—': ['#f4f6f2', '#b8bfb6'],
};

export const entColors: Record<string, string> = {
  MOCA: '#1f8a5b', PMO: '#3a6ea5', FCSC: '#a9791f', GSOC: '#7a4d94',
  GEEO: '#c26a2b', GMO: '#2b8a8a', SPO: '#8a8078', AIO: '#b0433b', GDFO: '#5b6b62',
};

export const agingColors = ['#2e7d55', '#a9791f', '#c26a2b', '#b0433b', '#9a2f2a', '#6b1f1c'];

export const agingRisk: Record<string, Pair> = {
  'منخفض': ['#e2f0e8', '#2e7d55'],
  'متوسط': ['#fbf0d6', '#a9791f'],
  'مرتفع': ['#f7e6e4', '#b0433b'],
  'حرج': ['#f3dcd9', '#6b1f1c'],
};

/** Colour pair for a member by index in the members list (prototype's this.av). */
export function useAv(): (name: string) => Pair {
  const members = useStore((s) => s.data.members);
  return (name: string) => {
    const i = members.findIndex((m) => m.name === name);
    return AV[(i >= 0 ? i : 0) % AV.length] as unknown as Pair;
  };
}

/** Split an Arabic sentence into "1. …" / "،"-separated bullet lines (prototype audBullets). */
export function audBullets(s: string | undefined | null): string[] {
  s = String(s || '').trim();
  if (!s) return ['—'];
  let parts = /[0-9]\s*[.\-]/.test(s) ? s.split(/\s*[0-9]+\s*[.\-]\s*/) : s.split(/،\s*/);
  parts = parts.map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [s];
}

/** Format a number with en-US thousands separators (prototype fmt). */
export function fmt(n: number): string {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString('en-US');
  return (neg ? '-' : '') + s;
}

export const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0);
