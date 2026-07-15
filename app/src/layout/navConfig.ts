import type { Page } from '../store/nav';

/** page -> the parent nav key it highlights (from the prototype's detailMap). */
export const ACTIVE_MAP: Partial<Record<Page, Page>> = {
  projectDetail: 'projects',
  meetingDetail: 'meetings',
  docDetail: 'correspondence',
  reportDetail: 'reportcenter',
  auditDetail: 'reportcenter',
  finDetail: 'reportcenter',
  reglog: 'reportcenter',
  mtasks: 'meetings',
};

/** nav key -> permission section (navSection in the prototype). */
export const NAV_SECTION: Record<string, string | undefined> = {
  dashboard: 'dashboard',
  reqmeetings: 'meetings',
  meetings: 'minutes',
  meetingDetail: 'minutes',
  mtasks: 'minuteTasks',
  projects: 'projects',
  projectDetail: 'projects',
  correspondence: 'correspondence',
  docDetail: 'correspondence',
  reportcenter: 'reportCenter',
  reportDetail: 'reportCenter',
  auditDetail: 'auditReports',
  finDetail: 'finReports',
  reglog: 'reportLog',
  committees: 'committees',
  otasks: 'myTasks',
  leaves: 'leaves',
  settings: 'permissions',
  team: undefined,
  actions: undefined,
};

export const BADGE_STYLE = {
  marginInlineStart: 'auto', background: '#c9a24b', color: '#1e2e22',
  fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '2px 8px',
  minWidth: 20, textAlign: 'center' as const,
};

export const NAV_BASE = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
  borderRadius: 14, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
  color: '#9fb8a9', transition: 'all .15s', textDecoration: 'none',
} as const;

export const NAV_ON = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
  borderRadius: 14, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
  color: '#12291f', background: '#ffffff', boxShadow: '0 10px 24px -10px rgba(0,0,0,.5)',
  textDecoration: 'none',
} as const;
