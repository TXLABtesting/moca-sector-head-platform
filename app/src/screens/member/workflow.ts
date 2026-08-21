/* Member-workspace workflow: the office team edits the SAME records the chair sees
   (window.__DATA equivalent = the store's data). Ported from the main component's mColl/mFindUnit.
   Records carry transient flags: _mrev (sent for review), _mret (returned reason),
   _mowner (submitter), _mapproved, _mlog (change log). */
import type { AppData } from '../../data/types';
import { SECTIONS, type SeedUser } from '../../domain/permissions';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MColl {
  key: keyof AppData;
  get: (d: AppData) => any[];
  title: (r: any) => string;
  status: (r: any) => string;
  setStatus: (r: any, s: string) => void;
  make: (f: any, me: string) => any;
  load: (r: any) => any;
}

const uid = (p: string) => p + Math.floor(Math.random() * 1e9);

const COLLS: Record<string, MColl> = {
  correspondence: {
    key: 'correspondence', get: (d) => d.correspondence, title: (r) => r.name, status: (r) => r.status, setStatus: (r, s) => { r.status = s; },
    make: (f, me) => ({ id: uid('c'), name: f.title, dir: f.dir || 'صادر', type: f.docType || 'رسالة', entity: f.entity || '—', sender: f.sender || '—', recipient: f.recipient || '—', date: f.fdate || '—', recvDate: f.fdate || '—', status: f.fstatus || 'قيد المتابعة', priority: 'متوسطة', followup: f.followup || me, needsAction: true, attachment: f.attachment || 'مرفق.pdf', action: f.note || '—', notes: f.note || '' }),
    load: (r) => ({ title: r.name, dir: r.dir, docType: r.type, entity: r.entity, sender: r.sender, recipient: r.recipient, fdate: r.date, fstatus: r.status, followup: r.followup, note: r.notes, attachment: r.attachment }),
  },
  projects: {
    key: 'projects', get: (d) => d.projects, title: (r) => r.name, status: (r) => r.status, setStatus: (r, s) => { r.status = s; },
    make: (f, me) => ({ id: uid('p'), no: '', name: f.title, owner: f.owner || me, status: f.fstatus || 'لم يبدأ', priority: f.priority || 'متوسطة', progress: +(f.progress || 0), stage: 'PLANNING', unit: f.entity || 'قطاع الخدمات المركزية', dueDate: f.due || '—', startDate: f.start || '', deadline: f.deadline || '', nextStep: f.next || '', risks: f.risks || 'لا يوجد', finalOutput: f.final || '', budget: +(f.budget || 0), desc: f.note || '', scope: [], timeline: [], tasks: [], attachments: [] }),
    load: (r) => ({ title: r.name, owner: r.owner, fstatus: r.status, priority: r.priority, progress: String(r.progress || ''), due: r.dueDate, start: r.startDate, deadline: r.deadline, next: r.nextStep, risks: r.risks, final: r.finalOutput, budget: String(r.budget || ''), entity: r.unit, note: r.desc }),
  },
  minutes: {
    key: 'meetings', get: (d) => d.meetings, title: (r) => r.title, status: (r) => r._mstatus || 'مسودة', setStatus: (r, s) => { r._mstatus = s; },
    make: (f, me) => ({ id: uid('mtg'), title: f.title, owner: me, date: f.fdate || '—', summary: f.note || '', status: f.fstatus || 'مسودة', _mstatus: f.fstatus || 'مسودة', attendees: [], keyPoints: [], decisions: [], actions: [] }),
    load: (r) => ({ title: r.title, fdate: r.date, note: r.summary, fstatus: r._mstatus }),
  },
  committees: {
    key: 'committees', get: (d) => d.committees, title: (r) => r.name, status: (r) => r._mstatus || '—', setStatus: (r, s) => { r._mstatus = s; },
    make: (f, me) => ({ id: uid('cm'), name: f.title, chair: 'رئيس القطاع', rapporteur: me, purpose: f.note || '', members: [], decisions: [], meetings: [], _mstatus: f.fstatus || 'مسودة' }),
    load: (r) => ({ title: r.name, note: r.purpose, fstatus: r._mstatus }),
  },
  leaves: {
    key: 'leaves', get: (d) => d.leaves, title: (r) => r.person, status: (r) => r.status, setStatus: (r, s) => { r.status = s === 'معتمد' ? 'معتمدة' : s; },
    make: (f) => ({ id: uid('lv'), person: f.title, cat: 'office', role: '', dept: f.entity || '', type: f.docType || 'سنوية', start: f.start || '—', end: f.due || '—', days: 0, status: f.fstatus || 'بانتظار الاعتماد', backup: f.backup || '—', notes: f.note || '' }),
    load: (r) => ({ title: r.person, entity: r.dept, docType: r.type, start: r.start, due: r.end, fstatus: r.status, backup: r.backup, note: r.notes }),
  },
  auditReps: {
    key: 'auditReps', get: (d) => d.auditReps || [], title: (r) => r.title, status: (r) => r.status, setStatus: (r, s) => { r.status = s; },
    make: (f, me) => ({ id: 'aur' + Math.floor(Math.random() * 1e9), title: f.title, unit: f.entity || 'إدارة الشؤون الإدارية', year: '2026', period: f.docType || '', freq: 'دوري', status: f.fstatus || 'مسودة', resp: f.respOwner || me, attachments: f.attachment ? [f.attachment] : [], notes: f.note || '', lastUpdate: 'الآن', updatedBy: me }),
    load: (r) => ({ title: r.title, entity: r.unit, docType: r.period, respOwner: r.resp, fstatus: r.status, note: r.notes }),
  },
  finReports: {
    key: 'finModels', get: (d) => d.finModels, title: (r) => 'الملخص التنفيذي المالي — ' + (r.year || r.period || ''), status: (r) => r._mstatus || 'محدّث', setStatus: (r, s) => { r._mstatus = s; },
    make: (f, me) => ({ id: 'fin' + Math.floor(Math.random() * 1e9), year: f.title || '', period: f.title || '', updatedBy: me, budget: 0, used: 0, remain: 0, commit: 0, commitPaid: 0, commitDue: 0, opex: { expected: 0, paid: 0 }, capex: { expected: 0, paid: 0 }, bigProjects: [], entities: [], related: [], relTotals: { allPeriods: 0, settling: 0, prior: 0, current: 0 }, aging: [] }),
    load: (r) => ({ title: r.period, fstatus: r._mstatus }),
  },
  reportLog: {
    key: 'regReports', get: (d) => d.regReports, title: (r) => r.title, status: (r) => r._mstatus || r.may || '—', setStatus: (r, s) => { r._mstatus = s; r.may = s; },
    make: (f, me) => ({ id: uid('rg'), n: '', title: f.title, dept: f.entity || '—', resp: f.respOwner || me, freq: f.docType || 'شهري', type: 'الأداء المالي', due: '7 من كل شهر', jan: '—', feb: '—', mar: '—', apr: '—', may: f.fstatus || 'قيد المراجعة', lastDate: '', approval: '', notes: '', _mstatus: f.fstatus || 'قيد المراجعة' }),
    load: (r) => ({ title: r.title, entity: r.dept, respOwner: r.resp, docType: r.freq, fstatus: r._mstatus || r.may }),
  },
  retention: {
    key: 'retReports', get: (d) => d.retReports || [], title: (r) => 'تقرير الدفعات المستبقاة — ' + r.quarter + ' ' + r.year, status: (r) => r.status, setStatus: (r, s) => { r.status = s; },
    make: (f, me) => ({ id: 'ret' + Math.floor(Math.random() * 1e9), year: '2026', quarter: f.title || 'الربع الثالث', date: f.fdate || '—', status: f.fstatus || 'مسودة', lastUpdate: 'الآن', updatedBy: me, execSummary: f.note ? [f.note] : [], strengths: [], weaknesses: [], improvements: [], recs: [], entities: [], cases: [], conclusion: '' }),
    load: (r) => ({ title: r.quarter, fdate: r.date, fstatus: r.status, note: (r.execSummary || [])[0] || '' }),
  },
  mtasks: {
    key: 'mtasks', get: (d) => d.mtasks, title: (r) => r.task, status: (r) => r._mstatus || r.status, setStatus: (r, s) => { r._mstatus = s; },
    make: (f, me) => ({ id: uid('mtk'), mDate: f.fdate || '—', meeting: f.entity || '—', dept: f.entity || '—', task: f.title, owner: f.respOwner || me, support: 'لا يوجد', prerequisite: 'لا يوجد', budget: 'لا يوجد', dependencies: 'لا يوجد', status: f.fstatus || 'لم يبدأ', due: f.due || '—', notes: f.note || '', directives: [], reviewed: false }),
    load: (r) => ({ title: r.task, entity: r.meeting, respOwner: r.owner, fdate: r.mDate, due: r.due, fstatus: r.status, note: r.notes }),
  },
  myTasks: {
    key: 'otasks', get: (d) => d.otasks, title: (r) => r.title, status: (r) => r.status, setStatus: (r, s) => { r.status = s; },
    make: (f, me) => ({ id: uid('ot'), title: f.title, owner: me, dept: f.entity || 'مكتب رئيس القطاع', start: f.start || '—', end: f.due || '—', label: f.label || 'مهمة', status: f.fstatus || 'قيد التنفيذ', desc: f.note || '', lastUpdate: '', due: '', notes: '', directives: [], attachments: [], reviewed: false }),
    load: (r) => ({ title: r.title, entity: r.dept, start: r.start, due: r.end, fstatus: r.status, note: r.desc }),
  },
};

