/* Demo seed — starts EMPTY on purpose.
 *
 * The hosted demo begins with no operational content: every member signs in to
 * their own portal and fills their own sections, and the chair then signs in to
 * review everyone's real inputs. Only the org structure is pre-loaded — the
 * people (members + sector managers) so logins map to real names and roles.
 * All content collections (projects, meetings, finance, correspondence,
 * committees, tasks, reports, leaves, …) are intentionally blank.
 *
 * The production (IT) build ignores this file entirely and loads data from the
 * API/Postgres. */
import type { AppData, FinModel } from './types';
import { seedData } from './seed';

/** People are kept so logins resolve to real names/roles; their derived
 *  counters start at zero because nothing has been entered yet. */
const members = seedData.members.map((m) => ({
  ...m,
  projects: 0,
  updates: 0,
  openTasks: 0,
  lateTasks: 0,
  last: '',
  lastDate: '',
  workStatus: '',
}));

/** A blank current-year finance model so the Finance workspace renders an empty
 *  (but valid) shape instead of crashing on an absent record. */
const blankFinModel: FinModel = {
  id: 'fin1',
  year: '2026',
  period: '',
  budget: 0,
  used: 0,
  remain: 0,
  commit: 0,
  commitPaid: 0,
  commitDue: 0,
  opex: { expected: 0, paid: 0, due: 0 },
  capex: { expected: 0, paid: 0, due: 0 },
  bigProjects: [],
  entities: [],
  related: [],
  relTotals: { allPeriods: 0, settling: 0, prior: 0, current: 0 },
  bankInterest: { dailyAccounts: 0, fixedDeposits: 0, activeDeposits: 0 },
  aging: [],
};

export const demoSeed: AppData = {
  members,
  sectorManagers: seedData.sectorManagers,
  leaves: [],
  // Sample leave entitlements so the balance feature is visible on the demo
  // without manual setup. In production these are entered by the responsible
  // person (default zero). Names match the department-manager picker.
  leaveBalances: [
    { id: 'lb-1', person: 'شيماء خماس', annual: 30, comp: 5 },
    { id: 'lb-2', person: 'علي عيسى', annual: 30, comp: 3 },
    { id: 'lb-3', person: 'محمد الياسي', annual: 28, comp: 0 },
  ],
  projects: [],
  meetings: [],
  actions: [],
  audit: [],
  auditReps: [],
  mtasks: [],
  correspondence: [],
  otasks: [],
  regReports: [],
  finModels: [blankFinModel],
  reqMeetings: [],
  committees: [],
  retReports: [],
  updateRequests: [],
};
