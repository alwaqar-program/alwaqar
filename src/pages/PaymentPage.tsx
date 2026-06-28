import { useState, useEffect, useLayoutEffect, FormEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Loader2, Copy, Upload, Clock, XCircle } from 'lucide-react';
import { Applicant, BRANCH_AR, AGE_AR } from '@/lib/applicant-labels';
import {
  findPayableApplicant, submitPayment, getPaymentState, PaymentState,
  PaymentInstallment, getInstallments, submitNextInstallment, resubmitInstallment,
  installmentStatus, InstallmentStatus, INSTALLMENT_STATUS_AR,
  isInstallmentPlan, verifiedTotal, submittedTotal, isFullyPaid,
} from '@/lib/payment-actions';
import { BANK_CONFIG, RECEIPT_MAX_SIZE_MB, RECEIPT_ACCEPTED_TYPES } from '@/lib/payment-config';
import logoImg from '@/assets/logo.png';
import alinmaLogo from '@/assets/alinma-logo.svg';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'not_found' }
  | { kind: 'eligible'; applicant: Applicant }
  | { kind: 'pending_review'; applicant: Applicant }
  | { kind: 'verified'; applicant: Applicant }
  | { kind: 'receipt_rejected'; applicant: Applicant }
  | { kind: 'submitted_now'; applicant: Applicant };

