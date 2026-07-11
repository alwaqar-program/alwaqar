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

const FRIDAY = 5; // الجمعة إجازة أسبوعية بلا نصاب مطلوب

/**
 * معامل نصاب اليوم:
 *   0   يوم الجمعة (إجازة، لا مستهدف)،
 *   0.5 أيام الفترة الصباحية فقط،
 *   1   بقية أيام العمل.
 */
export function nisabDayFactor(date: string): number {
  if (new Date(date + 'T00:00:00').getDay() === FRIDAY) return 0;
  return HALF_NISAB_DATES.has(date) ? 0.5 : 1;
}

// اليوم التالي بصيغة YYYY-MM-DD (بحساب محلي، متوافق مع تخزين التواريخ في النظام).
function nextDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * مجموع معاملات النصاب («أيام العمل») عبر المدى [start..end] شاملاً الطرفين.
 * تُستبعد الجُمَع (إجازة = 0)، ويوم الفترة الصباحية يُحتسب 0.5، وبقية الأيام 1.
 * يُستخدم لمقام «الحصيلة التراكمية» فلا تُحتسب الجُمَع ضمن المطلوب.
 */
export function nisabWorkingDaysSum(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  let sum = 0;
  for (let d = start; d <= end; d = nextDay(d)) sum += nisabDayFactor(d);
  return sum;
}
