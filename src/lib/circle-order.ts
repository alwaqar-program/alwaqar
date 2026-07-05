// Fixed display order for the circles dropdown, requested by the program owner:
//   حلقة الوقار (1..15)  →  الإحسان  →  الإقراء  →  الأمهات  →  المبتدئ 1  →  المبتدئ 2
//
// Ordering is derived from the *content* of the name (not an exact string match)
// so it survives edits to a circle — e.g. changing the branch suffix or the
// digit/spacing style. الوقار circles are ranked by the number in parentheses;
// the tail circles are matched by keyword. Anything unrecognised falls to the
// end, ordered naturally by name.

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

// Fold Arabic-Indic digits → Latin, strip tashkeel/tatweel, collapse spaces,
// and normalise hamza/alef variants so keyword matching is robust.
function norm(s: string): string {
  return (s || '')
    .replace(/[٠-٩]/g, d => ARABIC_DIGITS[d] ?? d)
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rank a single circle. Lower rank sorts first; Infinity sorts last.
function rank(circleName: string): number {
  const n = norm(circleName);

  // حلقة الوقار (N) …  →  ranked 1..N by the parenthesised number.
  if (n.includes('الوقار')) {
    const m = n.match(/\((\d+)\)/) || n.match(/(\d+)/);
    if (m) return parseInt(m[1], 10); // 1..15 (and beyond if more are added)
  }

  // Tail circles — keyword matched, placed after all الوقار circles.
  if (n.includes('الاحسان')) return 1000;
  if (n.includes('الاقراء')) return 1001;
  if (n.includes('امهات')) return 1002;
  if (n.includes('مبتدئ') || n.includes('مبتدىٕ') || n.includes('مبتدي')) {
    const m = n.match(/(\d+)/);
    return 1010 + (m ? parseInt(m[1], 10) : 0);
  }

  return Infinity;
}

const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

/** Sort circles by the fixed program order; unknown circles go last (by name). */
export function sortCircles<T extends { circle_name: string }>(circles: T[]): T[] {
  return [...circles].sort((a, b) => {
    const ra = rank(a.circle_name);
    const rb = rank(b.circle_name);
    if (ra !== rb) return ra - rb;
    return collator.compare(a.circle_name, b.circle_name);
  });
}
