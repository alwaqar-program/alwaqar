
-- Public registrations now arrive UNASSIGNED (no title); an admin assigns the
-- role later from the Staff page. More roles will be added over time.
-- This also tightens security: anonymous visitors can no longer self-assign
-- any privileged title — they may only insert rows with an empty title.

ALTER TABLE public.staff ALTER COLUMN title DROP NOT NULL;

DROP POLICY IF EXISTS "Public can self-register as housing supervisor" ON public.staff;

CREATE POLICY "Public can self-register (unassigned)" ON public.staff
  FOR INSERT TO anon
  WITH CHECK (title IS NULL);
