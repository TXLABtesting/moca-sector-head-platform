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

export const MEMBER_DIRECTIVES: Record<string, DirectiveMsg[]> = {
  samah: [{ text: 'يرجى تسريع رفع محاضر لجنة الأمن السيبراني قبل نهاية الأسبوع.', date: '2 يوليو 2026' }, { text: 'أضيفي ملخصاً تنفيذياً موجزاً لكل محضر قبل الإرسال للمراجعة.', date: '30 يونيو 2026' }],
  moza: [{ text: 'تابعي الرد على وارد مكتب رئاسة مجلس الوزراء اليوم.', date: '2 يوليو 2026' }],
  fatma: [{ text: 'قدّمي خطة معالجة واضحة لمخاطر مشروع إعادة الهيكلة.', date: '1 يوليو 2026' }],
  hagar: [{ text: 'أرفقي مقارنة ربعية في التقرير المالي القادم.', date: '1 يوليو 2026' }],
  saif: [{ text: 'حدّث نسبة الإنجاز لمشاريعك أسبوعياً.', date: '30 يونيو 2026' }],
  hasan: [{ text: 'ركّز على إغلاق ملاحظات التدقيق المتأخرة أولاً.', date: '1 يوليو 2026' }],
};

export const MEMBER_RECENT: Record<string, RecentMsg[]> = {
  samah: [{ text: 'رفع محضر اجتماع القطاع الأسبوعي', date: '2 يوليو 2026' }, { text: 'تحديث حالة إجازة محمد الياسي', date: '1 يوليو 2026' }],
  moza: [{ text: 'إضافة مستند صادر جديد', date: '2 يوليو 2026' }, { text: 'تحديث حالة متابعة ديوان المحاسبة', date: '1 يوليو 2026' }],
  fatma: [{ text: 'تحديث نسبة إنجاز مشروع توحيد الإجراءات', date: '1 يوليو 2026' }],
  hagar: [{ text: 'رفع التقرير المالي الشهري', date: '1 يوليو 2026' }],
  saif: [{ text: 'تحديث مرحلة مشروع الخدمات الذكية', date: '1 يوليو 2026' }],
  hasan: [{ text: 'إصدار تقرير التدقيق الربعي', date: '1 يوليو 2026' }],
};
