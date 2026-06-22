import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, FileText, Pencil, Loader2 } from 'lucide-react';
import { Applicant } from '@/lib/applicant-labels';
import {
  getPaymentState, PAYMENT_STATE_AR, verifyPayment,
  updateDueAmount, getReceiptUrl, setPaymentSpecialStatus, PaymentSpecialStatus,
} from '@/lib/payment-actions';

interface Props {
  applicant: Applicant;
  onChanged: () => void;
}

export default function ApplicantPaymentSection({ applicant, onChanged }: Props) {
  const { toast } = useToast();
  const state = getPaymentState(applicant);

  const [busy, setBusy] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState(
    applicant.payment_due_amount != null ? String(applicant.payment_due_amount) : ''
  );

  const stateBadge = {
    none: <Badge variant="outline">{PAYMENT_STATE_AR.none}</Badge>,
    pending_review: <Badge className="bg-amber-500 hover:bg-amber-500">{PAYMENT_STATE_AR.pending_review}</Badge>,
    verified: <Badge className="bg-emerald-600 hover:bg-emerald-600">{PAYMENT_STATE_AR.verified}</Badge>,
    receipt_rejected: <Badge variant="destructive">{PAYMENT_STATE_AR.receipt_rejected}</Badge>,
    special_waqar: <Badge className="bg-indigo-600 hover:bg-indigo-600">{PAYMENT_STATE_AR.special_waqar}</Badge>,
    special_non_waqar: <Badge className="bg-indigo-600 hover:bg-indigo-600">{PAYMENT_STATE_AR.special_non_waqar}</Badge>,
  }[state];

  async function handleSetSpecial(value: PaymentSpecialStatus | null) {
    setBusy(true);
    const { error } = await setPaymentSpecialStatus(applicant.id, value, applicant.payment_special_status);
    setBusy(false);
    if (error) {
      toast({ title: 'تعذّر تحديث الحالة', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم تحديث حالة السداد' });
    onChanged();
  }

  async function openReceipt() {
    if (!applicant.payment_receipt_path) return;
    setReceiptLoading(true);
    const { url, error } = await getReceiptUrl(applicant.payment_receipt_path);
    setReceiptLoading(false);
    if (error || !url) {
      toast({ title: 'تعذّر فتح الإيصال', description: error ?? '', variant: 'destructive' });
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  async function handleVerify() {
    setBusy(true);
    const { error } = await verifyPayment(applicant.id);
    setBusy(false);
    if (error) {
      toast({ title: 'تعذّر الاعتماد', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم اعتماد السداد' });
    onChanged();
  }

  async function handleSaveAmount() {
    const amount = Number(amountInput);
    if (!(amount >= 0)) {
      toast({ title: 'مبلغ غير صالح', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { error } = await updateDueAmount(applicant.id, applicant.payment_due_amount, amount);
    setBusy(false);
    if (error) {
      toast({ title: 'تعذّر حفظ المبلغ', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم تحديث المبلغ المطلوب' });
    setEditingAmount(false);
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">السداد</CardTitle>
        {stateBadge}
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between items-center gap-4">
            <dt className="text-muted-foreground shrink-0">المبلغ المطلوب</dt>
            <dd className="flex items-center gap-2">
              {editingAmount ? (
                <>
                  <Input
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.]/g, ''))}
                    dir="ltr"
                    inputMode="decimal"
                    className="h-8 w-28 text-left tabular-nums"
                  />
                  <Button size="sm" onClick={handleSaveAmount} disabled={busy}>حفظ</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingAmount(false)}>إلغاء</Button>
                </>
              ) : (
                <>
                  <span className="tabular-nums font-medium">
                    {applicant.payment_due_amount != null ? `${applicant.payment_due_amount} ريال` : '—'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAmountInput(applicant.payment_due_amount != null ? String(applicant.payment_due_amount) : '');
                      setEditingAmount(true);
                    }}
                    title="تعديل المبلغ (للحالات الخاصة)"
                  >
                    <Pencil size={13} />
                  </Button>
                </>
              )}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">المبلغ المدفوع</dt>
            <dd className="tabular-nums">
              {applicant.payment_paid_amount != null ? `${applicant.payment_paid_amount} ريال` : '—'}
            </dd>
          </div>

          {applicant.payment_installments_count != null && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">التقسيط</dt>
              <dd>
                <Badge variant="outline" className="font-normal">
                  على {applicant.payment_installments_count} دفعات
                </Badge>
              </dd>
            </div>
          )}

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">وقت تأكيد السداد</dt>
            <dd className="tabular-nums text-xs">
              {applicant.payment_submitted_at
                ? new Date(applicant.payment_submitted_at).toLocaleString('ar-SA', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '—'}
            </dd>
          </div>

          {state === 'verified' && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">اعتمدت السداد</dt>
              <dd className="text-xs">
                {applicant.payment_verified_by ?? '—'}
                {applicant.payment_verified_at && (
                  <span className="text-muted-foreground tabular-nums mr-1">
                    ({new Date(applicant.payment_verified_at).toLocaleString('ar-SA', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })})
                  </span>
                )}
              </dd>
            </div>
          )}

          {state === 'receipt_rejected' && (
            <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-xs">
              <span className="font-semibold">سبب الرفض: </span>
              {applicant.payment_rejection_reason}
            </div>
          )}
        </dl>

        {(applicant.payment_receipt_path || state === 'pending_review') && (
          <div className="flex items-center gap-2 pt-1">
            {applicant.payment_receipt_path && (
              <Button variant="outline" size="sm" onClick={openReceipt} disabled={receiptLoading} className="gap-2">
                {receiptLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                عرض الإيصال
              </Button>
            )}
            {state === 'pending_review' && (
              <Button onClick={handleVerify} disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700 ms-auto">
                <CheckCircle2 size={15} />
                اعتماد السداد
              </Button>
            )}
          </div>
        )}

        {/* حالة سداد خاصة تُعيَّن يدوياً (لا يوجد مسار تلقائي) */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm text-muted-foreground">حالة سداد خاصة (تُعيَّن يدوياً)</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={applicant.payment_special_status === 'waqar' ? 'default' : 'outline'}
              onClick={() => handleSetSpecial('waqar')}
              disabled={busy}
            >
              {PAYMENT_STATE_AR.special_waqar}
            </Button>
            <Button
              size="sm"
              variant={applicant.payment_special_status === 'non_waqar' ? 'default' : 'outline'}
              onClick={() => handleSetSpecial('non_waqar')}
              disabled={busy}
            >
              {PAYMENT_STATE_AR.special_non_waqar}
            </Button>
            {applicant.payment_special_status && (
              <Button size="sm" variant="ghost" onClick={() => handleSetSpecial(null)} disabled={busy}>
                إلغاء الحالة الخاصة
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
