-- Supervisors now self-register with their own job title as FREE TEXT
-- (تسجيل مشرفات الوقار). The earlier "unassigned / title IS NULL" approach is
-- replaced: every public registration must carry a non-null title, which an
-- admin can later normalise to a standard role from the Staff page.
--
-- staff.title is a descriptive label only; it does NOT grant any application
-- privileges (those come from auth users + roles), so allowing anon visitors
-- to set it freely is not a privilege escalation.

-- Drop the CHECK constraint that limited title to a fixed set of role keys,
-- so any free-text job title is accepted (from both the public registration
-- form and the admin Staff page).
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_title_check;

-- Replace whichever anon insert policy is currently live (either the original
-- housing_supervisor-only check or the later title-IS-NULL check).
DROP POLICY IF EXISTS "Public can self-register as housing supervisor" ON public.staff;
DROP POLICY IF EXISTS "Public can self-register (unassigned)" ON public.staff;
DROP POLICY IF EXISTS "Public can self-register (free-text title)" ON public.staff;

CREATE POLICY "Public can self-register (free-text title)" ON public.staff
  FOR INSERT TO anon
  WITH CHECK (title IS NOT NULL);
