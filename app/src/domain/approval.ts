/* Single source of truth for the chair-approval workflow.
 *
 * The platform historically grew two parallel approval vocabularies — a document
 * "review inbox" (بانتظار مراجعة رئيس القطاع → معتمد / أعيد للتعديل) and domain
 * approvals on projects/leaves/meetings (بانتظار الاعتماد → …). This module unifies
 * them: one canonical pending/approved/returned label, one tone (colour) map, and
 * matcher helpers that tolerate every legacy string still sitting in seed/persisted
 * data so nothing has to be migrated destructively. */

export const WF = {
  pending: 'بانتظار اعتماد رئيس القطاع',
  approved: 'معتمد',
  returned: 'أعيد للتعديل',
  draft: 'مسودة',
} as const;

/** Every legacy/domain string that means "awaiting the chair's decision". */
const PENDING_ALIASES = new Set<string>([
  WF.pending,
  'بانتظار مراجعة رئيس القطاع',
  'بانتظار الاعتماد',
  'بانتظار اعتماد',
  'بانتظار اعتماد رئيس القطاع',
  'مرسل للمراجعة',
]);
const APPROVED_ALIASES = new Set<string>([WF.approved, 'معتمدة']);
const RETURNED_ALIASES = new Set<string>([WF.returned, 'مُعاد للتعديل']);

export const isPending = (s?: string): boolean => !!s && PENDING_ALIASES.has(s.trim());
export const isApproved = (s?: string): boolean => !!s && APPROVED_ALIASES.has(s.trim());
export const isReturned = (s?: string): boolean => !!s && RETURNED_ALIASES.has(s.trim());
export const isDraft = (s?: string): boolean => !!s && s.trim() === WF.draft;

/** Canonical display label for any workflow status (maps every pending alias to the
 *  unified wording; leaves domain lifecycle statuses like قيد التنفيذ untouched). */
export function wfLabel(s?: string): string {
  if (!s) return '';
  const t = s.trim();
  if (isPending(t)) return WF.pending;
  if (t === 'معتمدة') return 'معتمدة'; // leaves keep the feminine form
  return t;
}

/** One tone map [bg, fg] for every workflow / domain status, replacing the copies
 *  previously duplicated across the report-center workspaces and permissions. */
const GOLD: [string, string] = ['#fbf2df', '#a9791f'];
const GREEN: [string, string] = ['#e2f0e8', '#2e7d55'];
const RED: [string, string] = ['#f7e6e4', '#b0433b'];
const BLUE: [string, string] = ['#e3edf6', '#2f6aa8'];
const GREY: [string, string] = ['#eceeeb', '#6d7973'];

const TONES: Record<string, [string, string]> = {
  // unified review vocabulary
  [WF.pending]: GOLD,
  [WF.approved]: GREEN,
  [WF.returned]: RED,
  [WF.draft]: GREY,
  'معتمدة': GREEN,
  'محدّث': GREEN,
  // legacy pending aliases (still present in seed / persisted data)
  'بانتظار مراجعة رئيس القطاع': GOLD,
  'بانتظار الاعتماد': GOLD,
  'بانتظار اعتماد': GOLD,
  'مرسل للمراجعة': GOLD,
  'قيد التحديث': BLUE,
  'قيد المراجعة': GOLD,
  'قيد المتابعة': GOLD,
  // domain lifecycle
  'لم يبدأ': GREY,
  'قيد التنفيذ': BLUE,
  'متأخر': RED,
  'مكتمل': GREEN,
  'يحتاج قرار': GOLD,
  'مرفوض': RED,
  'ملغي': GREY,
  'ملغاة': GREY,
};

export function wfTone(s?: string): [string, string] {
  if (!s) return GREY;
  return TONES[s.trim()] || GREY;
}
