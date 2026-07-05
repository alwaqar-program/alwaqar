import { describe, it, expect } from 'vitest';
import { splitHarvest } from './harvest';

const rows = (arr: { pages: number; circleId: string | null }[]) => arr;

describe('splitHarvest', () => {
  it('empty sponsorIds ⇒ completed=Σall, required=regularRequired (legacy, both toggles identical)', () => {
    const data = rows([
      { pages: 10, circleId: 'a' },
      { pages: 5, circleId: 'b' },
      { pages: 3, circleId: null },
    ]);
    const empty = new Set<string>();
    const inc = splitHarvest(data, empty, 40, true);
    const exc = splitHarvest(data, empty, 40, false);
    expect(inc).toEqual({ completed: 18, required: 40 });
    expect(exc).toEqual({ completed: 18, required: 40 });
  });

  it('sponsor rows raise completed and required equally when includeHaram (gap unchanged vs regular-only)', () => {
    const data = rows([
      { pages: 10, circleId: 'reg1' },
      { pages: 7, circleId: 'sp1' },
      { pages: 2, circleId: 'sp2' },
    ]);
    const sponsors = new Set(['sp1', 'sp2']); // sponsorPages = 9, regularPages = 10
    const inc = splitHarvest(data, sponsors, 40, true);
    // completed = 10 + 9 = 19 ; required = 40 + 9 = 49
    expect(inc).toEqual({ completed: 19, required: 49 });
    // gap (required - completed) equals regular-only gap
    expect(inc.required - inc.completed).toBe(40 - 10);
  });

  it('sponsor slice is never negative and drives its slice to 100% (required grows with achievement)', () => {
    const data = rows([{ pages: 100, circleId: 'sp1' }]);
    const sponsors = new Set(['sp1']);
    const inc = splitHarvest(data, sponsors, 0, true);
    expect(inc.completed).toBe(100);
    expect(inc.required).toBe(100); // 0 regular + 100 sponsor
    expect(inc.required).toBeGreaterThanOrEqual(0);
  });

  it('includeHaram=false drops sponsor from both completed and required', () => {
    const data = rows([
      { pages: 10, circleId: 'reg1' },
      { pages: 7, circleId: 'sp1' },
    ]);
    const sponsors = new Set(['sp1']);
    const exc = splitHarvest(data, sponsors, 40, false);
    expect(exc).toEqual({ completed: 10, required: 40 });
  });
});
