import type { ApplicantStatus, AgeCategory, Branch } from './supabase';

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
  rejected: 'مرفوضة',
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

export const STATUS_COLOR: Record<ApplicantStatus, string> = {
  incomplete: 'bg-slate-200 text-slate-700 ring-slate-300',
  registered: 'bg-slate-100 text-slate-800 ring-slate-200',
  validated: 'bg-sky-100 text-sky-800 ring-sky-200',
  hifz_waiting: 'bg-amber-100 text-amber-800 ring-amber-200',
  hifz_step2: 'bg-amber-100 text-amber-800 ring-amber-200',
  hifz_done: 'bg-orange-100 text-orange-800 ring-orange-200',
  tilawa_step: 'bg-orange-100 text-orange-800 ring-orange-200',
  tilawa_done: 'bg-orange-100 text-orange-800 ring-orange-200',
  interview_completed: 'bg-purple-100 text-purple-800 ring-purple-200',
  accepted: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
};

export const BRANCH_COLOR: Record<Branch, string> = {
  '5_juz': 'bg-blue-100 text-blue-800',
  '10_juz': 'bg-indigo-100 text-indigo-800',
  '20_juz': 'bg-violet-100 text-violet-800',
  '30_juz': 'bg-fuchsia-100 text-fuchsia-800',
};

export const AGE_COLOR: Record<AgeCategory, string> = {
  under_16: 'bg-pink-50 text-pink-700',
  '16_to_35': 'bg-teal-50 text-teal-700',
  over_35: 'bg-amber-50 text-amber-700',
};
