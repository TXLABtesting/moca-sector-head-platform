/* Domain types for the Sector Chief Follow-up Platform.
   Fields mirror the ported seed data (data.js). Kept permissive (many optional)
   because the seed is cast through `unknown`; these exist for editor DX. */

export interface Member {
  id: string;
  name: string;
  role: string;
  projects: number;
  updates: number;
  openTasks: number;
  lateTasks: number;
  last: string;
  lastDate: string;
  workStatus: string;
}

export interface SectorManager {
  id: string;
  name: string;
  role: string;
  dept: string;
}

export type LeaveCat = 'manager' | 'office';

export interface Leave {
  id: string;
  person: string;
  cat: LeaveCat;
  role: string;
  dept: string;
  type: string;
  start: string;
  end: string;
  days: number;
  status: string;
  backup: string;
  notes: string;
  chairNotes?: string;
  attachments?: string[];
}

export interface TimelineEntry {
  text: string;
  by: string;
  date: string;
}

export interface ProjectTask {
  name: string;
  owner: string;
  status: string;
}

export interface ProjectDirective {
  text: string;
  date: string;
}

export interface ExtendReq {
  from: string;
  to: string;
  by: string;
}

export interface Project {
  id: string;
  no: string;
  name: string;
  nameEn?: string;
  owner: string;
  status: string;
  progress: number;
  priority: string;
  stage: string;
  unit: string;
  budget: number;
  spent?: number;
  desc: string;
  finalOutput: string;
  scope: string[];
  nextStep: string;
  startDate?: string;
  dueDate?: string;
  deadline?: string;
  lastDate?: string;
  risks?: string;
  chairmanNotes?: string;
  // ── procurement / delivery details (visible to the Sector Head too) ──
  endUser?: string;        // المستخدم النهائي
  supplier?: string;       // اسم المورد
  poNumber?: string;       // رقم طلب الشراء / العقد / طلب التوريد
  dependencies?: string;   // الاعتماديات
  milestones?: string[];   // خطة المراحل الرئيسية (بند لكل سطر)
  people?: string[];
  attachments?: string[];
  timeline?: TimelineEntry[];
  tasks?: ProjectTask[];
  directives?: ProjectDirective[];
  extendReq?: ExtendReq;
  completionState?: string; // بانتظار الاعتماد / معتمد / مرفوض
}

export interface Named { name: string }

export interface MeetingAction {
  id: string;
  text: string;
  owner: string;
  due: string;
  status: string;
  participants?: string[];
  prog?: number;
  lastUpdate?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  owner: string;
  status: string;
  summary: string;
  attendees: Named[];
  absentees?: Named[];
  keyPoints: string[];
  decisions: string[];
  actions: MeetingAction[];
  attachment?: string;
  time?: string;
  location?: string;
  entity?: string;
  attachments?: string[];
  chairNotes?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  source: string;
  sourceType: string;
  owner: string;
  priority: string;
  due: string;
  status: string;
}

export interface AuditObsLog {
  at: string;       // update date/time
  by: string;       // updated by
  from?: string;    // previous status
  to?: string;      // new status
  note?: string;    // update note
}

export interface AuditArea {
  id: string;
  num: string;
  area: string;
  obs: string;
  action: string;
  owner: string;
  status: string;
  imp: string;
  due: string;
  updated: string;
  notes?: string;
  unit?: string;            // related organizational unit (defaults to the report's unit)
  rep?: string;             // parent follow-up/audit report id
  attachments?: string[];
  log?: AuditObsLog[];      // status-change log
}

/** A follow-up & audit report (container of AuditArea observations). */
export interface AuditRep {
  id: string;
  title: string;
  unit: string;
  year: string;
  period: string;
  freq: string;             // دوري | حسب الحاجة
  status: string;
  resp: string;
  attachments?: string[];
  notes?: string;
  lastUpdate?: string;
  updatedBy?: string;
}

export interface MinuteTask {
  id: string;
  meetingId?: string;   // links a task synced from a meeting's minutes
  mDate: string;
  meeting: string;
  dept: string;
  task: string;
  desc?: string;
  owner: string;
  participants?: string[];
  support: string;
  prerequisite: string;
  budget: string;
  dependencies: string;
  status: string;
  due: string;
  prog?: number;
  lastUpdate?: string;
  attachments?: string[];
  notes: string;
  directives: ProjectDirective[];
  reviewed: boolean;
}

export interface Correspondence {
  id: string;
  date: string;
  name: string;
  entity: string;
  type: string;
  sender: string;
  recipient: string;
  recvDate: string;
  status: string;
  dir: 'صادر' | 'وارد';
  priority: string;
  needsAction: boolean;
  action: string;
  followup: string;
  attachment?: string;
  notes: string;
  // Full outgoing/incoming register fields.
  concerned?: string;    // الشخص المعني لهذا المستند
  count?: string;        // العدد
  replyDate?: string;    // تاريخ رد المستند من المستلم
  deliveredTo?: string;  // تسليم للشخص المعني (تم / لم يُسلّم)
  deliverDate?: string;  // تاريخ التسليم للشخص المعني
  state?: string;        // الحالة (مفتوح / منجز / مغلق …)
}

export interface OfficeTask {
  id: string;
  start: string;
  end: string;
  label: string;
  attachments: string[];
  title: string;
  dept: string;
  owner: string;
  participants?: string[];
  status: string;
  desc: string;
  lastUpdate: string;
  due: string;
  notes: string;
  directives: ProjectDirective[];
  reviewed: boolean;
}

