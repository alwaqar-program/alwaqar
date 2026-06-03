
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student_affairs', 'housing_supervisor', 'observer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Branches
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_name TEXT NOT NULL,
  juz_count INTEGER NOT NULL DEFAULT 0,
  expected_daily_pages NUMERIC(4,1) NOT NULL DEFAULT 3,
  program_start_date DATE,
  program_end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage branches" ON public.branches
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Circles
CREATE TABLE public.circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('morning', 'evening')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view circles" ON public.circles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage circles" ON public.circles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Teachers
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  teacher_name TEXT NOT NULL,
  national_id TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  registration_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view teachers" ON public.teachers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage teachers" ON public.teachers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Teacher Assignments
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.teachers(id) NOT NULL,
  circle_id UUID REFERENCES public.circles(id) NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view assignments" ON public.teacher_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage assignments" ON public.teacher_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  staff_name TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,
  title TEXT NOT NULL CHECK (title IN ('housing_supervisor', 'student_affairs', 'admin_staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view staff" ON public.staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage staff" ON public.staff
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL,
  building TEXT,
  capacity INTEGER NOT NULL DEFAULT 4,
  supervisor_id UUID REFERENCES public.staff(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view rooms" ON public.rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rooms" ON public.rooms
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Mushaf Reference
CREATE TABLE public.mushaf_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surah_number INTEGER NOT NULL CHECK (surah_number BETWEEN 1 AND 114),
  surah_name TEXT NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 604),
  verse_start INTEGER NOT NULL,
  verse_end INTEGER NOT NULL,
  juz_number INTEGER NOT NULL CHECK (juz_number BETWEEN 1 AND 30),
  hizb_number INTEGER NOT NULL CHECK (hizb_number BETWEEN 1 AND 60),
  position_label TEXT CHECK (position_label IN ('top', 'middle', 'bottom')),
  sort_order INTEGER NOT NULL,
  cumulative_completion_pct NUMERIC(5,2)
);
ALTER TABLE public.mushaf_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view mushaf" ON public.mushaf_reference
  FOR SELECT TO authenticated USING (true);

-- Branch Juz Assignments
CREATE TABLE public.branch_juz (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  juz_number INTEGER NOT NULL CHECK (juz_number BETWEEN 1 AND 30),
  juz_name TEXT,
  from_page INTEGER NOT NULL,
  to_page INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (branch_id, juz_number)
);
ALTER TABLE public.branch_juz ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view branch_juz" ON public.branch_juz
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage branch_juz" ON public.branch_juz
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  national_id TEXT,
  nationality TEXT,
  phone TEXT,
  email TEXT,
  guardian_phone TEXT,
  qualification TEXT,
  circle_id UUID REFERENCES public.circles(id),
  room_id UUID REFERENCES public.rooms(id),
  admission_status TEXT NOT NULL DEFAULT 'candidate' CHECK (admission_status IN (
    'candidate', 'interview_scheduled', 'preliminary_accepted', 'preliminary_evaluation',
    'conditionally_accepted', 'on_hold', 'final_accepted', 'final_evaluation',
    'registered', 'withdrawn', 'expelled', 'rejected'
  )),
  registration_source TEXT CHECK (registration_source IN ('form', 'direct', 'transfer')),
  registration_date DATE DEFAULT CURRENT_DATE,
  agreement_signed BOOLEAN DEFAULT false,
  agreement_date DATE,
  memorization_start_page INTEGER,
  housing_type TEXT CHECK (housing_type IN ('internal', 'external')),
  has_companions BOOLEAN DEFAULT false,
  companion_count_children INTEGER DEFAULT 0,
  companion_count_adults INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view students" ON public.students
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage students" ON public.students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Student affairs manage students" ON public.students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'student_affairs'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_circles_updated_at BEFORE UPDATE ON public.circles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
