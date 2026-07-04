# Companion & Beginner Attendance + Recitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins and teachers record attendance + recitation for companions (المرافقات) and beginners (المبتدئات) into the same tables as students, with a cohort switch for recording and a unified admin view.

**Architecture:** Extend `attendance` and `recitation_log` with `companion_id`/`beginner_id` subject columns (one-subject CHECK, per-cohort partial unique indexes). A shared `cohorts` helper maps a cohort to its table, subject column, and label. The existing six recording pages gain a cohort selector; loads and inserts are routed by cohort. Admin `/attendance` and `/recitation` show all cohorts unified with a type badge + filter.

**Tech Stack:** React + TypeScript (Vite), Supabase (Postgres + RLS), vitest + @testing-library/react.

**Conventions for this plan:**
- The offline environment cannot reach Supabase, so DB/RLS/UI behavior is verified by **`npm run build`** (tsc typecheck) per step plus a **manual staging acceptance** checklist (Task 8). Only the pure helper (Task 3) is unit-tested via vitest — that is the one true TDD task.
- All shell steps run from `/Users/randaalwassam/Desktop/Alwaqar/app` unless noted.
- Work happens on branch `feature/companion-beginner-recording` (already created).

---

## File structure

- **Create** `../32_companion_beginner_recording.sql` (repo root, next to other numbered migrations) — DB migration.
- **Create** `src/lib/cohorts.ts` — cohort→table/subject/label mapping + typed helpers.
- **Create** `src/lib/cohorts.test.ts` — unit tests for the helper.
- **Modify** `src/integrations/supabase/types.ts` — add `companion_id`/`beginner_id` to `attendance` and `recitation_log` types.
- **Modify** `src/pages/AttendancePage.tsx` — cohort switch + unified overview.
- **Modify** `src/pages/RecitationPage.tsx` — cohort switch + unified overview.
- **Modify** `src/pages/PublicAttendancePage.tsx`, `src/pages/teacher/TeacherAttendancePage.tsx` — cohort switch within circle.
- **Modify** `src/pages/PublicRecitationPage.tsx`, `src/pages/teacher/TeacherRecitationPage.tsx` — cohort switch within circle.

---

## Task 1: Database migration

**Files:**
- Create: `../32_companion_beginner_recording.sql` (i.e. `/Users/randaalwassam/Desktop/Alwaqar/32_companion_beginner_recording.sql`)

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- 32_companion_beginner_recording.sql
-- تسميع وحضور المرافقات والمبتدئات — أعمدة الفاعل في الجداول نفسها.
-- التاريخ: 2026-07-04
-- ============================================================
-- additive & idempotent. Run in test DB first, then prod.
-- ============================================================

-- ---------- attendance ----------
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES public.companions(id),
  ADD COLUMN IF NOT EXISTS beginner_id  UUID REFERENCES public.beginners(id);

ALTER TABLE public.attendance ALTER COLUMN student_id DROP NOT NULL;

