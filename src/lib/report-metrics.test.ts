import { describe, it, expect } from 'vitest';
import {
  weightedPercent, evalTier, hifzBucketIndex, HIFZ_BUCKETS,
} from './report-metrics';

describe('report-metrics', () => {
  it('إقراء/غير محدد: 0.2×حضور + 10', () => {
    // حاضرة إقراء (لا حفظ) → 30
    expect(weightedPercent({ juzCount: 0, attendancePct: 100, hifzPct: 0, thabitPct: 0 })).toBe(30);
    expect(weightedPercent({ juzCount: null, attendancePct: 0, hifzPct: 0, thabitPct: 0 })).toBe(10);
  });

  it('القرآن كامل (30): 0.2×حضور + 0.7×حفظ + 10 (يطابق السجل الورقي)', () => {
    // حفظ 250% حاضرة → 20 + 175 + 10 = 205
    expect(weightedPercent({ juzCount: 30, attendancePct: 100, hifzPct: 250, thabitPct: 0 })).toBe(205);
    // حفظ 303% → 20 + 212.1 + 10 = 242.1
    expect(weightedPercent({ juzCount: 30, attendancePct: 100, hifzPct: 303, thabitPct: 0 }))
      .toBeCloseTo(242.1, 1);
  });

  it('عشرون/عشرة: 0.2×حضور + 0.35×حفظ + 0.35×تثبيت + 10', () => {
    // حاضرة، حفظ 100%، تثبيت مؤكَّد → 20 + 35 + 35 + 10 = 100
    expect(weightedPercent({ juzCount: 20, attendancePct: 100, hifzPct: 100, thabitPct: 100 })).toBe(100);
    // حاضرة، حفظ 100%، بلا تثبيت → 20 + 35 + 0 + 10 = 65
    expect(weightedPercent({ juzCount: 10, attendancePct: 100, hifzPct: 100, thabitPct: 0 })).toBe(65);
  });

  it('التقييم وفق السُّلّم', () => {
    expect(evalTier(100)).toBe('ممتاز');
    expect(evalTier(80)).toBe('ممتاز');
    expect(evalTier(79)).toBe('جيد');
    expect(evalTier(60)).toBe('جيد');
    expect(evalTier(59)).toBe('ضعيف');
    expect(evalTier(30)).toBe('ضعيف');
  });

  it('شرائح الحفظ', () => {
    expect(HIFZ_BUCKETS).toHaveLength(6);
    expect(hifzBucketIndex(0)).toBe(0);      // <60
    expect(hifzBucketIndex(59.9)).toBe(0);
    expect(hifzBucketIndex(60)).toBe(1);     // 60-80
    expect(hifzBucketIndex(100)).toBe(3);    // 100-120
    expect(hifzBucketIndex(500)).toBe(5);    // 150+
  });
});
