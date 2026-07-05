// src/lib/circle-type.test.ts
import { describe, it, expect } from 'vitest';
import {
  isSponsor, CIRCLE_TYPE_LABEL, SPONSOR_LABEL, CIRCLE_TYPE_FILTERS,
} from './circle-type';

describe('circle-type', () => {
  it('identifies sponsor circles', () => {
    expect(isSponsor('sponsor')).toBe(true);
    expect(isSponsor('regular')).toBe(false);
    expect(isSponsor(null)).toBe(false);
    expect(isSponsor(undefined)).toBe(false);
  });

  it('maps circle type to arabic label', () => {
    expect(CIRCLE_TYPE_LABEL.regular).toBe('حلقاتنا');
    expect(CIRCLE_TYPE_LABEL.sponsor).toBe('تابعة للحرم');
  });

  it('exposes the sponsor label constant', () => {
    expect(SPONSOR_LABEL).toBe('تابعة للحرم');
  });

  it('lists the circle type filter chips', () => {
    expect(CIRCLE_TYPE_FILTERS).toEqual([
      ['', 'الكل'],
      ['regular', 'حلقاتنا'],
      ['sponsor', 'تابعة للحرم'],
    ]);
  });
});
