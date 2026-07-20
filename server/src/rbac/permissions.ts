/**
 * RBAC model — the server-side source of truth, mirroring the frontend
 * permission model (app/src/domain/permissions.ts). The frontend enforces this
 * for UX; the API RE-enforces it authoritatively via RbacGuard so a crafted
 * request cannot bypass the UI.
 *
 * Grant letters: v=view a=add e=edit d=del m=attach s=status r=review n=note p=approve
 */

export type ActionKey =
  | 'view' | 'add' | 'edit' | 'del' | 'attach' | 'status' | 'review' | 'note' | 'approve';

export type UserType = 'chair' | 'office' | 'sector' | 'sysadmin';

export const ACTION_LETTER: Record<ActionKey, string> = {
  view: 'v', add: 'a', edit: 'e', del: 'd', attach: 'm', status: 's', review: 'r', note: 'n', approve: 'p',
};

const LETTER_TO_ACTION: Record<string, ActionKey> = Object.fromEntries(
  Object.entries(ACTION_LETTER).map(([k, v]) => [v, k as ActionKey]),
) as Record<string, ActionKey>;

/** Section keys used across the platform (must match the frontend). */
export const SECTIONS = [
  'dashboard', 'projects', 'projPhases', 'projUpdates', 'projRisks',
  'meetings', 'minutes', 'minuteTasks', 'committees', 'committeeDecisions',
  'correspondence', 'myTasks', 'reportCenter', 'reportLog', 'finReports',
  'auditReports', 'recommendations', 'leaves', 'assistant', 'permissions',
] as const;
export type SectionKey = (typeof SECTIONS)[number];

/** Access scopes — department-level data partitioning. */
export const SCOPES = ['all', 'office', 'admin_affairs', 'hr', 'digital', 'cx'] as const;
export type ScopeKey = (typeof SCOPES)[number];

/** The permission-bearing shape resolved for a signed-in principal. */
export interface Principal {
  /** Entra object id (oid) — the stable external identity. */
  oid: string;
  /** Local user id / display key. */
  id: string;
  name: string;
  type: UserType;
  scope: ScopeKey | string;
  /** true = full access (chair / super-grant). */
  all?: boolean;
  /** section -> grant letters, e.g. { projects: 'vaemsrn' }. */
  grants?: Record<string, string>;
}

/** Does this principal hold `action` on `section`? */
export function can(p: Principal, section: string, action: ActionKey): boolean {
  if (p.all || p.type === 'chair') return true;
  const letters = p.grants?.[section];
  if (!letters) return false;
  return letters.includes(ACTION_LETTER[action]);
}

/** May this principal see `section` at all (any view grant)? */
export function canSee(p: Principal, section: string): boolean {
  if (p.all || p.type === 'chair') return true;
  const letters = p.grants?.[section];
  return !!letters && letters.includes('v');
}

/** Expand grant letters into an action set (for /me responses). */
export function effectivePerms(p: Principal): Record<string, ActionKey[]> {
  const out: Record<string, ActionKey[]> = {};
  if (p.all || p.type === 'chair') {
    for (const s of SECTIONS) out[s] = Object.keys(ACTION_LETTER) as ActionKey[];
    return out;
  }
  for (const [sec, letters] of Object.entries(p.grants || {})) {
    out[sec] = [...letters].map((ch) => LETTER_TO_ACTION[ch]).filter(Boolean);
  }
  return out;
}

/**
 * Only the Sector Head (chair) approves operational items, and approvals are
 * limited to projects and leaves (+ meeting requests). Documents/reports are
 * view-only. This guards the approve action independent of section grants.
 */
export const APPROVABLE_SECTIONS: ReadonlySet<string> = new Set(['projects', 'leaves', 'reqmeetings']);

export function canApprove(p: Principal, section: string): boolean {
  return p.type === 'chair' && APPROVABLE_SECTIONS.has(section);
}