-- drop the legacy UNIQUE(student_id,date,period) by discovered name (if present)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.attendance'::regclass AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(student_id, date, period)%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_subject_chk;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_subject_chk
  CHECK (num_nonnulls(student_id, companion_id, beginner_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_uk
  ON public.attendance (student_id, date, period)  WHERE student_id  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_companion_uk
  ON public.attendance (companion_id, date, period) WHERE companion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_beginner_uk
  ON public.attendance (beginner_id, date, period)  WHERE beginner_id  IS NOT NULL;

-- ---------- recitation_log ----------
-- reciter_id may or may not exist (19_tasmee_exams.sql partially applied) — add defensively.
ALTER TABLE public.recitation_log
  ADD COLUMN IF NOT EXISTS reciter_id   UUID,
  ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES public.companions(id),
  ADD COLUMN IF NOT EXISTS beginner_id  UUID REFERENCES public.beginners(id);

ALTER TABLE public.recitation_log ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.recitation_log DROP CONSTRAINT IF EXISTS recitation_subject_chk;
ALTER TABLE public.recitation_log ADD CONSTRAINT recitation_subject_chk
  CHECK (num_nonnulls(student_id, reciter_id, companion_id, beginner_id) = 1);

-- ---------- RLS: anon can list companions/beginners for the public teacher link ----------
-- (mirror 20_teacher_portal.sql, which added anon SELECT for students)
DROP POLICY IF EXISTS "Anon can view companions" ON public.companions;
CREATE POLICY "Anon can view companions" ON public.companions
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Anon can view beginners" ON public.beginners;
CREATE POLICY "Anon can view beginners" ON public.beginners
  FOR SELECT TO anon USING (true);

-- attendance/recitation_log anon INSERT policies are row-level and already exist for the
-- teacher portal; verify their WITH CHECK does not hard-require student_id. If it does,
-- replace with: WITH CHECK (num_nonnulls(student_id, companion_id, beginner_id) = 1)
-- (attendance) / (student_id, reciter_id, companion_id, beginner_id) = 1 (recitation_log).

-- ---------- verify ----------
SELECT 'attendance' AS tbl, column_name FROM information_schema.columns
  WHERE table_name='attendance' AND column_name IN ('companion_id','beginner_id')
UNION ALL
SELECT 'recitation_log', column_name FROM information_schema.columns
  WHERE table_name='recitation_log' AND column_name IN ('companion_id','beginner_id')
ORDER BY 1,2;
```

- [ ] **Step 2: Self-check the SQL**

Re-read the file. Confirm: every DDL is `IF [NOT] EXISTS`/guarded; the CHECK names match between DROP and ADD; the anon policies use `TO anon`. No app code depends on this yet, so nothing to build.

- [ ] **Step 3: Commit**

```bash
git add ../32_companion_beginner_recording.sql
git commit -m "feat(db): أعمدة المرافقات والمبتدئات في الحضور والتسميع (migration)"
```

- [ ] **Step 4: (owner, at rollout) run on test DB**

Run `32_companion_beginner_recording.sql` in the Supabase SQL editor of the **test** project (`vxnsetaximamuppowiqf`). Expected: the final SELECT returns 4 rows (companion_id/beginner_id on both tables). Inspect the anon INSERT policy `WITH CHECK` on `attendance` and `recitation_log`; relax per the comment if it references `student_id` directly.

---

## Task 2: Extend generated Supabase types

Offline we cannot run `supabase gen types`, so add the new columns by hand (matching the existing style in the file).

**Files:**
- Modify: `src/integrations/supabase/types.ts` (the `attendance` block ~lines 17–63 and `recitation_log` block ~lines 451–565)

- [ ] **Step 1: Add columns to the `attendance` Row/Insert/Update**

In each of the `attendance` `Row`, `Insert`, and `Update` objects, add these two lines next to `student_id` (Row uses `string | null`; Insert/Update use `string | null` and are optional with `?`):

```ts
          companion_id: string | null
          beginner_id: string | null
```
(For `Insert`/`Update`, write `companion_id?: string | null` and `beginner_id?: string | null`, and change `student_id: string` to `student_id?: string | null`.)

- [ ] **Step 2: Add columns to the `recitation_log` Row/Insert/Update**

Add to each of the three objects (`reciter_id` already present):
```ts
          companion_id: string | null
          beginner_id: string | null
```
(Insert/Update: append `?`.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): companion_id/beginner_id on attendance & recitation_log"
```

---

## Task 3: Shared cohort helper (TDD)

**Files:**
- Create: `src/lib/cohorts.ts`
- Test: `src/lib/cohorts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/cohorts.test.ts`
Expected: FAIL — cannot resolve `./cohorts`.

- [ ] **Step 3: Write the helper**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/cohorts.test.ts`
Expected: PASS (6 tests / 5 it-blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cohorts.ts src/lib/cohorts.test.ts
git commit -m "feat(lib): cohort helper for student/companion/beginner subjects"
```

---

## Task 4: Admin AttendancePage — cohort switch + unified overview

**Files:**
- Modify: `src/pages/AttendancePage.tsx`

Reference (current behavior): loads `students` in `loadStatic` (~line 80), loads `attendance` for a date in `loadDay` (~line 91), matches per student via `attFor` (~line 105), builds `overview` (~line 108), and inserts in `handleSaveEntries` (~line 176).

- [ ] **Step 1: Load all three cohorts as one people list**

Replace the `Student` interface with a `Person` that carries `kind`, and in `loadStatic` load all three tables and merge (companions `is_active` can be null — keep `!== false`):

```ts
import { Cohort, COHORTS, cohortLabel, COHORT_PLURAL, cohortSubjectColumn, subjectPayload } from '@/lib/cohorts';

interface Person { id: string; full_name: string; circle_id: string | null; kind: Cohort; }
```
```ts
const [people, setPeople] = useState<Person[]>([]);
// ...
const loadStatic = async () => {
  const [stRes, coRes, beRes, cRes] = await Promise.all([
    supabase.from('students').select('id, full_name, circle_id, is_active').eq('is_active', true).order('full_name'),
    supabase.from('companions').select('id, full_name, circle_id, is_active').order('full_name'),
    supabase.from('beginners').select('id, full_name, circle_id, is_active').order('full_name'),
    supabase.from('circles').select('id, circle_name').eq('is_active', true),
  ]);
  const merge = (rows: any[] | null, kind: Cohort): Person[] =>
    (rows || []).filter(r => r.is_active !== false)
      .map(r => ({ id: r.id, full_name: r.full_name, circle_id: r.circle_id, kind }));
  setPeople([
    ...merge(stRes.data, 'student'),
    ...merge(coRes.data, 'companion'),
    ...merge(beRes.data, 'beginner'),
  ]);
  setCircles(cRes.data || []);
};
```

- [ ] **Step 2: Match attendance by the right subject column**

Update `AttRow` to include all subjects, select them in `loadDay`, and match by kind:

```ts
interface AttRow {
  student_id: string | null; companion_id: string | null; beginner_id: string | null;
  status: string; period: string;
  late_reason: string | null; late_reason_other: string | null; recorded_by: string | null;
}
```
```ts
// in loadDay select:
.select('student_id, companion_id, beginner_id, status, period, late_reason, late_reason_other, recorded_by')
```
```ts
const attFor = (p: Person) =>
  attRows.find(a => (a as any)[cohortSubjectColumn(p.kind)] === p.id && a.period === period);
```

- [ ] **Step 3: Unified overview with cohort filter + type badge**

Add a `filterCohort` state (`'' | Cohort`), a filter control next to the circle filter, map `overview` from `people` (use `attFor(p)`), and add a `kind` to each overview row plus a type column/badge:

```ts
const [filterCohort, setFilterCohort] = useState<'' | Cohort>('');
```
In `overview` `useMemo`, start from `people`, add `.filter(p => !filterCohort || p.kind === filterCohort)`, keep circle/search filters, and include `kind: p.kind` and `kind_label: cohortLabel(p.kind)` in each row. Add a filter chip row:
```tsx
<div className="flex rounded-md border overflow-hidden text-sm">
  {(['', ...COHORTS] as const).map(k => (
    <button key={k || 'all'} type="button" onClick={() => setFilterCohort(k as '' | Cohort)}
      className={`px-3 h-10 ${filterCohort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
      {k === '' ? 'الكل' : COHORT_PLURAL[k as Cohort]}
    </button>
  ))}
