import { describe, it, expect } from 'vitest';
import { dailyNisab, nisabDayFactor, nisabWorkingDaysSum, HALF_NISAB_DATES } from './program-target';

// مراجع التقويم: ٩ يوليو ٢٠٢٦ = الخميس، فيكون ١٠ يوليو = الجمعة (إجازة).
const THU = '2026-07-09'; // خميس + يوم فترة صباحية (نصف نصاب)
const FRI = '2026-07-10'; // جمعة (إجازة)
const SAT = '2026-07-11';
const WED = '2026-07-08';

describe('dailyNisab', () => {
  it('returns the fixed نصاب per juz count', () => {
    expect(dailyNisab(30)).toBe(40);
    expect(dailyNisab(10)).toBe(12.5);
  });
  it('returns null for unspecified/unknown branches', () => {
    expect(dailyNisab(0)).toBeNull();
    expect(dailyNisab(null)).toBeNull();
    expect(dailyNisab(7)).toBeNull();
  });
});

describe('nisabDayFactor', () => {
  it('is 0 on Fridays (day off)', () => {
    expect(nisabDayFactor(FRI)).toBe(0);
  });
  it('is 0.5 on morning-only exception days', () => {
    expect(HALF_NISAB_DATES.has(THU)).toBe(true);
    expect(nisabDayFactor(THU)).toBe(0.5);
  });
  it('is 1 on a normal working day', () => {
    expect(nisabDayFactor(WED)).toBe(1);
    expect(nisabDayFactor(SAT)).toBe(1);
  });
});

describe('nisabWorkingDaysSum', () => {
  it('excludes Fridays and applies the 0.5 morning factor', () => {
    // Mon..Sun: 07-06..07-12 → 1+1+1+0.5(Thu)+0(Fri)+1+1 = 5.5
    expect(nisabWorkingDaysSum('2026-07-06', '2026-07-12')).toBe(5.5);
  });
  it('is 0 for a single Friday', () => {
    expect(nisabWorkingDaysSum(FRI, FRI)).toBe(0);
  });
  it('counts a single normal day as 1 (inclusive range)', () => {
    expect(nisabWorkingDaysSum(WED, WED)).toBe(1);
  });
  it('is 0 for an inverted/empty range', () => {
    expect(nisabWorkingDaysSum(FRI, THU)).toBe(0);
  });
});
