import type { Branch } from './applicant-labels';

export interface CommitteeMember {
  id: string;
  full_name: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export type HousingAnswer = 'shared' | 'private' | 'with_companions';
export type AbayaAnswer = 'warned_and_accepted' | 'not_accepted';
export type SeriousnessAnswer = 'serious' | 'not_serious';
export type ResultGrade = 'excellent' | 'very_good' | 'good' | 'acceptable' | 'weak';

export interface Interview {
  id: string;
  applicant_id: string;
  committee_member_id: string | null;
  committee_member_name: string | null;

  specialization: string | null;
  will_attend_full_course: boolean | null;
  accepts_shared_housing: HousingAnswer | null;
  shared_housing_details: string | null;
  companions_registered: boolean | null;
  companions_notes: string | null;

  abaya_status: AbayaAnswer | null;
  seriousness: SeriousnessAnswer | null;
  respects_rules: boolean | null;
  strengths: string | null;
  weaknesses: string | null;
  personal_notes: string | null;

  prior_preparation: boolean | null;
  requested_passage_change: boolean | null;
  errors_count: number;
  lahn_count: number;
  continuity_count: number;
  max_score: number;
  score: number | null;
  result: ResultGrade | null;
  exam_notes: string | null;

  created_at: string;
  updated_at: string;
}

// ---------- Labels ----------

export const HOUSING_AR: Record<HousingAnswer, string> = {
  shared: 'تقبل السكن المشترك',
  private: 'لا تقبل السكن المشترك',
  with_companions: 'معها مرافقات',
};

export const ABAYA_AR: Record<AbayaAnswer, string> = {
  warned_and_accepted: 'تم التنبيه والقبول',
  not_accepted: 'لم تقبل',
};

export const SERIOUSNESS_AR: Record<SeriousnessAnswer, string> = {
  serious: 'جادة',
  not_serious: 'غير جادة',
};

export const RESULT_AR: Record<ResultGrade, string> = {
  excellent: 'ممتاز',
  very_good: 'جيد جداً',
  good: 'جيد',
  acceptable: 'مقبول',
  weak: 'ضعيف',
};

export const RESULT_COLOR: Record<ResultGrade, string> = {
  excellent: 'bg-emerald-100 text-emerald-800',
  very_good: 'bg-sky-100 text-sky-800',
  good: 'bg-amber-100 text-amber-800',
  acceptable: 'bg-orange-100 text-orange-800',
  weak: 'bg-rose-100 text-rose-800',
};

// ---------- Scoring logic ----------

/**
 * المعيار: 20 جزء و 30 جزء → الدرجة من 30
 *          5 و 10 أجزاء   → الدرجة من 20
 */
export function getMaxScore(branch: Branch | null | undefined): number {
  if (branch === '20_juz' || branch === '30_juz') return 30;
  if (branch === '5_juz' || branch === '10_juz') return 20;
  return 30;
}

// خصم ثابت عند طلب تغيير المقطع (5 درجات مهما كان نصاب الفرع)
export const PASSAGE_CHANGE_PENALTY = 5;

/**
 * الدرجة = الحد الأقصى − الأخطاء − اللحون×½ − الترددات×¼ − (5 درجات إن طلبت تغيير المقطع)
 */
export function calculateScore(
  maxScore: number,
  errors: number,
  lahn: number,
  continuity: number,
  requestedPassageChange: boolean = false,
): number {
  const passageChangeDeduction = requestedPassageChange ? PASSAGE_CHANGE_PENALTY : 0;
  const raw = maxScore - errors - lahn * 0.5 - continuity * 0.25 - passageChangeDeduction;
  return Math.max(0, Number(raw.toFixed(2)));
}

/**
 * النتيجة بنسبة مئوية (تتسق مع كل من 20 و 30):
 *   ≥93.33% → ممتاز  (28+/30 أو 18.67+/20)
 *   ≥83.33% → جيد جداً (25+/30 أو 16.67+/20)
 *   ≥73.33% → جيد   (22+/30 أو 14.67+/20)
 *   ≥66.67% → مقبول (20+/30 أو 13.33+/20)
 *   <66.67% → ضعيف
 */
export function getResultGrade(score: number, maxScore: number): ResultGrade {
  if (maxScore <= 0) return 'weak';
  const pct = score / maxScore;
  if (pct >= 28 / 30) return 'excellent';
  if (pct >= 25 / 30) return 'very_good';
  if (pct >= 22 / 30) return 'good';
  if (pct >= 20 / 30) return 'acceptable';
  return 'weak';
}

/**
 * النسبة المئوية الموحّدة (للمقارنة العادلة بين كل الفروع):
 *   مثال: 15/20 = 75% ، 22/30 = 73.33%
 *
 * الفائدة: طالبة الـ 5 أجزاء وطالبة الـ 30 جزء يصيران قابلين للمقارنة
 *         على نفس المقياس بصرف النظر عن حجم نصابهما.
 */
export function getScorePercentage(score: number | null, maxScore: number): number | null {
  if (score == null || maxScore <= 0) return null;
  return Number(((score / maxScore) * 100).toFixed(1));
}
