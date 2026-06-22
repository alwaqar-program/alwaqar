import { supabase } from '@/integrations/supabase/client';
import { Applicant } from './applicant-labels';

// ---------- حالة السداد المشتقة من أعمدة المتقدمة ----------

export type PaymentState =
  | 'none' | 'pending_review' | 'verified' | 'receipt_rejected'
  | 'special_waqar' | 'special_non_waqar';

export function getPaymentState(a: Applicant): PaymentState {
  // الحالة الخاصة (تُعيَّن يدوياً) تتقدّم على الحالة المشتقة
  if (a.payment_special_status === 'waqar') return 'special_waqar';
  if (a.payment_special_status === 'non_waqar') return 'special_non_waqar';
  if (a.payment_verified_at) return 'verified';
  if (a.payment_rejection_reason) return 'receipt_rejected';
  if (a.payment_submitted_at) return 'pending_review';
  return 'none';
}

export const PAYMENT_STATE_AR: Record<PaymentState, string> = {
  none: 'لم تسدد',
  pending_review: 'بانتظار التحقق',
  verified: 'مسددة',
  receipt_rejected: 'إيصال مرفوض',
  special_waqar: 'خاص (تابع للوقار)',
  special_non_waqar: 'خاص (غير تابع للوقار)',
};

export type PaymentSpecialStatus = 'waqar' | 'non_waqar';

// السداد متاح لجميع الحالات ما عدا المرفوضات والمحذوفات
export function isPayableStatus(status: string): boolean {
  return status !== 'rejected' && status !== 'deleted';
}

// ---------- صفحة الطالبة العامة ----------

/**
 * يبحث برقم الهوية ويعيد السجل فقط إن كانت الحالة تسمح بالسداد
 * (الجميع عدا المرفوضات والمحذوفات). يعيد null في كل الحالات
 * الأخرى بدون كشف تفاصيل الحالة.
 */
export async function findPayableApplicant(
  nationalId: string
): Promise<{ data: Applicant | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('applicants')
    .select('*')
    .eq('national_id', nationalId.trim())
    .not('status', 'in', '(rejected,deleted)')
    .order('submission_number', { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) return { data: null, error: error.message };
  const row = Array.isArray(data) && data.length > 0 ? (data[0] as Applicant) : null;
  return { data: row, error: null };
}

/**
 * رفع الإيصال ثم حفظ بيانات السداد. يصفّر سبب الرفض السابق
 * (إن وجد) حتى تعود الحالة إلى "بانتظار التحقق" بعد إعادة الرفع.
 */
export async function submitPayment(
  applicantId: string,
  paidAmount: number,
  file: File,
  installmentsCount: number | null = null
): Promise<{ error: string | null }> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${applicantId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('applicants')
    .update({
      payment_paid_amount: paidAmount,
      payment_receipt_path: path,
      payment_submitted_at: now,
      payment_rejection_reason: null,
      payment_installments_count: installmentsCount,
    })
    .eq('id', applicantId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { payment_submitted_at: { old: null, new: now } },
    notes: installmentsCount
      ? `تأكيد سداد ذاتي عبر النموذج العام (المبلغ: ${paidAmount} — تقسيط على ${installmentsCount} دفعات)`
      : `تأكيد سداد ذاتي عبر النموذج العام (المبلغ: ${paidAmount})`,
    actor_id: null,
    actor_email: 'payment_form@self',
  });

  return { error: null };
}

// ---------- جهة الإدارة ----------

async function getActor() {
  const { data } = await supabase.auth.getUser();
  return {
    actor_id: data.user?.id ?? null,
    actor_email: data.user?.email ?? null,
  };
}

export async function verifyPayment(applicantId: string): Promise<{ error: string | null }> {
  const actor = await getActor();
  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('applicants')
    .update({
      payment_verified_at: now,
      payment_verified_by: actor.actor_email,
      payment_rejection_reason: null,
    })
    .eq('id', applicantId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { payment_verified_at: { old: null, new: now } },
    notes: 'اعتماد السداد',
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}

export async function rejectReceipt(
  applicantId: string,
  reason: string
): Promise<{ error: string | null }> {
  const actor = await getActor();
  const { error } = await (supabase as any)
    .from('applicants')
    .update({ payment_rejection_reason: reason })
    .eq('id', applicantId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { payment_rejection_reason: { old: null, new: reason } },
    notes: 'رفض إيصال السداد',
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}

export async function updateDueAmount(
  applicantId: string,
  oldAmount: number | null,
  newAmount: number
): Promise<{ error: string | null }> {
  const actor = await getActor();
  const { error } = await (supabase as any)
    .from('applicants')
    .update({ payment_due_amount: newAmount })
    .eq('id', applicantId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { payment_due_amount: { old: oldAmount, new: newAmount } },
    notes: 'تعديل المبلغ المطلوب',
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}

/**
 * تعيين/إلغاء حالة السداد الخاصة يدوياً (لا يوجد مسار تلقائي).
 * value = null يلغي الحالة الخاصة ويعيد السداد لحالته المشتقة.
 */
export async function setPaymentSpecialStatus(
  applicantId: string,
  value: PaymentSpecialStatus | null,
  oldValue: string | null
): Promise<{ error: string | null }> {
  const actor = await getActor();
  const { error } = await (supabase as any)
    .from('applicants')
    .update({ payment_special_status: value })
    .eq('id', applicantId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    changes: { payment_special_status: { old: oldValue, new: value } },
    notes:
      value === 'waqar' ? 'تعيين حالة السداد: خاص (تابع للوقار)'
      : value === 'non_waqar' ? 'تعيين حالة السداد: خاص (غير تابع للوقار)'
      : 'إلغاء حالة السداد الخاصة',
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}

/** رابط موقّع مؤقت لعرض الإيصال (للمشرفات المسجلات فقط). */
export async function getReceiptUrl(
  path: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from('payment-receipts')
    .createSignedUrl(path, 60 * 5);
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}
