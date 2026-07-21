import { supabase } from '@/integrations/supabase/client';

// سداد المشرفات/المنسوبات عبر الرابط العام /staff-payment.
// مثل سداد الطالبات (payment-actions.ts) لكن أبسط: لا مبلغ مطلوب ولا تقسيط —
// كل مشرفة تحوّل المبلغ الذي تريده وترفع الإيصال مرة واحدة.

export interface StaffPaymentRecord {
  id: string;
  staff_name: string;
  national_id: string | null;
  payment_paid_amount: number | null;
  payment_receipt_path: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_verified_by: string | null;
  payment_rejection_reason: string | null;
}

export type StaffPaymentState = 'none' | 'pending_review' | 'verified' | 'receipt_rejected';

export function getStaffPaymentState(s: StaffPaymentRecord): StaffPaymentState {
  if (s.payment_verified_at) return 'verified';
  if (s.payment_rejection_reason) return 'receipt_rejected';
  if (s.payment_submitted_at) return 'pending_review';
  return 'none';
}

/** يبحث عن المشرفة برقم الهوية (النشطات فقط). يعيد null إن لم توجد. */
export async function findPayableStaff(
  nationalId: string
): Promise<{ data: StaffPaymentRecord | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from('staff')
    .select('id, staff_name, national_id, payment_paid_amount, payment_receipt_path, payment_submitted_at, payment_verified_at, payment_verified_by, payment_rejection_reason')
    .eq('national_id', nationalId.trim())
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return { data: null, error: error.message };
  const row = Array.isArray(data) && data.length > 0 ? (data[0] as StaffPaymentRecord) : null;
  return { data: row, error: null };
}

/**
 * رفع الإيصال ثم حفظ بيانات السداد على سجل المشرفة. يصفّر سبب الرفض
 * السابق (إن وجد) حتى تعود الحالة إلى "بانتظار التحقق" بعد إعادة الرفع.
 */
export async function submitStaffPayment(
  staffId: string,
  paidAmount: number,
  file: File
): Promise<{ error: string | null }> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `staff/${staffId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error } = await (supabase as any)
    .from('staff')
    .update({
      payment_paid_amount: paidAmount,
      payment_receipt_path: path,
      payment_submitted_at: new Date().toISOString(),
      payment_rejection_reason: null,
    })
    .eq('id', staffId);
  if (error) return { error: error.message };

  return { error: null };
}
