# Spec: Attendance & Recitation for Companions and Beginners

**Date:** 2026-07-04
**Status:** Approved (design)
**Author:** Owner + Claude

## Goal

Record **attendance (الحضور)** and **recitation (التسميع)** for two additional
cohorts — **companions (المرافقات)** and **beginners (المبتدئات)** — using the
same access model as students (authenticated admin app **and** the national-ID
gated teacher/public link). Records are written into the **same physical tables**
as students so the admin's existing `/attendance` and `/recitation` pages show
all three cohorts in one unified table.

**Explicitly out of scope:** exams (الاختبارات) stay students-only for now.

## Approach (approved)

- **One subject, three cohorts** in the existing tables — no parallel record
  tables. Mirrors the existing `recitation_log.reciter_id` pattern.
- **Cohort switch (approach A)** in the shared recording flows rather than
  duplicated per-cohort pages. Picking a cohort loads that cohort's list and
  routes writes to the matching subject column.

## Data model

### `attendance`
```sql
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES public.companions(id),
  ADD COLUMN IF NOT EXISTS beginner_id  UUID REFERENCES public.beginners(id);

-- allow a row to belong to a companion/beginner instead of a student
ALTER TABLE public.attendance ALTER COLUMN student_id DROP NOT NULL;

-- exactly one subject
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_subject_chk;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_subject_chk
  CHECK (num_nonnulls(student_id, companion_id, beginner_id) = 1);

-- one row per person per date+period (replace the old UNIQUE(student_id,date,period))
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_period_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_uk
  ON public.attendance (student_id, date, period)  WHERE student_id  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_companion_uk
  ON public.attendance (companion_id, date, period) WHERE companion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_beginner_uk
  ON public.attendance (beginner_id, date, period)  WHERE beginner_id  IS NOT NULL;
```
> The exact old unique constraint name will be resolved at migration time
> (`\d attendance`); the migration drops it by discovered name.

### `recitation_log`
```sql
ALTER TABLE public.recitation_log
  ADD COLUMN IF NOT EXISTS companion_id UUID REFERENCES public.companions(id),
  ADD COLUMN IF NOT EXISTS beginner_id  UUID REFERENCES public.beginners(id);

-- extend the existing one-subject check (currently student_id + reciter_id)
ALTER TABLE public.recitation_log DROP CONSTRAINT IF EXISTS recitation_subject_chk;
ALTER TABLE public.recitation_log ADD CONSTRAINT recitation_subject_chk
  CHECK (num_nonnulls(student_id, reciter_id, companion_id, beginner_id) = 1);
```
Generated `score` / `grade` and all recitation fields apply unchanged. No unique
constraint (multiple recitations per day are allowed).

### Idempotency / safety
- Migration is additive and re-runnable (`IF NOT EXISTS`, `IF EXISTS`).
- `19_tasmee_exams.sql` (which created `reciters` + `recitation_log.reciter_id`)
  appears only partially applied in test. The new migration must not assume it
  ran: guard the `recitation_subject_chk` rebuild so it works whether or not
  `reciter_id` exists (add `reciter_id` defensively if missing, or branch the
  check on column presence).

## Recording UI — cohort switch, shared plumbing

A cohort selector — **طالبات / مرافقات / مبتدئات** — is added to the recitation
and attendance flows. Selecting a cohort:
1. Loads that cohort's people (from `students` / `companions` / `beginners`),
   filtered by circle and search exactly as students are today.
2. Loads existing `attendance` / `recitation_log` rows for the date+period
   keyed by the matching subject column.
3. Writes rows with the matching subject column set (`student_id` /
   `companion_id` / `beginner_id`).

Applies to:
- **Admin**: `AttendancePage.tsx`, `RecitationPage.tsx`
- **Teacher/public**: the gated flow (`PublicAttendancePage`, `PublicRecitationPage`,
  `TeacherAttendancePage`, `TeacherRecitationPage`). The gate resolves the
  teacher → their circle(s); the cohort switch then lists companions/beginners
  **in that circle**.

Rules carried over unchanged, per cohort:
- Recitation cannot be recorded for someone marked absent that period.
- `recorded_by` attribution, soft-delete, period toggle.

### Shared helper
Introduce a small subject abstraction so the six pages don't fork logic:
```
type Cohort = 'student' | 'companion' | 'beginner';
COHORT_TABLE:   Cohort -> 'students' | 'companions' | 'beginners'
COHORT_SUBJECT: Cohort -> 'student_id' | 'companion_id' | 'beginner_id'
COHORT_LABEL:   Cohort -> 'طالبة' | 'مرافقة' | 'مبتدئة'
```
Load list, load existing records, and build the insert payload are parameterized
by `Cohort`. Kept in a shared module (e.g. `src/lib/cohorts.ts`) reused by admin
and portal pages.

## Admin unified view

`/attendance` and `/recitation` display all three cohorts together with a **type
badge** and a **cohort filter** (All / طالبات / مرافقات / مبتدئات). "Same table"
= same physical table + one combined admin list.

## RLS

Mirror the student policies for the new usage:
- `attendance` / `recitation_log`: existing admin/teacher/student_affairs/anon
  policies are row-level, so the new columns are covered; verify any anon
  INSERT `WITH CHECK` doesn't hard-reference `student_id` in a way that blocks
  companion/beginner rows — relax if it does.
- `companions` / `beginners`: currently **authenticated SELECT only**. Add
  **anon SELECT** (and any needed anon access) so the public teacher link can
  list them — same pattern `20_teacher_portal.sql` applied for students.

## Rollout

1. New SQL migration → run on **test DB** (`vxnsetaximamuppowiqf`) first.
2. Feature branch → **staging** (`alwaqar-test.vercel.app`) for owner testing.
3. Owner approval → merge to `main` → prod (`alwaqar.org`, `nahtjfnwhgmiwclyckyi`),
   running the SQL on prod as part of release.

## Testing / acceptance

- Admin can record attendance + recitation for a companion and a beginner; rows
  land with the correct subject column and correct generated score/grade.
- Partial unique indexes prevent duplicate person+date+period per cohort.
- Absent companion/beginner cannot get a recitation row that period.
- Teacher/public link: a teacher sees companions/beginners of their circle under
  the cohort switch and can record them.
- Admin `/attendance` and `/recitation` show all three cohorts with type badge
  and working cohort filter.
- All existing student flows behave exactly as before (regression).

## Out of scope

- Exams for companions/beginners.
- Changes to `reciters` / supervisor recitation.
- Any grouping/circle re-assignment logic (handled by the existing circles work).
