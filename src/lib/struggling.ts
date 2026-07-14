// مصدر واحد لحساب «التعثّر» (العجز والسبب) — تستخدمه صفحة التسميع والتقرير اليومي
// معاً حتى لا يتباعد المنطق بينهما.

export interface StruggleInfo {
  isStruggling: boolean;
  deficit: number; // المنجز − المطلوب (سالب = متأخرة)
  cause: string; // سبب العجز (فارغ إذا لا تعثّر)
}

/**
 * حالة التعثّر بناءً على الصفحات المنجزة والعتبة المطلوبة وهل الطالبة غائبة.
 * target ≤ 0 ⇒ لا نصاب مطلوب ⇒ لا تعثّر.
 */
export function struggleInfo(pages: number, target: number, absent: boolean): StruggleInfo {
  if (target <= 0) return { isStruggling: false, deficit: 0, cause: '' };
  const deficit = pages - target;
  if (pages >= target) return { isStruggling: false, deficit, cause: '' };
  const cause = pages === 0
    ? (absent ? 'غائبة — لم تُسمِّع' : 'لم تُسمِّع اليوم')
    : 'تقصير في الحفظ';
  return { isStruggling: true, deficit, cause };
}
