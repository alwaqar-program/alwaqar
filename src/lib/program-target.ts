import { supabase } from '@/integrations/supabase/client';

// المستهدف اليومي للصفحات محسوب من النظام:
//   صفحات الفرع (حسب عدد الأجزاء من mushaf_reference) ÷ أيام الدراسة (باستثناء الجمعة).

/** عدد صفحات كل جزء من الجدول المرجعي للمصحف (juz_number → عدد الصفحات). */
export async function fetchJuzPageCounts(): Promise<Record<number, number>> {
  const { data } = await supabase.from('mushaf_reference').select('juz_number');
  const map: Record<number, number> = {};
  (data || []).forEach((r: { juz_number: number | null }) => {
    if (r.juz_number != null) map[r.juz_number] = (map[r.juz_number] || 0) + 1;
  });
  return map;
}

/** إجمالي صفحات أول `juzCount` جزءًا. */
export function pagesForJuz(juzPages: Record<number, number>, juzCount: number): number {
  let total = 0;
  for (let j = 1; j <= juzCount; j++) total += juzPages[j] || 0;
  return total;
}

/** أيام [start, end] شاملةً، باستثناء الجمعة (getDay() === 5). */
export function studyDaysExcludingFridays(startISO: string | null, endISO: string | null): number {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let days = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 5) days++; // 5 = الجمعة
  }
  return days;
}

/** المستهدف اليومي = صفحات الفرع ÷ أيام الدراسة. null إذا تعذّر الحساب. */
export function dailyPageTarget(
  juzPages: Record<number, number>,
  juzCount: number,
  startISO: string | null,
  endISO: string | null,
): number | null {
  const pages = pagesForJuz(juzPages, juzCount);
  const days = studyDaysExcludingFridays(startISO, endISO);
  if (!pages || !days) return null;
  return pages / days;
}