export interface RegReport {
  id: string;
  n: string;
  title: string;
  type: string;
  due: string;
  freq: string;
  resp: string;
  dept: string;
  attachments?: string[];
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  // Receipt status per year, keyed by frequency-based period (e.g. m1..m12, q1..q4, h1..h2, y1, b1..b26).
  // Falls back to the legacy jan..may fields for year 2026 when a period is absent.
  periods?: Record<string, Record<string, string>>;
  lastDate: string;
  approval: string;
  notes: string;
}

export interface FinFlow { expected: number; paid: number; due?: number }
export interface FinBigProject {
  name: string;
  entity?: string;
  alloc?: number;          // legacy
  paid?: number;           // legacy
  // ── current model (biggest projects by allocation) ──
  approvedBudget?: number; // الميزانية المعتمدة للعام الحالي
  allocations?: number;    // مخصصات الميزانية
  remaining?: number;      // الميزانية المتبقية
}
export interface FinEntity {
  code: string;
  name: string;
  alloc: number;
  used: number;
  commit: number;
  paid: number;
  due: number;
  opex: FinFlow;
  capex: FinFlow;
  projects: FinBigProject[];
  overdue: number;
  // ── current model (budget distribution by entity) ──
  govSupport?: number;     // الدعم الحكومي للعام
  totalAvailable?: number; // اجمالي الميزانية المتاحة
  allocations?: number;    // مخصصات الميزانية
  remaining?: number;      // الميزانية المتبقية
}
export interface RelatedItem { n: string; v: number }
/** A single line in a related-party breakdown section; v null = blank/unfilled. */
export interface RelatedRow { n: string; v: number | null }
/** A titled group of related-party lines (settlement / carried / current-year). */
export interface RelatedSection { title: string; rows: RelatedRow[] }
export interface RelatedParty {
  from: string;
  to: string;
  items: RelatedItem[];
  sections?: RelatedSection[]; // detailed three-part breakdown (optional)
}
export interface AgingItem {
  supplier: string;
  num: string;
  entity: string;
  contract: string;
  amount: number;
  status: string;
  notes: string;
}
export interface AgingBucket { bucket: string; risk: string; items: AgingItem[] }
export interface FinModel {
  id?: string;
  year: string;
  lastUpdate?: string;
  updatedBy?: string;
  period: string;
  budget: number;
  used: number;
  remain: number;
  commit: number;
  commitPaid: number;
  commitDue: number;
  opex: FinFlow;
  capex: FinFlow;
  bigProjects: FinBigProject[];
  entities: FinEntity[];
  related: RelatedParty[];
  relTotals: { allPeriods: number; settling: number; prior: number; current: number };
  bankInterest: { dailyAccounts: number; fixedDeposits: number; activeDeposits: number };
  aging: AgingBucket[];
}

export interface ReqMeeting {
  id: string;
  subject: string;
  attendees: string;
  basis: string;
  proposed: string;
  status: string;
  decision: string;
  notes: string;
  newDate?: string;
  newTime?: string;
  location?: string;
  link?: string;
  agenda?: string[];
}

export interface CommitteeDecision {
  num: string;
  year: string;
  kind: string;
  date?: string;
  img?: string;
}
export interface CommitteeTask {
  title: string;
  owner: string;
  status: string;
  due: string;
  prog?: number;
  needFollow?: boolean;
  needsFollow?: boolean;
  directive?: string;
  reviewed?: boolean;
}
export interface CommitteeMeeting {
  no: string;
  date: string;
  present: number;
  total: number;
  minutes: boolean;
  points: string;
  tasks: CommitteeTask[];
  absent?: string[];
  attachments?: string[];
}
export interface CommitteeScores {
  outputs: number;
  minutes: number;
  meetings: number;
  teamwork: number;
}
export interface Committee {
  id: string;
  name: string;
  chair: string;
  rapporteur: string;
  purpose: string;
  freq: string;
  reqMeetings: number;
  actualMeetings: number;
  created: string;
  reformed: string;
  status: string;
  cat: string;
  hasWorkPlan: boolean;
  absent: string[];
  scores: CommitteeScores;
  statement: string;
  weaknesses?: string[];
  improvements: string[];
  recommendation: string;
  members: string[];
  decisions: CommitteeDecision[];
  meetings: CommitteeMeeting[];
}

export interface RetRecommendation { note: string; rec: string; pri: string }
export interface RetEntityRow { entity: string; count: number; value: number; pct: string; ongoing: number; open: number; closed: number }
export interface RetCase { contract: string; value: number; reasons: string; status: string }
/** تقرير الدفعات المستبقاة — one report per year/quarter. */
export interface RetReport {
  id: string;
  year: string;
  quarter: string;
  date: string;
  status: string;
  lastUpdate: string;
  updatedBy: string;
  execSummary: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  recs: RetRecommendation[];
  entities: RetEntityRow[];
  cases: RetCase[];
  conclusion: string;
  attachments?: string[];
}

export interface AppData {
  members: Member[];
  sectorManagers: SectorManager[];
  leaves: Leave[];
  projects: Project[];
  meetings: Meeting[];
  actions: ActionItem[];
  audit: AuditArea[];
  auditReps: AuditRep[];
  mtasks: MinuteTask[];
  correspondence: Correspondence[];
  otasks: OfficeTask[];
  regReports: RegReport[];
  finModels: FinModel[];
  reqMeetings: ReqMeeting[];
  committees: Committee[];
  retReports: RetReport[];
  updateRequests?: UpdateRequest[];
}

/** A "request update" the chair sends to the owner of any item, surfaced to
 *  that person as a real notification. Decoupled from the many record types. */
export interface UpdateRequest {
  id: string;
  owner: string;   // owner display name (matched against the member's name)
  title: string;   // the item the update is requested on
  section: string; // section key (for the notification meta / deep-link)
  note?: string;
  date: string;
}
