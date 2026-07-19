/* Per-person permission model, ported from the main component
   (_ACTIONS/_SECTIONS/_TYPES/_SCOPES/_SEED/_WFS/_SECPAGE).
   Grant letters: v=view a=add e=edit d=del m=attach s=status r=review n=note p=approve */

export type ActionKey = 'view' | 'add' | 'edit' | 'del' | 'attach' | 'status' | 'review' | 'note' | 'approve';
export type UserType = 'chair' | 'office' | 'sector' | 'sysadmin';

export const ACTIONS: { k: ActionKey; letter: string; ar: string; en: string }[] = [
  { k: 'view', letter: 'v', ar: 'عرض', en: 'View' },
  { k: 'add', letter: 'a', ar: 'إضافة', en: 'Add' },
  { k: 'edit', letter: 'e', ar: 'تعديل', en: 'Edit' },
  { k: 'del', letter: 'd', ar: 'حذف', en: 'Delete' },
  { k: 'attach', letter: 'm', ar: 'رفع مرفق', en: 'Attach' },
  { k: 'status', letter: 's', ar: 'تغيير الحالة', en: 'Status' },
  { k: 'review', letter: 'r', ar: 'إرسال للمراجعة', en: 'Send for review' },
  { k: 'note', letter: 'n', ar: 'إضافة ملاحظة', en: 'Note' },
  { k: 'approve', letter: 'p', ar: 'اعتماد', en: 'Approve' },
];

const LETTER_TO_ACTION: Record<string, ActionKey> = Object.fromEntries(ACTIONS.map(a => [a.letter, a.k]));

export interface SectionDef { k: string; ar: string; en: string; icon: string }
export const SECTIONS: SectionDef[] = [
  { k: 'dashboard', ar: 'الرئيسية', en: 'Home', icon: 'home' },
  { k: 'projects', ar: 'المشاريع', en: 'Projects', icon: 'folder' },
  { k: 'projPhases', ar: 'مراحل المشاريع', en: 'Project phases', icon: 'list' },
  { k: 'projUpdates', ar: 'تحديثات المشاريع', en: 'Project updates', icon: 'note' },
  { k: 'projRisks', ar: 'مخاطر المشاريع', en: 'Project risks', icon: 'shield' },
  { k: 'meetings', ar: 'الاجتماعات', en: 'Meetings', icon: 'calendar' },
  { k: 'minutes', ar: 'محاضر الاجتماعات', en: 'Minutes', icon: 'note' },
  { k: 'minuteTasks', ar: 'مهام محاضر الاجتماعات', en: 'Minute tasks', icon: 'task' },
  { k: 'committees', ar: 'اللجان وفرق العمل', en: 'Committees', icon: 'scale' },
  { k: 'committeeDecisions', ar: 'قرارات اللجان', en: 'Committee decisions', icon: 'tick' },
  { k: 'correspondence', ar: 'الصادر والوارد', en: 'Correspondence', icon: 'mail' },
  { k: 'followups', ar: 'المتابعات', en: 'Follow-ups', icon: 'timer' },
  { k: 'myTasks', ar: 'مهام فريقي', en: 'My tasks', icon: 'task' },
  { k: 'reportCenter', ar: 'مركز التقارير', en: 'Report center', icon: 'chart' },
  { k: 'reportLog', ar: 'سجل التقارير', en: 'Report log', icon: 'list' },
  { k: 'finReports', ar: 'التقارير المالية', en: 'Financial reports', icon: 'bank' },
  { k: 'auditReports', ar: 'تقرير المتابعة - مكتب التدقيق', en: 'Follow-up Report — Audit Office', icon: 'chart' },
  { k: 'recommendations', ar: 'الملاحظات والتوصيات', en: 'Notes & recommendations', icon: 'note' },
  { k: 'leaves', ar: 'تخطيط إجازات الفريق', en: 'Team leave planning', icon: 'calendar' },
  { k: 'assistant', ar: 'المساعد التنفيذي', en: 'Executive assistant', icon: 'tick' },
  { k: 'permissions', ar: 'إدارة الصلاحيات', en: 'Permissions admin', icon: 'shield' },
];

