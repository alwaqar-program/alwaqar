import { useState, useEffect, useLayoutEffect, FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Loader2, Copy, Upload, Clock, XCircle } from 'lucide-react';
import {
  StaffPaymentRecord, getStaffPaymentState, findPayableStaff, submitStaffPayment,
} from '@/lib/staff-payment-actions';
import { BANK_CONFIG, RECEIPT_MAX_SIZE_MB, RECEIPT_ACCEPTED_TYPES } from '@/lib/payment-config';
import logoImg from '@/assets/logo.png';
import alinmaLogo from '@/assets/alinma-logo.svg';

// صفحة سداد المشرفات — نسخة مبسطة من صفحة الطالبات (PaymentPage):
// لا مبلغ مطلوب ولا تقسيط؛ كل مشرفة تحوّل المبلغ الذي تريده وترفع الإيصال.

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'not_found' }
  | { kind: 'eligible'; staff: StaffPaymentRecord }
  | { kind: 'pending_review'; staff: StaffPaymentRecord }
  | { kind: 'verified'; staff: StaffPaymentRecord }
  | { kind: 'receipt_rejected'; staff: StaffPaymentRecord }
  | { kind: 'submitted_now'; staff: StaffPaymentRecord };

function stateFromPayment(staff: StaffPaymentRecord): LookupState {
  const ps = getStaffPaymentState(staff);
  if (ps === 'verified') return { kind: 'verified', staff };
  if (ps === 'receipt_rejected') return { kind: 'receipt_rejected', staff };
  if (ps === 'pending_review') return { kind: 'pending_review', staff };
  return { kind: 'eligible', staff };
}

/** يتحقق من نوع وحجم الإيصال، ويعيد رسالة خطأ أو null عند القبول. */
function validateReceiptFile(f: File): string | null {
  if (!RECEIPT_ACCEPTED_TYPES.includes(f.type)) {
    return 'يُقبل فقط: صورة JPG أو PNG أو ملف PDF';
  }
  if (f.size > RECEIPT_MAX_SIZE_MB * 1024 * 1024) {
    return `الحد الأقصى ${RECEIPT_MAX_SIZE_MB} ميجابايت`;
  }
  return null;
}

function BankDetails({ onCopy }: { onCopy: (value: string, label: string) => void }) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base">بيانات الحساب البنكي</h3>
        <img src={alinmaLogo} alt="بنك الإنماء" className="h-8 object-contain" />
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-4 items-start">
          <span className="text-muted-foreground shrink-0">المستفيد</span>
          <span className="text-left leading-relaxed">{BANK_CONFIG.beneficiary}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground shrink-0">رقم الحساب</span>
          <div className="flex items-center gap-1">
            <code dir="ltr" className="text-xs sm:text-sm bg-muted px-2 py-1 rounded tabular-nums">
              {BANK_CONFIG.accountNumber}
            </code>
            <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(BANK_CONFIG.accountNumber, 'رقم الحساب')} title="نسخ رقم الحساب">
              <Copy size={14} />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground shrink-0">الآيبان</span>
          <div className="flex items-center gap-1">
            <code dir="ltr" className="text-xs sm:text-sm bg-muted px-2 py-1 rounded tabular-nums">
              {BANK_CONFIG.iban}
            </code>
            <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(BANK_CONFIG.iban, 'الآيبان')} title="نسخ الآيبان">
              <Copy size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentSummary({ staff }: { staff: StaffPaymentRecord }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 border rounded-lg p-3">
      <div>
        <div className="text-muted-foreground text-xs mb-0.5">المبلغ المدفوع</div>
        <div className="font-semibold tabular-nums">
          {staff.payment_paid_amount != null ? `${staff.payment_paid_amount} ريال` : '—'}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs mb-0.5">تاريخ الإرسال</div>
        <div className="font-medium tabular-nums text-xs leading-5">
          {staff.payment_submitted_at
            ? new Date(staff.payment_submitted_at).toLocaleDateString('ar-SA', {
                year: 'numeric', month: 'long', day: 'numeric',
              })
            : '—'}
        </div>
      </div>
    </div>
  );
}

