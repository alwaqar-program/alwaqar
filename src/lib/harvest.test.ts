import { describe, it, expect } from 'vitest';
import { splitHarvest } from './harvest';

const rows = (arr: { pages: number; circleId: string | null }[]) => arr;

describe('splitHarvest', () => {
  it('empty sponsorIds ⇒ الكل و«تابعة للحرم» متطابقان (لا حرم)', () => {
    const data = rows([
      { pages: 10, circleId: 'a' },
      { pages: 5, circleId: 'b' },
      { pages: 3, circleId: null },
    ]);
    const empty = new Set<string>();
    const all = splitHarvest(data, empty, 40, '');
    const regular = splitHarvest(data, empty, 40, 'regular');
    expect(all).toEqual({ completed: 18, required: 40 });
    expect(regular).toEqual({ completed: 18, required: 40 });
  });

  it('الكل: الحرم يرفع المنجز والمطلوب بالتساوي (الفجوة = فجوة العادية)', () => {
    const data = rows([
      { pages: 10, circleId: 'reg1' },
      { pages: 7, circleId: 'sp1' },
      { pages: 2, circleId: 'sp2' },
    ]);
    const sponsors = new Set(['sp1', 'sp2']); // sponsorPages = 9, regularPages = 10
    const all = splitHarvest(data, sponsors, 40, '');
    // completed = 10 + 9 = 19 ; required = 40 + 9 = 49
    expect(all).toEqual({ completed: 19, required: 49 });
    expect(all.required - all.completed).toBe(40 - 10);
  });

  it('«تابعة للحرم» تُسقط الحرم من المنجز والمطلوب', () => {
    const data = rows([
      { pages: 10, circleId: 'reg1' },
      { pages: 7, circleId: 'sp1' },
    ]);
    const sponsors = new Set(['sp1']);
    const regular = splitHarvest(data, sponsors, 40, 'regular');
    expect(regular).toEqual({ completed: 10, required: 40 });
  });

  it('«حلقاتنا» تعرض حلقات الحرم فقط، المطلوب = المنجز (نسبة ١٠٠٪)', () => {
    const data = rows([
      { pages: 10, circleId: 'reg1' },
      { pages: 7, circleId: 'sp1' },
      { pages: 2, circleId: 'sp2' },
    ]);
    const sponsors = new Set(['sp1', 'sp2']); // sponsorPages = 9
    const sponsor = splitHarvest(data, sponsors, 40, 'sponsor');
    expect(sponsor).toEqual({ completed: 9, required: 9 });
  });

  it('«حلقاتنا» بلا حلقات حرم ⇒ صفر (لا قسمة على صفر)', () => {
    const data = rows([{ pages: 10, circleId: 'reg1' }]);
    const sponsor = splitHarvest(data, new Set<string>(), 40, 'sponsor');
    expect(sponsor).toEqual({ completed: 0, required: 0 });
  });
});
