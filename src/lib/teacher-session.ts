import { supabase } from '@/integrations/supabase/client';

export type Period = 'morning' | 'evening';
export const PERIOD_LABEL: Record<Period, string> = { morning: 'صباحي', evening: 'مسائي' };

export interface TeacherInfo {
  id: string;
  teacher_name: string;
  national_id: string | null;
}

export interface TeacherCircle {
  id: string;
  circle_name: string;
  branch_id: string | null;
  /** Periods this teacher covers on this circle (from her active assignments). */
  periods: Period[];
}

export interface StudentLite {
  id: string;
  full_name: string;
  from_surah: string | null; // نطاق حفظ الطالبة (يقيّد التسميع)
  to_surah: string | null;
}

export interface TeacherLookupResult {
  teacher: TeacherInfo;
  circles: TeacherCircle[];
}

// Normalise a typed national id (strip spaces / Arabic-Indic digits).
export function normalizeNationalId(raw: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return raw.trim().replace(/[٠-٩]/g, d => map[d] ?? d).replace(/\s+/g, '');
}

function expandPeriods(assignmentPeriod: string | null): Period[] {
  if (assignmentPeriod === 'morning') return ['morning'];
  if (assignmentPeriod === 'evening') return ['evening'];
  // 'both' or null (legacy) → covers both periods
  return ['morning', 'evening'];
}

/**
 * Resolve a teacher from her national id, with the active circle(s) she is
 * assigned to and the period(s) she covers on each. Returns null if no active
 * teacher matches the id.
 */
export async function lookupTeacherByNationalId(
  rawId: string,
): Promise<TeacherLookupResult | null> {
  const nationalId = normalizeNationalId(rawId);
  if (!nationalId) return null;

  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, teacher_name, national_id')
    .eq('national_id', nationalId)
    .eq('is_active', true)
    .limit(1);
  if (error) throw error;
  const teacher = teachers?.[0];
  if (!teacher) return null;

  const { data: assignments, error: aErr } = await supabase
    .from('teacher_assignments')
    .select('circle_id, period, circles(id, circle_name, branch_id, is_active)')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true);
  if (aErr) throw aErr;

  // Group assignments by circle, unioning their periods.
  const byCircle = new Map<string, TeacherCircle>();
  for (const a of assignments || []) {
    const c = (a as any).circles;
    if (!c || c.is_active === false) continue;
    const existing = byCircle.get(c.id);
    const periods = expandPeriods((a as any).period);
    if (existing) {
      existing.periods = Array.from(new Set([...existing.periods, ...periods])) as Period[];
    } else {
      byCircle.set(c.id, {
        id: c.id,
        circle_name: c.circle_name,
        branch_id: c.branch_id ?? null,
        periods,
      });
    }
  }

  return {
    teacher: { id: teacher.id, teacher_name: teacher.teacher_name, national_id: teacher.national_id },
    circles: Array.from(byCircle.values()),
  };
}

/** Active, registered students of a circle. */
export async function loadCircleStudents(circleId: string): Promise<StudentLite[]> {
  const { data } = await supabase
    .from('students')
    .select('id, full_name, from_surah, to_surah')
    .eq('circle_id', circleId)
    .eq('is_active', true)
    .eq('admission_status', 'registered')
    .order('full_name');
  return data || [];
}
