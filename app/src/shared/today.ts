/* The prototype's single frozen "today".
 *
 * Everything that needs the current date — overdue/upcoming checks, the Gantt
 * "today" line, date-key comparisons, change-log stamps — reads from here so the
 * whole platform agrees on one day. (Previously each module hard-coded its own,
 * ranging from 2 to 15 July, which made overdue/active states disagree.) */

/** Canonical "today" as a Date (month is 0-indexed → 6 = July). */
export const APP_TODAY = new Date(2026, 6, 6); // 6 July 2026

/** Same day, Arabic long form (e.g. for change-log entries and labels). */
export const APP_TODAY_AR = '6 يوليو 2026';

/** Same day, ISO date key 'YYYY-MM-DD' (for string date comparisons). */
export const APP_TODAY_KEY = '2026-07-06';

/** Today shifted by `days` (negative = past), as a new Date. */
export function todayPlus(days: number): Date {
  const d = new Date(APP_TODAY);
  d.setDate(d.getDate() + days);
  return d;
}
