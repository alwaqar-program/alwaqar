// src/lib/circle-type.ts
export type CircleType = 'regular' | 'sponsor';

export const SPONSOR_LABEL = 'تابعة للحرم';

export const isSponsor = (t?: string | null) => t === 'sponsor';

export const CIRCLE_TYPE_LABEL: Record<CircleType, string> = {
  regular: 'حلقاتنا',
  sponsor: 'تابعة للحرم',
};

export const CIRCLE_TYPE_FILTERS = [
  ['', 'الكل'],
  ['regular', 'حلقاتنا'],
  ['sponsor', 'تابعة للحرم'],
] as const;
