/* Team workflow seed data (ported from the main component: _MITEMS/_MDIR/_MRECENT).
   These drive the office-team member workspaces and the chair review loop. */

export interface WorkItem {
  id: string;
  owner: string;      // member id (moza/samah/...)
  section: string;    // section key
  title: string;
  status: string;     // workflow status
  date: string;
  reason?: string;    // returned-for-edit reason
  directive?: string; // Sector-Head directive on this submission
}

export interface DirectiveMsg { text: string; date: string }
export interface RecentMsg { text: string; date: string }

/* Documents are produced by members and only viewed by the Sector Head — there
 * is no document submission/approval queue. Approvals live on the domain objects
 * that need them (projects, leaves), so this ad-hoc queue is intentionally empty. */
export const WORK_ITEMS: WorkItem[] = [];

/* Blank demo: directives and recent-activity start empty and populate live as the
 * Sector Head issues directives and members add records during the walkthrough. */
export const MEMBER_DIRECTIVES: Record<string, DirectiveMsg[]> = {};

export const MEMBER_RECENT: Record<string, RecentMsg[]> = {};
