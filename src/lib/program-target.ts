// المستهدف اليومي = نصاب الحفظ الرسمي لكل فرع (مجموع الفترتين الصباحية والمسائية)
// حسب عدد الأجزاء. قيم ثابتة معتمدة (وجه = صفحة). النطاقات تُؤخذ بالحدّ الأدنى.
//   الأول  (30 جزء): 20 صباحي + 20 مسائي = 40
//   الثاني (20 جزء): 13 + 12            = 25
//   الثالث (10 أجزاء): 6.5 + 6            = 12.5
//   الرابع (5 أجزاء): (3 أو 4) + 3       = 6  (الأدنى)
export const NISAB_BY_JUZ: Record<number, number> = {
  30: 40,
  20: 25,
  10: 12.5,
  5: 6,
};

/** المستهدف اليومي (صفحات) للفرع حسب عدد الأجزاء. null إذا غير محدد (0 أو غير معروف). */
export function dailyNisab(juzCount: number | null | undefined): number | null {
  if (!juzCount || juzCount <= 0) return null;
  return NISAB_BY_JUZ[juzCount] ?? null;
}

// استثناء مؤقّت لمرّة واحدة: أيام طُلب فيها التسميع الصباحي فقط، فيُحتسب نصاب
// اليوم بنسبة 50٪ فقط (لأن النصاب المعتمد = فترة صباحية + مسائية). يُزال بعد
// انقضاء اليوم بحذف التاريخ من المجموعة. التواريخ بصيغة YYYY-MM-DD.
export const HALF_NISAB_DATES = new Set<string>(['2026-07-09']);

/** معامل نصاب اليوم: 0.5 في أيام الفترة الصباحية فقط، وإلا 1. */
export function nisabDayFactor(date: string): number {
  return HALF_NISAB_DATES.has(date) ? 0.5 : 1;
}

/**
 * مجموع معاملات النصاب عبر مدى أيام [start..end] بطول days يوماً.
 * كل يوم استثنائي داخل المدى يُحتسب 0.5 بدل 1 (تُخصم 0.5 من الإجمالي).
 */
export function nisabRangeFactorSum(start: string, end: string, days: number): number {
  let halfDays = 0;
  for (const d of HALF_NISAB_DATES) if (d >= start && d <= end) halfDays++;
  return days - 0.5 * halfDays;
}
