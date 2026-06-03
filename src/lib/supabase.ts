import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase env vars. Check .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type ApplicantStatus =
  | 'incomplete'
  | 'registered'
  | 'validated'
  | 'hifz_waiting'
  | 'hifz_step2'
  | 'hifz_done'
  | 'tilawa_step'
  | 'tilawa_done'
  | 'interview_completed'
  | 'accepted'
  | 'rejected';

export type AgeCategory = 'under_16' | '16_to_35' | 'over_35';
export type Branch = '5_juz' | '10_juz' | '20_juz' | '30_juz';

export interface Applicant {
  id: string;
  submission_id: string | null;
  submission_number: number | null;
  full_name: string | null;
  name_en: string | null;
  national_id: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  age: number | null;
  age_category: AgeCategory | null;
  phone: string | null;
  guardian_phone: string | null;
  email: string | null;
  city: string | null;
  qualification: string | null;
  institute_name: string | null;
  institute_is_taallam: boolean | null;
  nominator: string | null;
  memorized_juz_count: number | null;
  from_surah: string | null;
  to_surah: string | null;
  desired_branch: Branch | null;
  curriculum_spec: string | null;
  previously_joined: boolean | null;
  previous_branch: string | null;
  participation_type: string | null;
  has_chronic_illness: boolean | null;
  illness_type: string | null;
  has_companions: boolean | null;
  companions_details: string | null;
  accompanying_with: string | null;
  notes: string | null;
  status: ApplicantStatus;
  created_at: string;
  updated_at: string;
}