export interface TypeDef { id: UserType; ar: string; en: string; icon: string; bg: string; fg: string; desc: string }
export const TYPES: TypeDef[] = [
  { id: 'chair', ar: 'رئيس القطاع', en: 'Sector Head', icon: 'crown', bg: '#fbf0d6', fg: '#a9791f', desc: 'عرض كامل، مراجعة، اعتماد، توجيه، وتغيير الحالات النهائية. صاحب الاعتماد النهائي ومنح/سحب الصلاحيات.' },
  { id: 'office', ar: 'فريق مكتب رئيس القطاع', en: 'Chair Office Team', icon: 'team', bg: '#e9f0ec', fg: '#2b5c44', desc: 'إدخال البيانات وتحديث الحالات ورفع المرفقات وإرسال البنود للمراجعة — كلٌّ حسب صلاحياته فقط.' },
  { id: 'sector', ar: 'مدراء القطاع / الإدارات', en: 'Sector / Dept. Managers', icon: 'scale', bg: '#e6eef6', fg: '#3a6ea5', desc: 'إرسال التحديثات والتقارير والملاحظات ضمن نطاق إداراتهم فقط — وصول محدود.' },
  { id: 'sysadmin', ar: 'مدير النظام', en: 'System Admin', icon: 'shield', bg: '#f3ecf6', fg: '#7a4d94', desc: 'إدارة المستخدمين والأدوار والصلاحيات والقوائم والحالات وسجل التعديلات — لا يعتمد البنود التنفيذية.' },
];

export interface ScopeDef { v: string; ar: string; en: string }
export const SCOPES: ScopeDef[] = [
  { v: 'all', ar: 'كامل القطاع', en: 'Whole sector' },
  { v: 'office', ar: 'مكتب رئيس القطاع', en: 'Sector Head Office' },
  { v: 'admin_affairs', ar: 'إدارة الشؤون الإدارية', en: 'Admin Affairs' },
  { v: 'hr', ar: 'إدارة خدمات الموارد البشرية', en: 'HR Services' },
  { v: 'digital', ar: 'إدارة الخدمات الذكية والبنية الرقمية', en: 'Digital & Infrastructure' },
  { v: 'cx', ar: 'مركز التجربة المتكاملة', en: 'Integrated Experience Center' },
];

export interface SeedUser {
  id: string;
  name: string;
  job: string;
  type: UserType;
  scope: string;
  img?: string;
  all?: boolean;
  g?: Record<string, string>; // section -> grant letters
}

