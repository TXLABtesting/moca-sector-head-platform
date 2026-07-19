import type { FinModel } from '../../data/types';

/** Selectable years for the financial summary: a sensible base range ∪ any year
 *  that already has a summary, newest first. */
export function financeYears(models: FinModel[]): string[] {
  const ys = new Set<string>(['2025', '2026', '2027']);
  models.forEach((m) => { if (m.year) ys.add(m.year); });
  return [...ys].sort().reverse();
}

/** The summary for a given year, if one exists. */
export function finForYear(models: FinModel[], year: string): FinModel | undefined {
  return models.find((m) => m.year === year);
}

/** The newest year that already has a summary — a sensible default to land on. */
export function defaultFinYear(models: FinModel[]): string {
  const ys = models.map((m) => m.year).filter(Boolean).sort();
  return ys.length ? ys[ys.length - 1] : '2026';
}
