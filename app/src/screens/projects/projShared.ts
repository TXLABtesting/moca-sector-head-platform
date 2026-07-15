/* Shared pure helpers for the Projects screens (ported from Projects.dc.html).
   All var(--cXXXXXX,#hex) wrappers collapsed to their light-mode hex. */
import { PS, PR, ACCENT, PUNIT } from '../../shared/constants';
import { parseAr } from '../../shared/helpers';
import type { Project } from '../../data/types';

/** The prototype's anchored "today" (2 July 2026). */
export const APP_TODAY = new Date(2026, 6, 2);

export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthName(mi: number, en: boolean): string {
  const i = ((mi % 12) + 12) % 12;
  return en ? MONTHS_EN[i] : MONTHS_AR[i];
}

export function psColors(status: string): [string, string] {
  const c = (PS as Record<string, readonly string[]>)[status];
  return c ? [c[0], c[1]] : ['#eceeeb', '#6d7973'];
}

export function prColors(priority: string): [string, string, string] {
  const c = (PR as Record<string, readonly string[]>)[priority];
  return c ? [c[0], c[1], c[2]] : ['#eceeeb', '#6d7973', '#9aa39b'];
}

export function accentOf(status: string): string {
  return (ACCENT as Record<string, string>)[status] || '#9aa39b';
}

export function unitOf(id: string): string {
  return (PUNIT as Record<string, string>)[id] || '';
}

/** Red for near/overdue due dates (prototype's dueColor heuristic). */
export function dueColor(due?: string): string {
  const s = String(due || '');
  return (s.includes('يونيو') || s.includes('مارس') || s.includes('1 يوليو') || s.includes('2 يوليو'))
    ? '#b0433b' : '#3c4a42';
}

/** Earliest activity date → due date span for a project (used by the timeline). */
export function projRange(p: Project): { start: Date | null; end: Date | null } {
  const dts = (p.timeline || []).map((x) => parseAr(x.date)).filter(Boolean) as Date[];
  const end = parseAr(p.dueDate || '');
  let start = dts.length
    ? new Date(Math.min(...dts.map((d) => d.getTime())))
    : (end ? new Date(end.getFullYear(), end.getMonth(), 1) : null);
  if (end && start && start > end) start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
}
