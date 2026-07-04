// src/lib/cohorts.ts
export type Cohort = 'student' | 'companion' | 'beginner';

export const COHORTS: Cohort[] = ['student', 'companion', 'beginner'];

const TABLE: Record<Cohort, 'students' | 'companions' | 'beginners'> = {
  student: 'students',
  companion: 'companions',
  beginner: 'beginners',
};

const SUBJECT: Record<Cohort, 'student_id' | 'companion_id' | 'beginner_id'> = {
  student: 'student_id',
  companion: 'companion_id',
  beginner: 'beginner_id',
};

const LABEL: Record<Cohort, string> = {
  student: 'طالبة',
  companion: 'مرافقة',
  beginner: 'مبتدئة',
};

// Plural labels for filter chips / headers.
export const COHORT_PLURAL: Record<Cohort, string> = {
  student: 'طالبات',
  companion: 'مرافقات',
  beginner: 'مبتدئات',
};

export const cohortTable = (c: Cohort) => TABLE[c];
export const cohortSubjectColumn = (c: Cohort) => SUBJECT[c];
export const cohortLabel = (c: Cohort) => LABEL[c];

// The subject fragment to spread into an attendance/recitation_log insert row.
export const subjectPayload = (c: Cohort, id: string): Record<string, string> => ({
  [SUBJECT[c]]: id,
});