</div>
```
Add a "الفئة" `<TableHead>` and a `<TableCell>` rendering `<Badge variant="secondary">{r.kind_label}</Badge>` (only when `r.kind !== 'student'`, to keep the students view familiar). Add `filterCohort` to the `overview` and page-reset dependency arrays.

- [ ] **Step 4: Entry dialog — cohort switch drives the recorded list**

Add an `entryCohort` state (default `'student'`). In the dialog, add the same cohort chip row (using `COHORT_PLURAL`) above the circle picker. Change `entryStudents` to filter `people` by `entryCohort` + `entryCircle`:
```ts
const [entryCohort, setEntryCohort] = useState<Cohort>('student');
const entryPeople = useMemo(
  () => people.filter(p => p.kind === entryCohort && p.circle_id === entryCircle),
  [people, entryCohort, entryCircle],
);
```
Rename `entryStudents` usages to `entryPeople`; the `entries` map remains keyed by person id. Update the `defaults` effect deps to include `entryCohort`.

- [ ] **Step 5: Insert with the right subject column**

In `handleSaveEntries`, replace `student_id: e.student_id` with the cohort subject via `subjectPayload`:
```ts
const { error } = await supabase.from('attendance').insert(
  toInsert.map(e => ({
    ...subjectPayload(entryCohort, e.student_id), // e.student_id holds the person id
    date, period, status: e.status,
    late_reason: e.status === 'late' ? e.late_reason : null,
    late_reason_other: e.status === 'late' && e.late_reason === 'other' ? e.late_reason_other : null,
    recorded_by: adminName,
  }))
);
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: exit 0. Fix any type errors (e.g. cast `(a as any)[col]`).

- [ ] **Step 7: Commit**

```bash
git add src/pages/AttendancePage.tsx
git commit -m "feat(attendance): cohort switch + unified companions/beginners view"
```

---

## Task 5: Admin RecitationPage — cohort switch + unified overview

**Files:**
- Modify: `src/pages/RecitationPage.tsx`

- [ ] **Step 1: Read the file end-to-end first**

Run: (open `src/pages/RecitationPage.tsx`) — note where it loads `students`, loads `recitation_log`/`attendance` for date+period, the نصاب/surah-range picker, and the `recitation_log` insert payload.

- [ ] **Step 2: Apply the same cohort transformation as Task 4**

