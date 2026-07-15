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
}

export interface MinuteTask {
  id: string;
  mDate: string;
  meeting: string;
  dept: string;
  task: string;
  owner: string;
  support: string;
  prerequisite: string;
  budget: string;
  dependencies: string;
  status: string;
  due: string;
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
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  lastDate: string;
  approval: string;
  notes: string;
}

export interface FinFlow { expected: number; paid: number; due?: number }
export interface FinBigProject { name: string; entity?: string; alloc: number; paid: number }
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
}
export interface RelatedItem { n: string; v: number }
export interface RelatedParty { from: string; to: string; items: RelatedItem[] }
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
  needFollow?: boolean;
  needsFollow?: boolean;
}
export interface CommitteeMeeting {
  no: string;
  date: string;
  present: number;
  total: number;
  minutes: boolean;
  points: string;
  tasks: CommitteeTask[];
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
  improvements: string[];
  recommendation: string;
  members: string[];
  decisions: CommitteeDecision[];
  meetings: CommitteeMeeting[];
}

export interface AppData {
  members: Member[];
  sectorManagers: SectorManager[];
  leaves: Leave[];
  projects: Project[];
  meetings: Meeting[];
  actions: ActionItem[];
  audit: AuditArea[];
  mtasks: MinuteTask[];
  correspondence: Correspondence[];
  otasks: OfficeTask[];
  regReports: RegReport[];
  finModel: FinModel;
  reqMeetings: ReqMeeting[];
  committees: Committee[];
}