const SEC2COLL: Record<string, string> = {
  finReports: 'finReports',
  correspondence: 'correspondence', projects: 'projects', projPhases: 'projects', projUpdates: 'projects', projRisks: 'projects',
  minutes: 'minutes', minuteTasks: 'mtasks', committees: 'committees', committeeDecisions: 'committees', leaves: 'leaves',
  auditReports: 'auditReps', reportLog: 'reportLog', myTasks: 'myTasks', reportCenter: 'retention',
};

export function mColl(sec: string): MColl | null {
  const key = SEC2COLL[sec];
  return key ? COLLS[key] : null;
}

/** Record a "request update" from the chair to an item's owner. Surfaced to
 *  that person as a real notification (see notifData). De-duplicates an
 *  identical pending request for the same item + owner. */
export function pushUpdateReq(d: AppData, req: { owner: string; title: string; section: string; note?: string; date?: string }): void {
  if (!req.owner || !req.title) return;
  const list = (d.updateRequests = d.updateRequests || []);
  if (list.some((u) => u.owner === req.owner && u.title === req.title)) return;
  list.unshift({ id: 'ur' + Math.floor(Math.random() * 1e9), owner: req.owner, title: req.title, section: req.section, note: req.note, date: req.date || 'الآن' });
}

/** Who "owns" a record, per collection (for مهامي counts). Keyed by AppData key. */
export const OWNER_OF: Record<string, (r: any) => string> = {
  correspondence: (r) => r.followup || '',
  actions: (r) => r.owner || '',
  projects: (r) => r.owner || '',
  meetings: (r) => r.owner || '',
  committees: (r) => r.rapporteur || '',
  leaves: (r) => r.person || '',
  audit: (r) => r.owner || '',
  regReports: (r) => r.resp || '',
  otasks: (r) => r.owner || '',
  mtasks: (r) => r.owner || '',
  retReports: (r) => r.updatedBy || '',
  auditReps: (r) => r.resp || r.updatedBy || '',
  finModels: () => 'هاجر هلول',
};

