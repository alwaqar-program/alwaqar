// أيام الاختبارات المجدولة: كل يوم يخصّ نوع اختبار واحد فقط.
// المقارنة على نص التاريخ YYYY-MM-DD مباشرةً (بدون حساب تواريخ) لتفادي
// التباس المنطقة الزمنية. عدّلي الجدول هنا في كل فصل/دورة.
export const EXAM_DAYS: Record<string, string> = {
  '2026-07-11': 'weekly_1', // الأسبوع الأول
  '2026-07-18': 'weekly_2', // الأسبوع الثاني
  '2026-07-22': 'final',    // النهائي
};

/** نوع الاختبار المجدول لتاريخ معيّن (YYYY-MM-DD)، أو null إن لم يكن يوم اختبار. */
export const examTypeForDate = (date: string): string | null => EXAM_DAYS[date] ?? null;

/** مسميات أنواع الاختبارات للعرض. */
export const EXAM_TYPE_LABEL: Record<string, string> = {
  weekly_1: 'الأسبوع الأول',
  weekly_2: 'الأسبوع الثاني',
  final: 'النهائي',
};
