/* Screen-local helpers for the meeting-minutes tasks (mtasks) screen.
   Ported from the prototype's <script> (MeetingMinutes.dc.html). */
import { AV, MON, MONN, AR_MONTHS } from '../../shared/constants';
import { pad2 } from '../../shared/helpers';
import type { Member } from '../../data/types';

/** Minute-task status colours [bg, fg] (distinct from PS/AS — قيد التنفيذ is amber here). */
export const MTS: Record<string, readonly [string, string]> = {
  'مكتمل': ['#e2f0e8', '#2e7d55'],
  'قيد التنفيذ': ['#fbf0d6', '#a9791f'],
  'لم يبدأ': ['#eceae6', '#8a8078'],
  'متأخر': ['#f7e6e4', '#b0433b'],
  'مستمر': ['#e6eef6', '#3a6ea5'],
};

/** Group-header status colours [bg, fg]. */
export const GS: Record<string, readonly [string, string]> = {
  'مكتمل': ['#e2f0e8', '#2e7d55'],
  'قيد التنفيذ': ['#fbf0d6', '#a9791f'],
  'متأخر': ['#f7e6e4', '#b0433b'],
};

export const MT_STATUSES = ['مكتمل', 'قيد التنفيذ', 'لم يبدأ', 'متأخر', 'مستمر'];

export function mtNeedsSupport(tk: { status: string }): boolean {
  return tk.status === 'لم يبدأ' || tk.status === 'متأخر';
}

/** Avatar colour pair for a member, by member index (matches prototype's av()). */
export function avForMember(members: Member[], name: string): readonly [string, string] {
  const i = members.findIndex((m) => m.name === name);
  return AV[(i >= 0 ? i : 0) % AV.length];
}

/** "9 يونيو 2026" → "2026-06" (or '' if unparseable). */
export function mtMonKey(d: string): string {
  const m = String(d || '').match(/(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/);
  return m ? (m[2] + '-' + pad2((MONN as Record<string, number>)[m[1]])) : '';
}

/** "2026-06" → "يونيو 2026" (ar) / "June 2026" (en). */
export function mtMonLabel(k: string, lang: 'ar' | 'en'): string {
  if (!k) return '';
  const p = k.split('-');
  const arMon = AR_MONTHS[(+p[1]) - 1];
  return lang === 'ar' ? (arMon + ' ' + p[0]) : ((MON as Record<string, string>)[arMon] + ' ' + p[0]);
}