/** Match a record's owner string against the current member (tolerant of spelling
 *  variants in the real data, e.g. "أبو شرخ" vs "أبوشرخ"). */
export function ownedBy(ownerStr: string, name: string): boolean {
  if (!ownerStr) return false;
  if (ownerStr === name || ownerStr.includes(name)) return true;
  const first = name.split(/\s+/)[0];
  return first.length >= 3 && ownerStr.includes(first);
}

/** Statuses considered "closed" for the member's open-items counters.
 *  DONE_PENDING is deliberately NOT here — it is not final until the chair approves. */
export const FINAL_STATUSES = ['معتمد', 'معتمدة', 'مكتمل', 'ملغي', 'ملغاة', 'مغلق', 'مرفوض', 'مرفوضة', 'منتهية'];

/* ---- Completion-approval workflow ----
   Members/owners can only mark an item "مكتمل قيد الاعتماد" (completion pending
   approval). The final "مكتمل" is set exclusively by the chair from the unified
   "قيد مراجعة الاكتمال" screen. Both use the SAME record — no duplicates. */
export const DONE = 'مكتمل';
export const DONE_PENDING = 'مكتمل قيد الاعتماد';
// Closure variant (audit observations close rather than "complete").
export const CLOSED = 'مغلق';
export const CLOSED_PENDING = 'مغلق قيد الاعتماد';
/** All statuses that place an item in the chair's completion-review queue. */
export const PENDING_STATUSES = [DONE_PENDING, CLOSED_PENDING];
/** Map a pending status to the final status the chair applies on approval. */
export const finalOf = (pending: string) => (pending === CLOSED_PENDING ? CLOSED : DONE);

