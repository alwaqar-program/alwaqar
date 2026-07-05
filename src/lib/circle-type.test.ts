// src/lib/circle-type.test.ts
import { describe, it, expect } from 'vitest';
import {
  isSponsor, CIRCLE_TYPE_LABEL, SPONSOR_LABEL, CIRCLE_TYPE_FILTERS, circleTypeLabel,
} from './circle-type';

describe('circle-type', () => {
  it('identifies sponsor circles', () => {
    expect(isSponsor('sponsor')).toBe(true);
    expect(isSponsor('regular')).toBe(false);
    expect(isSponsor(null)).toBe(false);
    expect(isSponsor(undefined)).toBe(false);
  });

  it('maps circle type to arabic label (labels swapped per owner request)', () => {
    expect(CIRCLE_TYPE_LABEL.regular).toBe('تابعة للحرم');
    expect(CIRCLE_TYPE_LABEL.sponsor).toBe('حلقاتنا');
  });

  it('exposes the sponsor label constant', () => {
    expect(SPONSOR_LABEL).toBe('حلقاتنا');
  });

  it('labels both circle types, null for unknown', () => {
    expect(circleTypeLabel('sponsor')).toBe('حلقاتنا');
    expect(circleTypeLabel('regular')).toBe('تابعة للحرم');
    expect(circleTypeLabel(null)).toBeNull();
    expect(circleTypeLabel(undefined)).toBeNull();
  });

  it('lists the circle type filter chips', () => {
    expect(CIRCLE_TYPE_FILTERS).toEqual([
      ['', 'الكل'],
      ['regular', 'تابعة للحرم'],
      ['sponsor', 'حلقاتنا'],
    ]);
  });
});
