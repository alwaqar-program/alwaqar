// src/lib/leave.ts
// أنواع الاستئذان المشتركة بين صفحة الاستئذان وتسجيل الحضور (/attend).
export const leaveTypes = ['إذن خروج', 'إجازة مرضية', 'إجازة طارئة', 'إذن زيارة', 'أخرى'];

export const leaveStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
};
