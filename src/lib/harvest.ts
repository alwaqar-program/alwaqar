// حساب حصيلة التسميع مع فصل حلقات «الحرم» (sponsor) عن حلقاتنا.
// حلقات الحرم: مستهدفها اليومي = ما أنجزته فعلاً (تُضاف للمطلوب والمنجز بالتساوي)،
// فلا تظهر «متأخرة» أبداً ولا تسحب النسبة. عند عدم وجود حلقات حرم يكون الناتج
// مطابقاً تماماً للسلوك القديم (regularPages فقط، والمطلوب = regularRequired).

// فلتر الحصيلة الثلاثي (يطابق CIRCLE_TYPE_FILTERS في circle-type.ts):
//   ''        = الكل        → حلقاتنا + الحرم مدموجة (السلوك القديم «شامل الحرم»).
//   'regular' = تابعة للحرم → الحلقات العادية فقط (السلوك القديم «بدون الحرم»).
//   'sponsor' = حلقاتنا     → حلقات الحرم فقط؛ مستهدفها = ما أنجزته (النسبة ١٠٠٪).
export type HaramFilter = '' | 'regular' | 'sponsor';

/**
 * يفصل صفوف التسميع (المجمّعة حسب اليوم/نوع الحلقة) إلى منجز/مطلوب حسب فلتر الحصيلة.
 * @param rows صفوف مجمّعة (صفحات + هل الحلقة تابعة للحرم sponsor).
 * @param regularRequired المستهدف الثابت (نصاب) لحلقاتنا (العادية) فقط.
 * @param filter الفلتر الثلاثي (افتراضي في اللوحة = '' الكل).
 */
export function splitHarvest(
  rows: { pages: number; sponsor: boolean }[],
  regularRequired: number,
  filter: HaramFilter,
): { completed: number; required: number } {
  let sponsorPages = 0;
  let regularPages = 0;
  for (const r of rows) {
    if (r.sponsor) sponsorPages += r.pages;
    else regularPages += r.pages;
  }
  // تابعة للحرم: الحلقات العادية فقط بنصابها الثابت.
  if (filter === 'regular') return { completed: regularPages, required: regularRequired };
  // حلقاتنا: حلقات الحرم فقط، مستهدفها = ما أنجزته (لا تظهر متأخرة، النسبة ١٠٠٪).
  if (filter === 'sponsor') return { completed: sponsorPages, required: sponsorPages };
  // الكل: دمج الطرفين — الحرم يُضاف للمطلوب والمنجز بالتساوي فلا يسحب النسبة.
  return { completed: regularPages + sponsorPages, required: regularRequired + sponsorPages };
}