export const SEED_USERS: SeedUser[] = [
  { id: 'chair', name: 'فوزية الطاير', job: 'رئيس قطاع الخدمات المركزية', type: 'chair', scope: 'all', img: 'assets/team/chief.jpg', all: true },
  { id: 'moza', name: 'موزة المرزوقي', job: 'مسؤولة الصادر والوارد والمتابعات', type: 'office', scope: 'office', img: 'assets/team/moza.jpg', g: { dashboard: 'v', correspondence: 'vaemsrn', followups: 'vaesrn', myTasks: 've', projects: 'v', reportCenter: 'v', committees: 'v', assistant: 'v' } },
  { id: 'samah', name: 'سماح أبو شرخ', job: 'مسؤولة المحاضر واللجان والتوصيات والإجازات', type: 'office', scope: 'all', img: 'assets/team/samah.jpg', g: { dashboard: 'v', meetings: 'vaer', minutes: 'vaemrn', minuteTasks: 'vaes', committees: 'vaemr', committeeDecisions: 'vaer', recommendations: 'vaer', leaves: 'vaemsrn', myTasks: 've', assistant: 'v' } },
  { id: 'fatma', name: 'فاطمه الرشيدى', job: 'مسؤولة المشاريع والتنسيق التنفيذي', type: 'office', scope: 'office', img: 'assets/team/fatma.jpg', g: { dashboard: 'v', projects: 'vaemsrn', projPhases: 'vae', projUpdates: 'vaer', projRisks: 'vae', followups: 've', myTasks: 've', reportCenter: 'v', meetings: 'v', minutes: 'v', assistant: 'v' } },
  { id: 'hagar', name: 'هاجر هلول', job: 'مسؤولة الإنجاز والمتابعة والتقارير المالية', type: 'office', scope: 'office', img: 'assets/team/hagar.jpg', g: { dashboard: 'v', followups: 'vaesrn', finReports: 'vaemrn', reportLog: 'vae', projUpdates: 'vaer', myTasks: 've', projects: 'v', assistant: 'v' } },
  { id: 'saif', name: 'سيف بيضاني', job: 'مسؤول المشاريع والمراحل والمخاطر', type: 'office', scope: 'office', g: { dashboard: 'v', projects: 'vaemsrn', projPhases: 'vae', projUpdates: 'vaer', projRisks: 'vae', followups: 've', myTasks: 've', reportCenter: 'v', assistant: 'v' } },
  { id: 'hasan', name: 'حسن همام', job: 'مسؤول الجودة والامتثال والتدقيق', type: 'office', scope: 'all', img: 'assets/team/hasan.jpg', g: { dashboard: 'v', auditReports: 'vaemrn', recommendations: 'vaesr', committees: 've', reportCenter: 've', myTasks: 've', assistant: 'v' } },
  { id: 'rashed', name: 'راشد النعيمي', job: 'مدير إدارة الشؤون الإدارية', type: 'sector', scope: 'admin_affairs', g: { dashboard: 'v', projects: 'vrn', reportCenter: 'v', correspondence: 'v', followups: 'vn', assistant: 'v' } },
  { id: 'sysadmin', name: 'مدير النظام', job: 'إدارة النظام والصلاحيات', type: 'sysadmin', scope: 'all', g: { dashboard: 'v', permissions: 'vaeds', assistant: 'v' } },
];

/** workflow status -> [bg, fg] */
export const WFS: Record<string, [string, string]> = {
  'مسودة': ['#eceeeb', '#6d7973'],
  'قيد التحديث': ['#e3edf6', '#2f6aa8'],
  'مرسل للمراجعة': ['#f1e8f5', '#7a4d94'],
  'بانتظار مراجعة رئيس القطاع': ['#fbf2df', '#a9791f'],
  'أعيد للتعديل': ['#f7e6e4', '#b0433b'],
  'معتمد': ['#e2f0e8', '#2e7d55'],
  'مكتمل': ['#dcefe0', '#1f7a4d'],
  'ملغي': ['#eceeeb', '#9aa39b'],
};

/** section key -> the page it maps to for navigation */
export const SEC_PAGE: Record<string, string> = {
  correspondence: 'correspondence', followups: 'actions', minutes: 'meetings', minuteTasks: 'mtasks',
  committees: 'committees', committeeDecisions: 'committees', leaves: 'leaves', myTasks: 'otasks',
  projects: 'projects', projPhases: 'projects', projUpdates: 'projects', projRisks: 'projects',
  reportCenter: 'reportcenter', reportLog: 'reportcenter', finReports: 'reportcenter',
  auditReports: 'reportcenter', recommendations: 'reportcenter',
};

/** Effective permissions for a user: section -> set of action keys. */
export function effectivePerms(u: SeedUser): Record<string, Set<ActionKey>> {
  const out: Record<string, Set<ActionKey>> = {};
  if (u.all || u.type === 'chair') {
    // chair sees everything with all actions
    for (const s of SECTIONS) out[s.k] = new Set(ACTIONS.map(a => a.k));
    return out;
  }
  for (const [sec, letters] of Object.entries(u.g || {})) {
    const set = new Set<ActionKey>();
    for (const ch of letters) { const a = LETTER_TO_ACTION[ch]; if (a) set.add(a); }
    out[sec] = set;
  }
  return out;
}

export function can(u: SeedUser, section: string, action: ActionKey): boolean {
  if (u.all || u.type === 'chair') return true;
  const letters = (u.g || {})[section];
  if (!letters) return false;
  const letter = ACTIONS.find(a => a.k === action)?.letter;
  return !!letter && letters.includes(letter);
}

export function canSee(u: SeedUser, section: string): boolean {
  return can(u, section, 'view');
}
