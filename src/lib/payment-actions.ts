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

// ---------- الدفعات الإضافية (التقسيط) ----------

export interface PaymentInstallment {
  id: string;
  applicant_id: string;
  payment_number: number;
  amount: number;
  receipt_path: string;
  submitted_at: string;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export type InstallmentStatus = 'pending' | 'verified' | 'rejected';

export function installmentStatus(i: {
  verified_at: string | null;
  rejection_reason: string | null;
}): InstallmentStatus {
  if (i.verified_at) return 'verified';
  if (i.rejection_reason) return 'rejected';
  return 'pending';
}

export const INSTALLMENT_STATUS_AR: Record<InstallmentStatus, string> = {
  pending: 'بانتظار التحقق',
  verified: 'مُعتمدة',
  rejected: 'مرفوضة',
};

/** هل اختارت الطالبة السداد بالتقسيط؟ */
export function isInstallmentPlan(a: Applicant): boolean {
  return a.payment_installments_count != null && a.payment_installments_count > 1;
}

/** مجموع الدفعات المعتمدة (الدفعة الأولى من سجل المتقدمة + الدفعات الإضافية). */
export function verifiedTotal(a: Applicant, installments: PaymentInstallment[]): number {
  let total = 0;
  if (a.payment_verified_at && a.payment_paid_amount != null) total += a.payment_paid_amount;
  for (const i of installments) if (i.verified_at) total += i.amount;
  return total;
}

/** مجموع الدفعات المُرسَلة وغير المرفوضة (لاحتساب المتبقّي). */
export function submittedTotal(a: Applicant, installments: PaymentInstallment[]): number {
  let total = 0;
  if (a.payment_submitted_at && !a.payment_rejection_reason && a.payment_paid_amount != null) {
    total += a.payment_paid_amount;
  }
  for (const i of installments) if (!i.rejection_reason && i.amount != null) total += i.amount;
  return total;
}

/** اكتمل السداد عندما يبلغ مجموع الدفعات المعتمدة المبلغ المطلوب. */
export function isFullyPaid(a: Applicant, installments: PaymentInstallment[]): boolean {
  if (a.payment_due_amount == null) return false;
  return verifiedTotal(a, installments) >= a.payment_due_amount;
}

export async function getInstallments(applicantId: string): Promise<PaymentInstallment[]> {
  const { data } = await (supabase as any)
    .from('payment_installments')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('payment_number', { ascending: true });
  return (data ?? []) as PaymentInstallment[];
}

/**
 * إرسال دفعة إضافية (الدفعة الثانية فأكثر) عبر النموذج العام.
 * الدفعة الأولى تبقى على سجل المتقدمة؛ هذه تُضاف كصف مستقل.
 */
export async function submitNextInstallment(
  applicantId: string,
  paymentNumber: number,
  amount: number,
  file: File
): Promise<{ error: string | null }> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${applicantId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('payment_installments')
    .insert({
      applicant_id: applicantId,
      payment_number: paymentNumber,
      amount,
      receipt_path: path,
      submitted_at: now,
    });
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    notes: `تأكيد سداد الدفعة رقم ${paymentNumber} عبر النموذج العام (المبلغ: ${amount})`,
    actor_id: null,
    actor_email: 'payment_form@self',
  });
  return { error: null };
}

/** إعادة رفع إيصال دفعة إضافية مرفوضة (يُصفّر سبب الرفض). */
export async function resubmitInstallment(
  installmentId: string,
  applicantId: string,
  paymentNumber: number,
  amount: number,
  file: File
): Promise<{ error: string | null }> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${applicantId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('payment_installments')
    .update({ amount, receipt_path: path, submitted_at: now, rejection_reason: null })
    .eq('id', installmentId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    notes: `إعادة رفع إيصال الدفعة رقم ${paymentNumber} عبر النموذج العام (المبلغ: ${amount})`,
    actor_id: null,
    actor_email: 'payment_form@self',
  });
  return { error: null };
}

export async function verifyInstallment(
  installmentId: string,
  applicantId: string,
  paymentNumber: number
): Promise<{ error: string | null }> {
  const actor = await getActor();
  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from('payment_installments')
    .update({ verified_at: now, verified_by: actor.actor_email, rejection_reason: null })
    .eq('id', installmentId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    notes: `اعتماد سداد الدفعة رقم ${paymentNumber}`,
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}

export async function rejectInstallment(
  installmentId: string,
  applicantId: string,
  paymentNumber: number,
  reason: string
): Promise<{ error: string | null }> {
  const actor = await getActor();
  const { error } = await (supabase as any)
    .from('payment_installments')
    .update({ rejection_reason: reason, verified_at: null, verified_by: null })
    .eq('id', installmentId);
  if (error) return { error: error.message };

  await (supabase as any).from('applicant_activity_log').insert({
    applicant_id: applicantId,
    action: 'updated',
    notes: `رفض إيصال الدفعة رقم ${paymentNumber}`,
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
  });
  return { error: null };
}