export default function StaffPaymentPage() {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'سداد رسوم دورة الوقار ١٤ — المشرفات';
    return () => {
      document.title = previous;
    };
  }, []);

  const [nationalId, setNationalId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تحقق تلقائي عند اكتمال 10 أرقام
  useEffect(() => {
    const trimmed = nationalId.trim();
    if (trimmed.length !== 10) {
      setLookup({ kind: 'idle' });
      setFile(null);
      return;
    }
    let cancelled = false;
    setLookup({ kind: 'searching' });
    (async () => {
      const { data, error } = await findPayableStaff(trimmed);
      if (cancelled) return;
      if (error) {
        toast({ title: 'تعذّر التحقق', description: error, variant: 'destructive' });
        setLookup({ kind: 'idle' });
        return;
      }
      if (!data) {
        setLookup({ kind: 'not_found' });
        return;
      }
      setLookup(stateFromPayment(data));
    })();
    return () => { cancelled = true; };
  }, [nationalId, toast]);

  const staff =
    lookup.kind === 'eligible' || lookup.kind === 'pending_review' ||
    lookup.kind === 'verified' || lookup.kind === 'receipt_rejected' ||
    lookup.kind === 'submitted_now'
      ? lookup.staff
      : null;

  function handleFileChange(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    const err = validateReceiptFile(f);
    if (err) {
      toast({ title: 'تعذّر قبول الملف', description: err, variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFile(null);
      return;
    }
    setFile(f);
  }

  const canSubmit =
    (lookup.kind === 'eligible' || lookup.kind === 'receipt_rejected') &&
    file !== null &&
    Number(paidAmount) > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || (lookup.kind !== 'eligible' && lookup.kind !== 'receipt_rejected')) return;
    const current = lookup.staff;
    setSubmitting(true);
    const { error } = await submitStaffPayment(current.id, Number(paidAmount), file!);
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر إرسال الإيصال', description: error, variant: 'destructive' });
      return;
    }
    setLookup({
      kind: 'submitted_now',
      staff: {
        ...current,
        payment_paid_amount: Number(paidAmount),
        payment_submitted_at: new Date().toISOString(),
        payment_rejection_reason: null,
      },
    });
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `تم نسخ ${label}` });
    } catch {
      toast({ title: 'تعذّر النسخ', variant: 'destructive' });
    }
  }

  const showForm = lookup.kind === 'eligible' || lookup.kind === 'receipt_rejected';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">
            سداد رسوم الدورة — المشرفات
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 lg:py-12 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1 border-b pb-2">
                <h2 className="font-display text-lg">سداد رسوم دورة الوقار ١٤</h2>
                <p className="text-sm text-muted-foreground">
                  أدخلي رقم هويتك للتحقق
                </p>
              </div>

              {/* رقم الهوية + الاسم */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="national_id">رقم الهوية</Label>
                  <Input
                    id="national_id"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10 أرقام"
                    dir="ltr"
                    inputMode="numeric"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">الاسم</Label>
                  <div className="relative">
                    <Input
                      id="full_name"
                      value={staff?.staff_name ?? ''}
                      readOnly
                      placeholder={lookup.kind === 'searching' ? 'جارٍ التحقق…' : '—'}
                      className="bg-muted/30"
                    />
                    {lookup.kind === 'searching' && (
                      <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {/* لم نعثر */}
              {lookup.kind === 'not_found' && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>لم نعثر على بياناتكِ. تأكدي من رقم الهوية، أو تواصلي مع إدارة الدورة.</span>
                </div>
              )}

              {/* قيد المراجعة */}
              {lookup.kind === 'pending_review' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <Clock size={16} className="mt-0.5 shrink-0" />
                    <span>تم استلام إيصالك وهو قيد المراجعة من إدارة الدورة. لا حاجة لإعادة الإرسال.</span>
                  </div>
                  <PaymentSummary staff={lookup.staff} />
                </div>
              )}

              {/* تم الاعتماد */}
              {lookup.kind === 'verified' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>تم تأكيد سدادك ✓ نراك على خير بإذن الله.</span>
                  </div>
                  <PaymentSummary staff={lookup.staff} />
                </div>
              )}

              {/* تم الإرسال الآن */}
              {lookup.kind === 'submitted_now' && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>تم استلام إيصالك بنجاح. ستراجعه إدارة الدورة ويُعتمد سدادك قريباً بإذن الله.</span>
                </div>
              )}

              {/* إيصال مرفوض */}
              {lookup.kind === 'receipt_rejected' && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold mb-1">لم يُقبل الإيصال السابق — يُرجى رفع إيصال جديد</div>
                    <div>السبب: {lookup.staff.payment_rejection_reason}</div>
                  </div>
                </div>
              )}

              {/* الحساب البنكي + المبلغ + الإيصال */}
              {showForm && staff && (
                <>
                  <BankDetails onCopy={copyValue} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paid_amount">المبلغ المحوَّل (ريال)</Label>
                      <Input
                        id="paid_amount"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value.replace(/[^\d.]/g, ''))}
                        dir="ltr"
                        inputMode="decimal"
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receipt">إيصال التحويل</Label>
                      <Input
                        id="receipt"
                        type="file"
                        ref={fileInputRef}
                        accept={RECEIPT_ACCEPTED_TYPES.join(',')}
                        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        صورة JPG/PNG أو PDF — بحد أقصى {RECEIPT_MAX_SIZE_MB} ميجابايت
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={!canSubmit || submitting}>
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        جارٍ الإرسال…
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        إرسال الإيصال
                      </>
                    )}
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
