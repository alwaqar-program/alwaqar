import { describe, it, expect } from 'vitest';
import { splitHarvest } from './harvest';

const rows = (arr: { pages: number; sponsor: boolean }[]) => arr;

describe('splitHarvest', () => {
  it('لا حرم ⇒ الكل و«تابعة للحرم» متطابقان', () => {
    const data = rows([
      { pages: 10, sponsor: false },
      { pages: 5, sponsor: false },
      { pages: 3, sponsor: false },
    ]);
    expect(splitHarvest(data, 40, '')).toEqual({ completed: 18, required: 40 });
    expect(splitHarvest(data, 40, 'regular')).toEqual({ completed: 18, required: 40 });
  });

  it('الكل: الحرم يرفع المنجز والمطلوب بالتساوي (الفجوة = فجوة العادية)', () => {
    const data = rows([
      { pages: 10, sponsor: false },
      { pages: 7, sponsor: true },
      { pages: 2, sponsor: true },
    ]); // sponsorPages = 9, regularPages = 10
    const all = splitHarvest(data, 40, '');
    expect(all).toEqual({ completed: 19, required: 49 });
    expect(all.required - all.completed).toBe(40 - 10);
  });

  it('«تابعة للحرم» تُسقط الحرم من المنجز والمطلوب', () => {
    const data = rows([
      { pages: 10, sponsor: false },
      { pages: 7, sponsor: true },
    ]);
    expect(splitHarvest(data, 40, 'regular')).toEqual({ completed: 10, required: 40 });
  });

  it('«حلقاتنا» تعرض حلقات الحرم فقط، المطلوب = المنجز (نسبة ١٠٠٪)', () => {
    const data = rows([
      { pages: 10, sponsor: false },
      { pages: 7, sponsor: true },
      { pages: 2, sponsor: true },
    ]); // sponsorPages = 9
    expect(splitHarvest(data, 40, 'sponsor')).toEqual({ completed: 9, required: 9 });
  });

  it('«حلقاتنا» بلا حلقات حرم ⇒ صفر (لا قسمة على صفر)', () => {
    const data = rows([{ pages: 10, sponsor: false }]);
    expect(splitHarvest(data, 40, 'sponsor')).toEqual({ completed: 0, required: 0 });
  });
});
