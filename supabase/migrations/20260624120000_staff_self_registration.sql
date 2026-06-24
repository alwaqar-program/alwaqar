
-- Public self-registration fields for housing supervisors (تسجيل مشرفات الوقار)
ALTER TABLE public.staff
  ADD COLUMN email TEXT,
  ADD COLUMN has_companions BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN companions_details TEXT,
  ADD COLUMN notes TEXT;

-- Allow the public registration form (anonymous visitors) to insert
-- themselves as a housing supervisor. Read/update/delete stay admin-only
-- via the existing "Authenticated can view staff" / "Admins manage staff" policies.
CREATE POLICY "Public can self-register as housing supervisor" ON public.staff
  FOR INSERT TO anon
  WITH CHECK (title = 'housing_supervisor');