Mirror Task 4 exactly, adapted to recitation:
- Load `students`+`companions`+`beginners` into one `Person[]` with `kind` (same `merge` helper).
- Add `filterCohort` (overview) + type badge/filter, and `entryCohort` for the entry flow.
- Match existing `recitation_log` rows by `cohortSubjectColumn(kind)` (add `companion_id, beginner_id` to the select and the row interface).
- Keep the absent-guard: read `attendance` by the same subject column and block recitation for an absent person, unchanged in logic.
- In the insert, replace `student_id: <id>` with `...subjectPayload(entryCohort, <id>)`. Leave `teacher_id`, `circle_id`, range, `error_count`, `lahn_count`, `thabit_confirmed`, `hifz_confirmed`, `recorded_by` as they are.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/pages/RecitationPage.tsx
git commit -m "feat(recitation): cohort switch + unified companions/beginners view"
```

---

## Task 6: Teacher/public Attendance — cohort switch within circle

**Files:**
- Modify: `src/pages/PublicAttendancePage.tsx`
- Modify: `src/pages/teacher/TeacherAttendancePage.tsx`

- [ ] **Step 1: Read both files**

Note how each resolves the teacher's circle(s) and loads `students` for the circle, and the `attendance` insert payload.

- [ ] **Step 2: Add cohort switch scoped to the resolved circle**

For each page:
- After the circle is resolved, load `companions` and `beginners` for that circle id (`.eq('circle_id', circleId)`) in addition to `students`, into one `Person[]` with `kind`.
- Add a cohort chip row (`COHORT_PLURAL`) that filters the recorded list to the selected cohort (default `student`).
- Match existing rows and insert using `cohortSubjectColumn` / `subjectPayload(cohort, id)` (same as Task 4 Step 5). Preserve `recorded_by` = teacher name and all existing validation.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PublicAttendancePage.tsx src/pages/teacher/TeacherAttendancePage.tsx
git commit -m "feat(portal): cohort switch for companions/beginners attendance"
```

---

## Task 7: Teacher/public Recitation — cohort switch within circle

**Files:**
- Modify: `src/pages/PublicRecitationPage.tsx`
- Modify: `src/pages/teacher/TeacherRecitationPage.tsx`

- [ ] **Step 1: Read both files**

Note circle resolution, student load, the نصاب/range picker, the absent-guard, and the `recitation_log` insert payload.

- [ ] **Step 2: Add cohort switch scoped to the resolved circle**

For each page:
- Load `companions` + `beginners` for the resolved circle alongside `students`, into `Person[]` with `kind`.
- Add the cohort chip row (default `student`).
- Match `recitation_log`/`attendance` rows by `cohortSubjectColumn(kind)`; keep the absent-before-recitation guard.
- Insert with `...subjectPayload(cohort, id)` replacing `student_id`; keep all other fields and `recorded_by` = teacher name.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PublicRecitationPage.tsx src/pages/teacher/TeacherRecitationPage.tsx
git commit -m "feat(portal): cohort switch for companions/beginners recitation"
```

---

## Task 8: Verify, deploy to staging, manual acceptance

- [ ] **Step 1: Full build + unit tests**

Run: `npm run build && npm test`
Expected: build exit 0; all tests pass.

- [ ] **Step 2: Merge feature branch into staging and push**

```bash
git checkout staging && git pull --ff-only origin staging
git merge --no-ff feature/companion-beginner-recording -m "Merge: companion/beginner attendance & recitation"
git push origin staging
git checkout feature/companion-beginner-recording
```

- [ ] **Step 3: Owner runs the migration on the test DB** (if not already done in Task 1 Step 4).

- [ ] **Step 4: Manual acceptance on `alwaqar-test.vercel.app`**

Verify each:
- Admin `/attendance`: cohort filter shows الكل/طالبات/مرافقات/مبتدئات; type badge on non-students; entry dialog cohort switch records a companion and a beginner; rows persist with correct subject.
- Admin `/recitation`: same, plus score/grade computed; cannot record recitation for an absent companion/beginner.
- Teacher/public link: a teacher sees companions/beginners of their circle under the cohort switch and can record attendance + recitation.
- Duplicate guard: re-recording the same person+date+period is prevented.
- Regression: all existing student flows behave exactly as before.

- [ ] **Step 5: On approval, deploy to prod**

Merge `staging` → `main`, push, and run `32_companion_beginner_recording.sql` on the prod DB (`nahtjfnwhgmiwclyckyi`) as part of the release.

---

## Self-review notes

- **Spec coverage:** data model (Task 1), types (Task 2), shared helper (Task 3), admin unified view + recording (Tasks 4–5), teacher/public link (Tasks 6–7), RLS anon read for companions/beginners (Task 1), rollout + acceptance (Task 8). Exams excluded per spec.
- **Type consistency:** `Cohort`, `cohortTable`, `cohortSubjectColumn`, `cohortLabel`, `COHORT_PLURAL`, `subjectPayload` are defined in Task 3 and used verbatim in Tasks 4–7.
- **Known offline limitation:** DB/RLS/UI verified by build + manual staging (documented above); only the pure helper is unit-tested.
