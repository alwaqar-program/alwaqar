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
  | 'conditionally_accepted'
  | 'rejected'
  | 'withdrew'
  | 'waitlist'
  | 'pledged'
  | 'deleted';

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
  acceptance_reasons: string | null;
  rejection_reasons: string | null;
  pledged_at: string | null;
  registered_at: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_AR: Record<ApplicantStatus, string> = {
  incomplete: 'بيانات ناقصة',
  registered: 'مسجلة',
  validated: 'تم التحقق',
  hifz_waiting: 'بانتظار اختبار الحفظ',
  hifz_step2: 'تقييم الحفظ',
  hifz_done: 'انتهت من اختبار الحفظ',
  tilawa_step: 'في اختبار التلاوة',
  tilawa_done: 'انتهت من التلاوة',
  interview_completed: 'تمت المقابلة',
  accepted: 'مقبولة',
  conditionally_accepted: 'مقبولة بشرط',
  rejected: 'مرفوضة',
  withdrew: 'منسحبة',
  waitlist: 'احتياط',
  pledged: 'تم الإقرار',
  deleted: 'محذوفة',
};

export const AGE_AR: Record<AgeCategory, string> = {
  under_16: 'أقل من 16',
  '16_to_35': '16 - 35',
  over_35: 'أعلى من 35',
};

export const BRANCH_AR: Record<Branch, string> = {
  '5_juz': '5 أجزاء',
  '10_juz': '10 أجزاء',
  '20_juz': '20 جزء',
  '30_juz': '30 جزء',
};

// Maps each status to a shadcn Badge variant
export function statusVariant(status: ApplicantStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
    case 'conditionally_accepted':
    case 'pledged':
      return 'default';
    case 'rejected':
    case 'incomplete':
    case 'deleted':
    case 'withdrew':
      return 'destructive';
    case 'interview_completed':
    case 'tilawa_done':
    case 'hifz_done':
    case 'waitlist':
      return 'secondary';
    default:
      return 'outline';
  }
}

// Activity log
export type LogAction = 'created' | 'updated' | 'status_changed' | 'deleted' | 'restored';

export interface ActivityLogEntry {
  id: string;
  applicant_id: string;
  action: LogAction;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  notes: string | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
}

export const ACTION_AR: Record<LogAction, string> = {
  created: 'إنشاء',
  updated: 'تعديل',
  status_changed: 'تغيير الحالة',
  deleted: 'حذف',
  restored: 'استرجاع',
};

// Human-readable field labels (for displaying changes in the log)
export const FIELD_AR: Record<string, string> = {
  full_name: 'الاسم الرباعي',
  name_en: 'الاسم بالإنجليزية',
  national_id: 'رقم الهوية',
  nationality: 'الجنسية',
  date_of_birth: 'تاريخ الميلاد',
  age: 'العمر',
  age_category: 'الفئة العمرية',
  phone: 'الجوال',
  guardian_phone: 'جوال ولي الأمر',
  email: 'البريد الإلكتروني',
  city: 'المدينة',
  qualification: 'المؤهل',
  institute_name: 'المعهد',
  institute_is_taallam: 'تابع لتعلَّم',
  nominator: 'اسم المُرشِّحة',
  memorized_juz_count: 'الأجزاء المحفوظة',
  from_surah: 'من سورة',
  to_surah: 'إلى سورة',
  desired_branch: 'الفرع المراد',
  curriculum_spec: 'المقرر',
  previously_joined: 'سبق الالتحاق',
  previous_branch: 'الفرع السابق',
  participation_type: 'نوع المشاركة',
  has_chronic_illness: 'مرض مزمن',
  illness_type: 'نوع المرض',
  has_companions: 'مرافقات',
  companions_details: 'بيانات المرافقات',
  accompanying_with: 'ترافق مع',
  notes: 'ملاحظات',
  status: 'الحالة',
  acceptance_reasons: 'مبررات القبول',
  rejection_reasons: 'مبررات الرفض',
};
