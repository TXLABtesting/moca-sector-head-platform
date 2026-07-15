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
}

export interface DirectiveMsg { text: string; date: string }
export interface RecentMsg { text: string; date: string }

export const WORK_ITEMS: WorkItem[] = [
  { id: 'wi1', owner: 'samah', section: 'minutes', title: 'محضر اجتماع القطاع الأسبوعي', status: 'بانتظار مراجعة رئيس القطاع', date: '2 يوليو 2026' },
  { id: 'wi2', owner: 'samah', section: 'committeeDecisions', title: 'قرار اللجنة التوجيهية لأمن المعلومات (24/2026)', status: 'بانتظار مراجعة رئيس القطاع', date: '1 يوليو 2026' },
  { id: 'wi3', owner: 'samah', section: 'recommendations', title: 'توصيات لجنة بيع الأصول والموجودات', status: 'أعيد للتعديل', date: '30 يونيو 2026', reason: 'يرجى إضافة الأثر المالي المتوقع لكل توصية قبل إعادة الإرسال.' },
  { id: 'wi4', owner: 'samah', section: 'leaves', title: 'خطة إجازات الفريق — يوليو 2026', status: 'مسودة', date: '29 يونيو 2026' },
  { id: 'wi5', owner: 'samah', section: 'committees', title: 'محضر اللجنة الإشرافية للخدمات المالية', status: 'معتمد', date: '26 يونيو 2026' },
  { id: 'wi6', owner: 'samah', section: 'minuteTasks', title: 'متابعة مهام محضر اجتماع القطاع', status: 'قيد التحديث', date: '1 يوليو 2026' },
  { id: 'mo1', owner: 'moza', section: 'correspondence', title: 'خطاب توحيد إجراءات المكتب (صادر)', status: 'بانتظار مراجعة رئيس القطاع', date: '2 يوليو 2026' },
  { id: 'mo2', owner: 'moza', section: 'followups', title: 'متابعة الرد على ديوان المحاسبة', status: 'قيد التحديث', date: '1 يوليو 2026' },
  { id: 'mo3', owner: 'moza', section: 'correspondence', title: 'وارد: طلب دعم الميزانية', status: 'أعيد للتعديل', date: '30 يونيو 2026', reason: 'يرجى تحديد الجهة المسؤولة عن المتابعة وتاريخ الاستحقاق.' },
  { id: 'mo4', owner: 'moza', section: 'followups', title: 'متابعة تنفيذ توصية الأرشفة الإلكترونية', status: 'معتمد', date: '27 يونيو 2026' },
  { id: 'fa1', owner: 'fatma', section: 'projUpdates', title: 'تحديث مشروع توحيد إجراءات المكتب', status: 'مرسل للمراجعة', date: '1 يوليو 2026' },
  { id: 'fa2', owner: 'fatma', section: 'projPhases', title: 'مرحلة «التنفيذ» — مشروع وحدات التعلم', status: 'قيد التحديث', date: '30 يونيو 2026' },
  { id: 'fa3', owner: 'fatma', section: 'projRisks', title: 'مخاطر مشروع إعادة الهيكلة', status: 'أعيد للتعديل', date: '29 يونيو 2026', reason: 'يرجى تصنيف المخاطر حسب الأثر والاحتمال وإضافة خطة معالجة.' },
  { id: 'ha1', owner: 'hagar', section: 'finReports', title: 'التقرير المالي الشهري — يونيو 2026', status: 'بانتظار مراجعة رئيس القطاع', date: '1 يوليو 2026' },
  { id: 'ha2', owner: 'hagar', section: 'reportLog', title: 'متابعة استلام تقرير الدفعات المستبقاة', status: 'قيد التحديث', date: '30 يونيو 2026' },
  { id: 'ha3', owner: 'hagar', section: 'followups', title: 'تحديث حالة طلب دعم الميزانية', status: 'معتمد', date: '28 يونيو 2026' },
  { id: 'sa1', owner: 'saif', section: 'projUpdates', title: 'تحديث مشروع الخدمات الذكية والبنية الرقمية', status: 'مرسل للمراجعة', date: '1 يوليو 2026' },
  { id: 'sa2', owner: 'saif', section: 'projPhases', title: 'مرحلة «الإطلاق» — مشروع البنية الرقمية', status: 'مسودة', date: '29 يونيو 2026' },
  { id: 'hs1', owner: 'hasan', section: 'auditReports', title: 'تقرير المتابعة والتدقيق الربعي', status: 'بانتظار مراجعة رئيس القطاع', date: '1 يوليو 2026' },
  { id: 'hs2', owner: 'hasan', section: 'recommendations', title: 'ملاحظات الامتثال — مشروع الأرشفة', status: 'أعيد للتعديل', date: '30 يونيو 2026', reason: 'يرجى إرفاق المرجع النظامي لكل ملاحظة امتثال.' },
  { id: 'hs3', owner: 'hasan', section: 'recommendations', title: 'توصيات الجودة لخدمات المالية', status: 'معتمد', date: '27 يونيو 2026' },
];

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
