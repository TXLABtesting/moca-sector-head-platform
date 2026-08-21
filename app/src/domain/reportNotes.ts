import type { AppData, ChairNote } from '../data/types';
import type { SeedUser } from './permissions';
import type { Page } from '../store/nav';

/**
 * Sector Head report notes route to the officer responsible for each report,
 * so a note surfaces in that officer's notifications and home directives.
 */
export const REPORT_NOTE_META: Record<string, { owners: string[]; ar: string; en: string; page: Page }> = {
  finance: { owners: ['hagar'], ar: 'الملخص التنفيذي المالي', en: 'Financial Executive Summary', page: 'finDetail' },
  reportLog: { owners: ['hagar'], ar: 'سجل التقارير', en: 'Reports Register', page: 'reglog' },
  audit: { owners: ['hasan'], ar: 'تقرير المتابعة - مكتب التدقيق', en: 'Audit Follow-up Report', page: 'auditDetail' },
  retention: { owners: ['hasan'], ar: 'تقرير الدفعات المستبقاة', en: 'Retention Payments Report', page: 'reportDetail' },
};

export interface ReportNoteHit { key: string; idx: number; note: ChairNote; ar: string; en: string; page: Page }

/** All Sector Head report notes addressed to this user (by report ownership). */
export function chairNotesForUser(data: AppData, cu: SeedUser): ReportNoteHit[] {
  const out: ReportNoteHit[] = [];
  const rn = data.reportNotes || {};
  for (const [key, meta] of Object.entries(REPORT_NOTE_META)) {
    if (!meta.owners.includes(cu.id)) continue;
    (rn[key] || []).forEach((note, idx) => out.push({ key, idx, note, ar: meta.ar, en: meta.en, page: meta.page }));
  }
  return out;
}
