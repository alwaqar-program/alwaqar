
-- Recitation Log
CREATE TABLE public.recitation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) NOT NULL,
  circle_id UUID REFERENCES public.circles(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period TEXT NOT NULL CHECK (period IN ('morning', 'evening')),
  from_surah TEXT,
  from_verse INTEGER,
  from_page INTEGER,
  to_surah TEXT,
  to_verse INTEGER,
  to_page INTEGER,
  from_sort_order INTEGER,
  to_sort_order INTEGER,
  is_extra_memorization BOOLEAN DEFAULT false,
  error_count INTEGER NOT NULL DEFAULT 0,
  grade TEXT GENERATED ALWAYS AS (
    CASE
      WHEN error_count = 0 THEN 'ممتاز'
      WHEN error_count <= 2 THEN 'جيد جداً'
      WHEN error_count <= 4 THEN 'جيد'
      WHEN error_count <= 6 THEN 'مقبول'
      ELSE 'ضعيف'
    END
  ) STORED,
  pages_recited NUMERIC(5,1) GENERATED ALWAYS AS (
    CASE WHEN to_page IS NOT NULL AND from_page IS NOT NULL THEN (to_page - from_page + 1)::NUMERIC ELSE 0 END
  ) STORED,
  is_deleted BOOLEAN DEFAULT false,
  deleted_by TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recitation_student_date ON public.recitation_log(student_id, date);
CREATE INDEX idx_recitation_circle_date ON public.recitation_log(circle_id, date);

ALTER TABLE public.recitation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view recitations" ON public.recitation_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage recitations" ON public.recitation_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can insert recitations" ON public.recitation_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers can update recitations" ON public.recitation_log
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period TEXT NOT NULL CHECK (period IN ('morning', 'evening')),
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  late_reason TEXT CHECK (late_reason IN ('illness', 'transport', 'sleep', 'other')),
  late_reason_other TEXT,
  recorded_by TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date, period)
);

CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX idx_attendance_date_period ON public.attendance(date, period);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendance" ON public.attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage attendance" ON public.attendance
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Student affairs manage attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'student_affairs'));
CREATE POLICY "Student affairs update attendance" ON public.attendance
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'student_affairs'));
CREATE POLICY "Teachers can insert attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- Exams
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('quarter', 'half', 'complete')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  errors_section_1 INTEGER DEFAULT 0,
  errors_section_2 INTEGER DEFAULT 0,
  errors_section_3 INTEGER DEFAULT 0,
  total_errors INTEGER GENERATED ALWAYS AS (
    COALESCE(errors_section_1, 0) + COALESCE(errors_section_2, 0) + COALESCE(errors_section_3, 0)
  ) STORED,
  total_score NUMERIC(5,2) GENERATED ALWAYS AS (
    GREATEST(0, 100 - (COALESCE(errors_section_1, 0) + COALESCE(errors_section_2, 0) + COALESCE(errors_section_3, 0)) * 2)
  ) STORED,
  examiner_name TEXT,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, exam_type)
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exams" ON public.exams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exams" ON public.exams
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can insert exams" ON public.exams
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- Evaluations (Interviews & Assessments)
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('interview', 'preliminary_evaluation', 'final_evaluation')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  evaluator_name TEXT,
  score NUMERIC(5,2),
  result TEXT CHECK (result IN ('pass', 'fail', 'conditional')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view evaluations" ON public.evaluations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage evaluations" ON public.evaluations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Student affairs manage evaluations" ON public.evaluations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'student_affairs'));
