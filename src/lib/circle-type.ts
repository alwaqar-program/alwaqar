// src/lib/circle-type.ts
export type CircleType = 'regular' | 'sponsor';

// Display labels are intentionally swapped per owner request (2026-07-05):
// sponsor (الحرم/رفقة الوقار) circles display «حلقاتنا»، regular circles display «تابعة للحرم».
// The underlying circle_type values are unchanged — only the shown text.
export const SPONSOR_LABEL = 'حلقاتنا';

export const isSponsor = (t?: string | null) => t === 'sponsor';

export const CIRCLE_TYPE_LABEL: Record<CircleType, string> = {
  regular: 'تابعة للحرم',
  sponsor: 'حلقاتنا',
};

export const CIRCLE_TYPE_FILTERS = [
  ['', 'الكل'],
  ['regular', 'تابعة للحرم'],
  ['sponsor', 'حلقاتنا'],
] as const;

// Label for any circle_type — both types are badged. null for unknown / no circle.
export const circleTypeLabel = (t?: string | null): string | null =>
  t === 'sponsor' ? CIRCLE_TYPE_LABEL.sponsor
    : t === 'regular' ? CIRCLE_TYPE_LABEL.regular
    : null;