/** Sections whose records can enter completion review (one per distinct collection). */
export const COMPLETION_SECTIONS = ['myTasks', 'minuteTasks', 'committees', 'projects', 'auditReports', 'reportLog', 'reportCenter', 'finReports', 'correspondence', 'minutes'];

/** Pseudo-collection for audit observations (nested in data.audit, not a top-level MColl). */
const OBS_COLL: MColl = {
  key: 'audit', get: (d) => d.audit || [], title: (r) => r.obs || r.area || r.num || '—', status: (r) => r.status, setStatus: (r, s) => { r.status = s; },
  make: (f) => f, load: (r) => r,
};

/** Status options for a picker: members/owners see "مكتمل قيد الاعتماد" instead of
 *  the final "مكتمل" (chair-only). Chair keeps the final "مكتمل" and also sees the
 *  pending state. Preserves order and any already-set value. */
export function completionOptions(list: string[], isChair: boolean): string[] {
  if (isChair) return list;
  return list.map((s) => (s === DONE ? DONE_PENDING : s === CLOSED ? CLOSED_PENDING : s));
}

/** The status an owner action should apply when "marking done" (pending for members). */
export const markDoneStatus = (isChair: boolean) => (isChair ? DONE : DONE_PENDING);

/** Every record across all collections currently awaiting completion approval. */
export function pendingCompletionItems(data: AppData): { sec: string; coll: MColl; r: any }[] {
  const out: { sec: string; coll: MColl; r: any }[] = [];
  COMPLETION_SECTIONS.forEach((sec) => {
    const coll = mColl(sec); if (!coll) return;
    coll.get(data).forEach((r) => { if (PENDING_STATUSES.includes(coll.status(r))) out.push({ sec, coll, r }); });
  });
  // audit observations (nested in data.audit) that owners flagged closed-pending
  (data.audit || []).forEach((r) => { if (PENDING_STATUSES.includes(r.status)) out.push({ sec: 'auditReports', coll: OBS_COLL, r }); });
  return out;
}

const SEC_KIND: Record<string, string> = {
  correspondence: 'correspondence', projects: 'project', projPhases: 'project', projUpdates: 'project', projRisks: 'project',
  finReports: 'finance', reportLog: 'finance', auditReports: 'audit', recommendations: 'recommendation', minutes: 'minutes', minuteTasks: 'minutes',
  committees: 'committee', committeeDecisions: 'committee', leaves: 'leave', myTasks: 'task',
};
export const sectionFormKind = (sec: string) => SEC_KIND[sec] || 'generic';

export function memberDefaultSection(userId: string): string {
  const M: Record<string, string> = { fatma: 'projUpdates', saif: 'projUpdates', hagar: 'finReports', hasan: 'auditReports', samah: 'minutes', moza: 'correspondence' };
  return M[userId] || 'projects';
}

/** Sections this member can add to or edit (excludes non-editable/system sections). */
export function editableSections(cu: SeedUser): string[] {
  const skip: Record<string, number> = { dashboard: 1, assistant: 1, permissions: 1 };
  return SECTIONS.filter((s) => {
    if (skip[s.k]) return false;
    const letters = cu.g?.[s.k] || (cu.type === 'chair' ? 'ae' : '');
    return letters.includes('a') || letters.includes('e');
  }).map((s) => s.k);
}

/** De-duplicate editable sections that share the same underlying collection. */
export function editableCollections(cu: SeedUser): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  editableSections(cu).forEach((sec) => {
    const c = mColl(sec); const ck = c ? c.key : ('m:' + sec);
    if (seen.has(ck)) return; seen.add(ck); out.push(sec);
  });
  return out;
}
