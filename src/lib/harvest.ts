// حساب حصيلة التسميع مع فصل حلقات «الحرم» (sponsor) عن حلقاتنا.
// حلقات الحرم: مستهدفها اليومي = ما أنجزته فعلاً (تُضاف للمطلوب والمنجز بالتساوي)،
// فلا تظهر «متأخرة» أبداً ولا تسحب النسبة. عند عدم وجود حلقات حرم يكون الناتج
// مطابقاً تماماً للسلوك القديم (regularPages فقط، والمطلوب = regularRequired).

/**
 * يفصل صفوف التسميع إلى منجز/مطلوب حسب توجيه الحرم.
 * @param rows صفوف التسميع (صفحات + معرّف الحلقة).
 * @param sponsorIds مجموعة معرّفات حلقات الحرم.
 * @param regularRequired المستهدف الثابت (نصاب) لحلقاتنا فقط.
 * @param includeHaram دمج الحرم في الإجماليات (افتراضي في اللوحة = true).
 */
export function splitHarvest(
  rows: { pages: number; circleId: string | null }[],
  sponsorIds: Set<string>,
  regularRequired: number,
  includeHaram: boolean,
): { completed: number; required: number } {
  let sponsorPages = 0;
  let regularPages = 0;
  for (const r of rows) {
    if (r.circleId != null && sponsorIds.has(r.circleId)) sponsorPages += r.pages;
    else regularPages += r.pages;
  }
  if (includeHaram) {
    return { completed: regularPages + sponsorPages, required: regularRequired + sponsorPages };
  }
  return { completed: regularPages, required: regularRequired };
}
