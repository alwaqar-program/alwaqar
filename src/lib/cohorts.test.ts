// src/lib/cohorts.test.ts
import { describe, it, expect } from 'vitest';
import {
  COHORTS, cohortTable, cohortSubjectColumn, cohortLabel, subjectPayload,
} from './cohorts';

describe('cohorts', () => {
  it('lists the three cohorts', () => {
    expect(COHORTS).toEqual(['student', 'companion', 'beginner']);
  });

  it('maps cohort to source table', () => {
    expect(cohortTable('student')).toBe('students');
    expect(cohortTable('companion')).toBe('companions');
    expect(cohortTable('beginner')).toBe('beginners');
  });

  it('maps cohort to subject column', () => {
    expect(cohortSubjectColumn('student')).toBe('student_id');
    expect(cohortSubjectColumn('companion')).toBe('companion_id');
    expect(cohortSubjectColumn('beginner')).toBe('beginner_id');
  });

  it('maps cohort to arabic label', () => {
    expect(cohortLabel('student')).toBe('طالبة');
    expect(cohortLabel('companion')).toBe('مرافقة');
    expect(cohortLabel('beginner')).toBe('مبتدئة');
  });

  it('builds an insert payload with only the matching subject id', () => {
    expect(subjectPayload('companion', 'abc')).toEqual({ companion_id: 'abc' });
    expect(subjectPayload('student', 'xyz')).toEqual({ student_id: 'xyz' });
  });
});
