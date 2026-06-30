import { useState, useEffect, useLayoutEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Applicant } from '@/lib/applicant-labels';
import { findApplicantByNationalId, saveRegistrationNumber } from '@/lib/applicant-actions';
import logoImg from '@/assets/logo.png';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'not_found' }
  | { kind: 'found'; applicant: Applicant }
  | { kind: 'saved_now'; applicant: Applicant };

export default function RegNumberPage() {
  const { toast } = useToast();

  // Set browser tab title only while this page is mounted
  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'رقم المستخدم في نظام إدارة حلقات القرآن الكريم بالمسجد النبوي';
    return () => {
      document.title = previous;
    };
  }, []);

  const [nationalId, setNationalId] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });

  // Auto-lookup when ID reaches 10 digits
  useEffect(() => {
    const trimmed = nationalId.trim();
    if (trimmed.length !== 10) {
      setLookup({ kind: 'idle' });
      setRegNumber('');
      return;
    }
    let cancelled = false;
    setLookup({ kind: 'searching' });
    (async () => {
      const { data, error } = await findApplicantByNationalId(trimmed);
      if (cancelled) return;
      if (error) {
        toast({ title: 'تعذّر التحقق', description: error, variant: 'destructive' });
        setLookup({ kind: 'idle' });
        return;
      }
      if (!data || data.status === 'deleted' || data.status === 'rejected') {
        setLookup({ kind: 'not_found' });
        return;
      }
      setRegNumber(data.registration_number ?? '');
      setLookup({ kind: 'found', applicant: data });
    })();
    return () => { cancelled = true; };
  }, [nationalId, toast]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lookup.kind !== 'found' || regNumber.length !== 7) return;
    setSubmitting(true);
    const { error } = await saveRegistrationNumber(
      lookup.applicant.id,
      regNumber,
      lookup.applicant.registration_number
    );
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر حفظ رقم المستخدم', description: error, variant: 'destructive' });
      return;
    }
    setLookup({
      kind: 'saved_now',
      applicant: { ...lookup.applicant, registration_number: regNumber },
    });
  }

  const applicant =
    lookup.kind === 'found' || lookup.kind === 'saved_now' ? lookup.applicant : null;
  const fullName = applicant?.full_name ?? '';
  const hadExisting = !!applicant?.registration_number && lookup.kind === 'found';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">
            رقم المستخدم في نظام إدارة حلقات القرآن الكريم بالمسجد النبوي
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 lg:py-12 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* القسم: رقم المستخدم */}
              <div className="space-y-1 border-b pb-2">
                <h2 className="font-display text-lg">إدخال رقم المستخدم</h2>
                <p className="text-sm text-muted-foreground">
                  أدخلي رقم الهوية، ثم اكتبي رقم المستخدم المكوّن من 7 أرقام.
                </p>
              </div>

              {/* الحقول */}
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
                      value={fullName}
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

              {/* رسالة "لم نعثر" */}
              {lookup.kind === 'not_found' && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>لم نعثر على تسجيلكِ. تأكدي من رقم الهوية، أو تواصلي مع إدارة الدورة.</span>
                </div>
              )}

              {/* حقل رقم المستخدم */}
              {(lookup.kind === 'found' || lookup.kind === 'saved_now') && (
                <div className="space-y-2">
                  <Label htmlFor="registration_number">رقم المستخدم</Label>
                  <Input
                    id="registration_number"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.replace(/\D/g, '').slice(0, 7))}
                    placeholder="7 أرقام"
                    dir="ltr"
                    inputMode="numeric"
                    required
                    disabled={lookup.kind === 'saved_now'}
                  />
                  {hadExisting && (
                    <p className="text-sm text-muted-foreground">
                      رقمكِ المسجّل: <span dir="ltr">{applicant?.registration_number}</span> — يمكنكِ تحديثه.
                    </p>
                  )}
                </div>
              )}

              {/* رسالة "تم الحفظ" */}
              {lookup.kind === 'saved_now' && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>تم حفظ رقم المستخدم بنجاح. شكراً لكِ.</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={lookup.kind !== 'found' || regNumber.length !== 7 || submitting}
              >
                {submitting ? 'جارٍ الحفظ…' : 'حفظ رقم المستخدم'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