function stateFromPayment(applicant: Applicant): LookupState {
  const ps: PaymentState = getPaymentState(applicant);
  if (ps === 'verified') return { kind: 'verified', applicant };
  if (ps === 'receipt_rejected') return { kind: 'receipt_rejected', applicant };
  if (ps === 'pending_review') return { kind: 'pending_review', applicant };
  return { kind: 'eligible', applicant };
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

async function copyToClipboard(value: string, label: string, toast: ReturnType<typeof useToast>['toast']) {
  try {
    await navigator.clipboard.writeText(value);
    toast({ title: `تم نسخ ${label}` });
  } catch {
    toast({ title: 'تعذّر النسخ', variant: 'destructive' });
  }
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

const STATUS_BADGE: Record<InstallmentStatus, JSX.Element> = {
  pending: <Badge className="bg-amber-500 hover:bg-amber-500">{INSTALLMENT_STATUS_AR.pending}</Badge>,
  verified: <Badge className="bg-emerald-600 hover:bg-emerald-600">{INSTALLMENT_STATUS_AR.verified}</Badge>,
  rejected: <Badge variant="destructive">{INSTALLMENT_STATUS_AR.rejected}</Badge>,
};

interface NormalizedPayment {
  number: number;
  amount: number | null;
  status: InstallmentStatus;
  rejection_reason: string | null;
}

function normalizePayments(a: Applicant, installments: PaymentInstallment[]): NormalizedPayment[] {
  const firstStatus: InstallmentStatus =
    a.payment_verified_at ? 'verified'
    : a.payment_rejection_reason ? 'rejected'
    : 'pending';
  const first: NormalizedPayment = {
    number: 1,
    amount: a.payment_paid_amount,
    status: firstStatus,
    rejection_reason: a.payment_rejection_reason,
  };
  const rest = installments.map((i) => ({
    number: i.payment_number,
    amount: i.amount,
    status: installmentStatus(i),
    rejection_reason: i.rejection_reason,
  }));
  return [first, ...rest];
}

function PaymentSummary({ applicant }: { applicant: Applicant }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-muted/30 border rounded-lg p-3">
      <div>
        <div className="text-muted-foreground text-xs mb-0.5">المبلغ المدفوع</div>
        <div className="font-semibold tabular-nums">
          {applicant.payment_paid_amount != null ? `${applicant.payment_paid_amount} ريال` : '—'}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs mb-0.5">المبلغ المطلوب</div>
        <div className="font-medium tabular-nums">
          {applicant.payment_due_amount != null ? `${applicant.payment_due_amount} ريال` : '—'}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs mb-0.5">طريقة السداد</div>
        <div className="font-medium">
          {applicant.payment_installments_count != null
            ? `تقسيط على ${applicant.payment_installments_count} دفعات`
            : 'دفعة واحدة'}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs mb-0.5">تاريخ الإرسال</div>
        <div className="font-medium tabular-nums text-xs leading-5">
          {applicant.payment_submitted_at
            ? new Date(applicant.payment_submitted_at).toLocaleDateString('ar-SA', {
                year: 'numeric', month: 'long', day: 'numeric',
              })
            : '—'}
        </div>
      </div>
    </div>
  );
}

/**
 * تدفّق التقسيط على الصفحة العامة: قائمة الدفعات وحالاتها، وإعادة رفع أي دفعة
 * مرفوضة، ونموذج إضافة الدفعة التالية ما دام هناك مبلغ متبقٍّ.
 */
function InstallmentFlow({
  applicant, installments, onChanged,
}: {
  applicant: Applicant;
  installments: PaymentInstallment[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const payments = normalizePayments(applicant, installments);
  const due = applicant.payment_due_amount;
  const verified = verifiedTotal(applicant, installments);
  const submitted = submittedTotal(applicant, installments);
  const remaining = due != null ? Math.max(0, due - submitted) : null;
  const fullyPaid = isFullyPaid(applicant, installments);
  const rejected = installments.find((i) => installmentStatus(i) === 'rejected') ?? null;
  const nextNumber = installments.length + 2;

  const [amount, setAmount] = useState(remaining != null && remaining > 0 ? String(remaining) : '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) { setFile(null); return; }
    const err = validateReceiptFile(f);
    if (err) {
      toast({ title: 'تعذّر قبول الملف', description: err, variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0) || !file) return;
    setBusy(true);
    const { error } = rejected
      ? await resubmitInstallment(rejected.id, applicant.id, rejected.payment_number, amt, file)
      : await submitNextInstallment(applicant.id, nextNumber, amt, file);
    setBusy(false);
    if (error) {
      toast({ title: 'تعذّر إرسال الإيصال', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم استلام الدفعة', description: 'ستراجعها إدارة الدورة قريباً بإذن الله' });
    setAmount('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    onChanged();
  }

  const canSubmit = Number(amount) > 0 && file !== null && !busy;
  const showAddForm = !fullyPaid && (rejected !== null || remaining == null || remaining > 0);

  return (
    <div className="space-y-5">
      {fullyPaid ? (
        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>تم اعتماد سدادك بالكامل ✓ نراك على خير بإذن الله.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-md p-3">
          <Clock size={16} className="mt-0.5 shrink-0" />
          <span>أنتِ على خطة تقسيط. يمكنكِ إرسال دفعتك التالية في أي وقت من هنا.</span>
        </div>
      )}

      {/* ملخّص المبالغ */}
      <div className="grid grid-cols-3 gap-3 text-sm bg-muted/30 border rounded-lg p-3">
        <div>
          <div className="text-muted-foreground text-xs mb-0.5">المبلغ المطلوب</div>
          <div className="font-semibold tabular-nums">{due != null ? `${due} ريال` : 'يُحدد لاحقاً'}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs mb-0.5">المعتمد حتى الآن</div>
          <div className="font-medium tabular-nums text-emerald-700">{verified} ريال</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs mb-0.5">المتبقّي</div>
          <div className="font-medium tabular-nums">{remaining != null ? `${remaining} ريال` : '—'}</div>
        </div>
      </div>

      {/* قائمة الدفعات */}
      <div className="border rounded-lg divide-y">
        {payments.map((p) => (
          <div key={p.number} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">الدفعة رقم {p.number}</span>
              <span className="tabular-nums text-muted-foreground">
                {p.amount != null ? `${p.amount} ريال` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {p.status === 'rejected' && p.rejection_reason && (
                <span className="text-xs text-destructive">{p.rejection_reason}</span>
              )}
              {STATUS_BADGE[p.status]}
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
          <h3 className="font-display text-base">
            {rejected ? `إعادة رفع إيصال الدفعة رقم ${rejected.payment_number}` : `إرسال الدفعة رقم ${nextNumber}`}
          </h3>

          <BankDetails onCopy={(v, l) => copyToClipboard(v, l, toast)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inst_amount">المبلغ المحوَّل (ريال)</Label>
              <Input
                id="inst_amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                dir="ltr"
                inputMode="decimal"
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst_receipt">إيصال التحويل</Label>
              <Input
                id="inst_receipt"
                type="file"
                ref={fileRef}
                accept={RECEIPT_ACCEPTED_TYPES.join(',')}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                صورة JPG/PNG أو PDF — بحد أقصى {RECEIPT_MAX_SIZE_MB} ميجابايت
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={!canSubmit}>
            {busy ? (
              <><Loader2 size={16} className="animate-spin" /> جارٍ الإرسال…</>
            ) : (
              <><Upload size={16} /> إرسال الإيصال</>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function PaymentPage() {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'تأكيد التسجيل وسداد رسوم دورة الوقار ١٤';
    return () => {
      document.title = previous;
    };
  }, []);

  const [nationalId, setNationalId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [installments, setInstallments] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [paidInstallments, setPaidInstallments] = useState<PaymentInstallment[]>([]);
  const [instRefresh, setInstRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تحقق تلقائي عند اكتمال 10 أرقام
  useEffect(() => {
    const trimmed = nationalId.trim();
    if (trimmed.length !== 10) {
      setLookup({ kind: 'idle' });
      setConfirmed(false);
      setFile(null);
      return;
    }
    let cancelled = false;
    setLookup({ kind: 'searching' });
    (async () => {
      const { data, error } = await findPayableApplicant(trimmed);
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
      const next = stateFromPayment(data);
      setLookup(next);
      if (next.kind === 'eligible' || next.kind === 'receipt_rejected') {
        setPaidAmount(data.payment_due_amount != null ? String(data.payment_due_amount) : '');
      }
    })();
    return () => { cancelled = true; };
  }, [nationalId, toast]);

  const applicant =
    lookup.kind === 'eligible' || lookup.kind === 'pending_review' ||
    lookup.kind === 'verified' || lookup.kind === 'receipt_rejected' ||
    lookup.kind === 'submitted_now'
      ? lookup.applicant
      : null;
  const applicantId = applicant?.id ?? null;

  // الدفعات الإضافية (للتقسيط)
  useEffect(() => {
    if (!applicantId) { setPaidInstallments([]); return; }
    let cancelled = false;
    (async () => {
      const rows = await getInstallments(applicantId);
      if (!cancelled) setPaidInstallments(rows);
    })();
    return () => { cancelled = true; };
  }, [applicantId, instRefresh]);

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
    confirmed &&
    file !== null &&
    Number(paidAmount) > 0 &&
    (!installments || Number(installmentsCount) >= 2);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || (lookup.kind !== 'eligible' && lookup.kind !== 'receipt_rejected')) return;
    const current = lookup.applicant;
    setSubmitting(true);
    const { error } = await submitPayment(
      current.id,
      Number(paidAmount),
      file!,
      installments ? Number(installmentsCount) : null
    );
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر إرسال الإيصال', description: error, variant: 'destructive' });
      return;
    }
    setLookup({
      kind: 'submitted_now',
      applicant: {
        ...current,
        payment_paid_amount: Number(paidAmount),
        payment_submitted_at: new Date().toISOString(),
        payment_rejection_reason: null,
        payment_installments_count: installments ? Number(installmentsCount) : null,
      },
    });
  }

  function copyValue(value: string, label: string) {
    copyToClipboard(value, label, toast);
  }

  const showForm = lookup.kind === 'eligible' || lookup.kind === 'receipt_rejected';

  // خطة تقسيط وقد أُرسلت الدفعة الأولى → اعرض تدفّق الدفعات الإضافية.
  const showInstallmentFlow =
    applicant != null &&
    isInstallmentPlan(applicant) &&
    (lookup.kind === 'pending_review' || lookup.kind === 'verified' || lookup.kind === 'submitted_now');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">
            تأكيد التسجيل وسداد رسوم الدورة
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
                  <Label htmlFor="full_name">الاسم الرباعي</Label>
                  <div className="relative">
                    <Input
                      id="full_name"
                      value={applicant?.full_name ?? ''}
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
                  <span>لم نعثر على تسجيلكِ. تأكدي من رقم الهوية، أو تواصلي مع إدارة الدورة.</span>
                </div>
              )}

              {/* تدفّق التقسيط (الدفعة الأولى أُرسلت بالفعل) */}
              {showInstallmentFlow && applicant && (
                <InstallmentFlow
                  applicant={applicant}
                  installments={paidInstallments}
                  onChanged={() => setInstRefresh((k) => k + 1)}
                />
              )}

              {/* قيد المراجعة (دفعة واحدة) */}
              {lookup.kind === 'pending_review' && !showInstallmentFlow && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <Clock size={16} className="mt-0.5 shrink-0" />
                    <span>تم استلام إيصالك وهو قيد المراجعة من إدارة الدورة. لا حاجة لإعادة الإرسال.</span>
                  </div>
                  <PaymentSummary applicant={lookup.applicant} />
                </div>
              )}

              {/* تم الاعتماد (دفعة واحدة) */}
              {lookup.kind === 'verified' && !showInstallmentFlow && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>تم تأكيد سدادك واعتماد تسجيلك في الدورة ✓ نراك على خير بإذن الله.</span>
                  </div>
                  <PaymentSummary applicant={lookup.applicant} />
                </div>
              )}

              {/* تم الإرسال الآن (دفعة واحدة) */}
              {lookup.kind === 'submitted_now' && !showInstallmentFlow && (
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
                    <div>السبب: {lookup.applicant.payment_rejection_reason}</div>
                  </div>
                </div>
              )}

              {/* بيانات الطالبة + المبلغ + الحساب (الدفعة الأولى) */}
              {showForm && applicant && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm bg-muted/30 border rounded-lg p-3">
                    <div>
                      <div className="text-muted-foreground text-xs mb-0.5">الفرع</div>
                      <div className="font-medium">
                        {applicant.desired_branch ? BRANCH_AR[applicant.desired_branch] : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-0.5">الفئة العمرية</div>
                      <div className="font-medium">
                        {applicant.age_category ? AGE_AR[applicant.age_category] : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-0.5">المبلغ المطلوب</div>
                      <div className="font-semibold tabular-nums">
                        {applicant.payment_due_amount != null
                          ? `${applicant.payment_due_amount} ريال`
                          : 'يُحدد لاحقاً'}
                      </div>
                    </div>
                  </div>

                  <BankDetails onCopy={copyValue} />

                  {/* إقرار التسجيل */}
                  <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={confirmed}
                      onCheckedChange={(v) => setConfirmed(!!v)}
                      className="mt-1 shrink-0"
                    />
                    <span className="text-sm leading-loose">
                      أؤكد رغبتي في إتمام التسجيل في <strong>دورة الوقار</strong>،
                      وأقرّ بأنني قمت بتحويل رسوم الدورة إلى الحساب الموضح أعلاه.
                    </span>
                  </label>

                  {/* تقسيط الدفعات */}
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label htmlFor="installments" className="cursor-pointer">تقسيط الدفعات</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          فعّلي هذا الخيار إذا كنتِ سترسلين المبلغ على أكثر من دفعة
                        </p>
                      </div>
                      <Switch
                        id="installments"
                        checked={installments}
                        onCheckedChange={(v) => {
                          setInstallments(v);
                          if (!v) setInstallmentsCount('');
                        }}
                      />
                    </div>
                    {installments && (
                      <div className="space-y-2">
                        <Label htmlFor="installments_count">عدد الدفعات</Label>
                        <Input
                          id="installments_count"
                          value={installmentsCount}
                          onChange={(e) => setInstallmentsCount(e.target.value.replace(/\D/g, '').slice(0, 1))}
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="مثال: 2"
                          className="w-32"
                        />
                        {installments && installmentsCount !== '' && Number(installmentsCount) < 2 && (
                          <p className="text-xs text-destructive">عدد الدفعات يجب أن يكون 2 أو أكثر</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          ستتمكنين من إرسال بقية الدفعات لاحقاً من هذه الصفحة بإدخال رقم هويتك.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* المبلغ المحول + الإيصال */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paid_amount">
                        {installments ? 'مبلغ الدفعة الأولى المحوَّل (ريال)' : 'المبلغ المحوَّل (ريال)'}
                      </Label>
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
                        تأكيد التسجيل وإرسال الإيصال
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
