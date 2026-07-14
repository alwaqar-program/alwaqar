import { describe, it, expect } from 'vitest';
import { struggleInfo } from './struggling';
import { nisabPeriodThreshold } from './program-target';

describe('struggleInfo', () => {
  it('is not struggling when target is 0 (day off / no نصاب)', () => {
    expect(struggleInfo(0, 0, true)).toEqual({ isStruggling: false, deficit: 0, cause: '' });
  });
  it('is not struggling when pages meet or exceed target', () => {
    expect(struggleInfo(25, 25, false).isStruggling).toBe(false);
    expect(struggleInfo(30, 25, false).isStruggling).toBe(false);
    expect(struggleInfo(30, 25, false).deficit).toBe(5);
  });
  it('flags "غائبة" when nothing recited and absent', () => {
    expect(struggleInfo(0, 12, true)).toEqual({ isStruggling: true, deficit: -12, cause: 'غائبة — لم تُسمِّع' });
  });
  it('flags "لم تُسمِّع اليوم" when nothing recited and present', () => {
    expect(struggleInfo(0, 12, false).cause).toBe('لم تُسمِّع اليوم');
  });
  it('flags "تقصير في الحفظ" when some pages but below target', () => {
    expect(struggleInfo(8, 12, false)).toEqual({ isStruggling: true, deficit: -4, cause: 'تقصير في الحفظ' });
  });
});

describe('nisabPeriodThreshold', () => {
  const THU = '2026-07-08'; // يوم عمل عادي (ليس جمعة)
  const FRI = '2026-07-10'; // جمعة (إجازة)
  it('morning = smaller half (flexible split)', () => {
    expect(nisabPeriodThreshold(30, 'morning', THU)).toBe(20);
    expect(nisabPeriodThreshold(20, 'morning', THU)).toBe(12);
    expect(nisabPeriodThreshold(10, 'morning', THU)).toBe(6);
    expect(nisabPeriodThreshold(5, 'morning', THU)).toBe(3);
  });
  it('evening = full daily نصاب (collective total by day end)', () => {
    expect(nisabPeriodThreshold(30, 'evening', THU)).toBe(40);
    expect(nisabPeriodThreshold(20, 'evening', THU)).toBe(25);
    expect(nisabPeriodThreshold(10, 'evening', THU)).toBe(12.5);
    expect(nisabPeriodThreshold(5, 'evening', THU)).toBe(6);
  });
  it('is 0 on Fridays for both periods (day off)', () => {
    expect(nisabPeriodThreshold(30, 'morning', FRI)).toBe(0);
    expect(nisabPeriodThreshold(30, 'evening', FRI)).toBe(0);
  });
  it('is 0 for branches with no نصاب', () => {
    expect(nisabPeriodThreshold(0, 'morning', THU)).toBe(0);
    expect(nisabPeriodThreshold(null, 'evening', THU)).toBe(0);
  });
});
