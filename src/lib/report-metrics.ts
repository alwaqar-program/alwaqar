// report-metrics.ts — pure helpers for the daily detailed report.
// النسبة الموزونة (weighted %) + التقييم + شرائح التوزيع. لا تبعيات.
//
// النسبة الموزونة تجمع الحضور والحفظ والتثبيت في رقم واحد، بأوزان تختلف حسب الفرع.
// بند «الإنذارات» في السجل الورقي = 10% ولا نتتبّع الإنذارات في النظام، فيُحتسب
// دائماً كاملاً (لا خصم) — أي يُضاف 10 ثابتة. (موثّق: لا يوجد نظام إنذارات بعد.)
//   • الإقراء / غير محدد (لا نصاب حفظ): 0.2×الحضور + 10
//   • القرآن كامل (30 جزء):            0.2×الحضور + 0.7×الحفظ + 10
//   • عشرون/عشرة/خمسة أجزاء:            0.2×الحضور + 0.35×الحفظ + 0.35×التثبيت + 10
// الحفظ غير مقيَّد بـ100 (المتفوقات تتجاوز)، مطابقةً للسجل الورقي.

const WARNINGS_BAND = 10; // بند الإنذارات: كامل دائماً (لا إنذارات مُتتبَّعة)

export interface WeightedInput {
  juzCount: number | null | undefined; // عدد أجزاء الفرع (0/غير معروف = إقراء/غير محدد)
  attendancePct: number;               // 100 حاضرة / 0 غائبة
  hifzPct: number;                     // (المنجز/المطلوب)×100 ، 0 إن لا مطلوب
  thabitPct: number;                   // 100 إن أُكِّد نصاب التثبيت وإلا 0
}

/** النسبة الموزونة (قد تتجاوز 100 للمتفوقات). */
export function weightedPercent(i: WeightedInput): number {
  const att = 0.2 * (i.attendancePct || 0);
  if (!i.juzCount || i.juzCount <= 0) return att + WARNINGS_BAND;      // إقراء/غير محدد
  if (i.juzCount >= 30) return att + 0.7 * (i.hifzPct || 0) + WARNINGS_BAND; // كامل
  return att + 0.35 * (i.hifzPct || 0) + 0.35 * (i.thabitPct || 0) + WARNINGS_BAND;
}

export type EvalTier = 'ممتاز' | 'جيد' | 'ضعيف';

/** التقييم وفق سُلّم الأداء: ممتاز 80-100+، جيد 60-79، ضعيف <60. */
export function evalTier(weighted: number): EvalTier {
  if (weighted >= 80) return 'ممتاز';
  if (weighted >= 60) return 'جيد';
  return 'ضعيف';
}

// شرائح توزيع نسبة إنجاز الحفظ (نفس حدود السجل الورقي).
export const HIFZ_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'أقل من ٦٠٪', min: -Infinity, max: 60 },
  { label: '٦٠–٨٠٪', min: 60, max: 80 },
  { label: '٨٠–١٠٠٪', min: 80, max: 100 },
  { label: '١٠٠–١٢٠٪', min: 100, max: 120 },
  { label: '١٢٠–١٥٠٪', min: 120, max: 150 },
  { label: '١٥٠٪ فأكثر', min: 150, max: Infinity },
];

/** فهرس الشريحة التي تقع فيها النسبة (0..HIFZ_BUCKETS.length-1). */
export function hifzBucketIndex(pct: number): number {
  for (let i = 0; i < HIFZ_BUCKETS.length; i++) {
    if (pct >= HIFZ_BUCKETS[i].min && pct < HIFZ_BUCKETS[i].max) return i;
  }
  return HIFZ_BUCKETS.length - 1;
}

// شرائح النسبة الموزونة (لعرض مؤشرات التقييم).
export const WEIGHTED_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'أقل من ٦٠', min: -Infinity, max: 60 },
  { label: '٦٠–٧٠', min: 60, max: 70 },
  { label: '٧٠–٨٠', min: 70, max: 80 },
  { label: '٨٠–٩٠', min: 80, max: 90 },
  { label: '٩٠–١٠٠', min: 90, max: Infinity },
];

export function weightedBucketIndex(pct: number): number {
  for (let i = 0; i < WEIGHTED_BUCKETS.length; i++) {
    if (pct >= WEIGHTED_BUCKETS[i].min && pct < WEIGHTED_BUCKETS[i].max) return i;
  }
  return WEIGHTED_BUCKETS.length - 1;
}
