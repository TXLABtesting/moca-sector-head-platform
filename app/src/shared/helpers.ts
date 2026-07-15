/* Pure helpers ported from dc-shared.js. */
import { AR_MONTHS, AR_MON_IDX, MONN, MIMG } from './constants';

export function pad2(n: number): string { return (n < 10 ? '0' : '') + n; }

export function initials(n: string): string {
  const p = String(n || '').trim().split(/\s+/);
  return (p[0] || '').slice(0, 1) + ((p[1] || '').slice(0, 1));
}

/** Ensure a prototype asset path (e.g. "assets/team/x.jpg") is served from /assets. */
export function asset(path: string): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('/')) return path;
  return '/' + path;
}

export function memberImg(name: string): string {
  const m = (MIMG as Record<string, string>)[name];
  return m ? asset(m) : '';
}

export function arPlural(n: number, f: { one: string; two: string; few: string; many: string }): string {
  n = +n;
  if (n === 0) return 'لا ' + f.many;
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const t = n % 100;
  if (t >= 3 && t <= 10) return n + ' ' + f.few;
  return n + ' ' + f.many;
}

/** Parse "5 يوليو 2026" → Date (local). */
export function parseAr(s: string): Date | null {
  if (!s) return null;
  const m = String(s).trim().split(/\s+/);
  if (m.length < 3) return null;
  const d = parseInt(m[0], 10);
  const mo = (AR_MON_IDX as Record<string, number>)[m[1]];
  const y = parseInt(m[2], 10);
  if (isNaN(d) || mo == null || isNaN(y)) return null;
  return new Date(y, mo, d);
}

export interface ProposedParts {
  y: number; m: number; d: number; h: number; min: number;
  endH: number; endMin: number; hasEnd: boolean; key: string;
}

/** Parse "6 يوليو 2026 - 10:00 ص" (optionally with end time). */
export function parseProposed(s: string): ProposedParts | null {
  const str = String(s || '');
  const mm = str.match(/(\d+)\s+(\S+)\s+(\d{4})\s*-\s*(\d+):(\d+)\s*(ص|م)/);
  if (!mm) return null;
  let h = +mm[4];
  const min = +mm[5];
  if (mm[6] === 'م' && h < 12) h += 12;
  if (mm[6] === 'ص' && h === 12) h = 0;
  const mon = (AR_MONTHS as readonly string[]).indexOf(mm[2]);
  const rest = str.slice((mm.index || 0) + mm[0].length);
  const em = rest.match(/(\d+):(\d+)\s*(ص|م)/);
  let eh: number, emin: number, hasEnd = false;
  if (em) {
    hasEnd = true; eh = +em[1]; emin = +em[2];
    if (em[3] === 'م' && eh < 12) eh += 12;
    if (em[3] === 'ص' && eh === 12) eh = 0;
  } else { eh = h + 1; emin = min; }
  return { y: +mm[3], m: mon, d: +mm[1], h, min, endH: eh, endMin: emin, hasEnd,
    key: (+mm[3]) + '-' + String(mon + 1).padStart(2, '0') + '-' + String(+mm[1]).padStart(2, '0') };
}

export function ymdKey(dt: Date): string {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

export function timeLabel(h: number, min: number): string {
  const ap = h < 12 ? 'ص' : 'م';
  let hh = h % 12; if (hh === 0) hh = 12;
  return hh + ':' + String(min).padStart(2, '0') + ' ' + ap;
}

export function timeRange(p: ProposedParts | null): string {
  if (!p) return '';
  return timeLabel(p.h, p.min) + ' – ' + timeLabel(p.endH, p.endMin);
}

export interface OutlookMeeting {
  proposed?: string; newDate?: string; newTime?: string;
  subject?: string; attendees?: string; basis?: string;
}

export function outlookUrl(m: OutlookMeeting): string {
  let date = m.proposed || '', time = '';
  if (m.newDate) { date = m.newDate; time = m.newTime || ''; }
  const dm = String(date).match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  const tm = String(time || m.proposed || '').match(/(\d{1,2}):(\d{2})\s*(ص|م|AM|PM)?/);
  let start = '', end = '';
  if (dm) {
    const day = +dm[1], mm = (MONN as Record<string, number>)[dm[2]] || 1, yr = +dm[3];
    let hh = 9, mi = 0;
    if (tm) {
      hh = +tm[1]; mi = +tm[2]; const ap = tm[3];
      if ((ap === 'م' || ap === 'PM') && hh < 12) hh += 12;
      if ((ap === 'ص' || ap === 'AM') && hh === 12) hh = 0;
    }
    start = yr + '-' + pad2(mm) + '-' + pad2(day) + 'T' + pad2(hh) + ':' + pad2(mi) + ':00';
    end = yr + '-' + pad2(mm) + '-' + pad2(day) + 'T' + pad2((hh + 1) % 24) + ':' + pad2(mi) + ':00';
  }
  let u = 'https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent';
  u += '&subject=' + encodeURIComponent(m.subject || '');
  if (start) u += '&startdt=' + encodeURIComponent(start);
  if (end) u += '&enddt=' + encodeURIComponent(end);
  u += '&body=' + encodeURIComponent('الحضور: ' + (m.attendees || '') + '\nالطلب بناءً على: ' + (m.basis || ''));
  return u;
}

/** Colour pair lookup with a neutral fallback. */
export function pair(map: Record<string, readonly string[]>, key: string, fallback: readonly string[] = ['#eceeeb', '#6d7973']): readonly string[] {
  return map[key] || fallback;
}
