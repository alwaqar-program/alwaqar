
-- Pledges table (التعهدات)
CREATE TABLE public.pledges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  pledge_type TEXT NOT NULL,
  pledge_text TEXT,
  signed BOOLEAN NOT NULL DEFAULT false,
  signed_date DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pledges" ON public.pledges FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Student affairs manage pledges" ON public.pledges FOR ALL TO authenticated USING (has_role(auth.uid(), 'student_affairs'::app_role));
CREATE POLICY "Authenticated view pledges" ON public.pledges FOR SELECT TO authenticated USING (true);

-- Violations table (المخالفات)
CREATE TABLE public.violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  description TEXT,
  action_taken TEXT,
  violation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage violations" ON public.violations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Student affairs manage violations" ON public.violations FOR ALL TO authenticated USING (has_role(auth.uid(), 'student_affairs'::app_role));
CREATE POLICY "Authenticated view violations" ON public.violations FOR SELECT TO authenticated USING (true);

-- Leave requests table (الاستئذان)
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  reason TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leave_requests" ON public.leave_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Student affairs manage leave_requests" ON public.leave_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'student_affairs'::app_role));
CREATE POLICY "Authenticated view leave_requests" ON public.leave_requests FOR SELECT TO authenticated USING (true);
