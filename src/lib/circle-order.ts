// Fixed display order for the circles dropdown, requested by the program owner.
// Circles not in this list fall to the end, ordered naturally by name.
//
// Matching is tolerant: Arabic-Indic digits are folded to Latin, tashkeel and
// tatweel are stripped, and whitespace is collapsed — so a circle_name still
// matches even if its digits/diacritics differ slightly from the list below.

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function norm(s: string): string {
  return (s || '')
    .replace(/[٠-٩]/g, d => ARABIC_DIGITS[d] ?? d)
    .replace(/[ً-ْـ]/g, '') // tashkeel + tatweel
    .replace(/\s+/g, ' ')
    .trim();
}

const ORDER: string[] = [
  'حلقة الوقار (1) | فرع الخاتمات',
  'حلقة الوقار (2) | فرع الخاتمات',
  'حلقة الوقار (3) | فرع الخاتمات',
  'حلقة الوقار (4) | فرع الخاتمات',
  'حلقة الوقار (5) | فرع الخاتمات',
  'حلقة الوقار (6) | فرع 20 جزءًا',
  'حلقة الوقار (7) | فرع 20 جزءًا',
  'حلقة الوقار (8) | فرع 20 جزءًا',
  'حلقة الوقار (9) | فرع 10 أجزاء',
  'حلقة الوقار (10) | فرع 10 أجزاء',
  'حلقة الوقار (11) | فرع 10 أجزاء',
  'حلقة الوقار (12) | فرع 5 أجزاء',
  'حلقة الوقار (13) | فرع 5 أجزاء',
  'حلقة الوقار (14) | فرع 5 أجزاء',
  'حلقة الوقار (15) | فرع 5 أجزاء',
  'حلقة الإحسان',
  'حلقة الإقراء',
  'الأمهات',
  'المبتدئ 1',
  'المبتدئ 2',
];

const RANK = new Map(ORDER.map((name, i) => [norm(name), i]));
const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

/** Sort circles by the fixed program order; unknown circles go last (by name). */
export function sortCircles<T extends { circle_name: string }>(circles: T[]): T[] {
  return [...circles].sort((a, b) => {
    const ra = RANK.get(norm(a.circle_name)) ?? Infinity;
    const rb = RANK.get(norm(b.circle_name)) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return collator.compare(a.circle_name, b.circle_name);
  });
}
