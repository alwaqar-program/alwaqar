import { useState, useEffect, useLayoutEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Applicant } from '@/lib/applicant-labels';
import { findApplicantByNationalId, pledgeApplicant } from '@/lib/applicant-actions';
import logoImg from '@/assets/logo.png';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'not_found' }
  | { kind: 'found'; applicant: Applicant }
  | { kind: 'already_pledged'; applicant: Applicant }
  | { kind: 'pledged_now'; applicant: Applicant };

export default function PledgePage() {
  const { toast } = useToast();

  // Set browser tab title only while this page is mounted
  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'إقرار والتزام الطالبات بالاتفاقية';
    return () => {
      document.title = previous;
    };
  }, []);

  const [nationalId, setNationalId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });

  // Auto-lookup when ID reaches 10 digits
  useEffect(() => {
    const trimmed = nationalId.trim();
    if (trimmed.length !== 10) {
      setLookup({ kind: 'idle' });
      setAgreed(false);
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
      if (data.pledged_at) {
        setLookup({ kind: 'already_pledged', applicant: data });
        return;
      }
      setLookup({ kind: 'found', applicant: data });
    })();
    return () => { cancelled = true; };
  }, [nationalId, toast]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (lookup.kind !== 'found' || !agreed) return;
    setSubmitting(true);
    const { error } = await pledgeApplicant(lookup.applicant.id, lookup.applicant.status);
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر حفظ الإقرار', description: error, variant: 'destructive' });
      return;
    }
    setLookup({ kind: 'pledged_now', applicant: lookup.applicant });
  }

  const fullName =
    lookup.kind === 'found' || lookup.kind === 'already_pledged' || lookup.kind === 'pledged_now'
      ? lookup.applicant.full_name ?? ''
      : '';

  const isAlreadyDone = lookup.kind === 'already_pledged' || lookup.kind === 'pledged_now';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">
            إقرار والتزام الطالبات بالاتفاقية
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 lg:py-12 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* القسم: إقرار والتزام */}
              <div className="space-y-1 border-b pb-2">
                <h2 className="font-display text-lg">إقرار والتزام</h2>
                <p className="text-sm text-muted-foreground">"ويُغني عن التوقيع الخطي"</p>
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
                    disabled={isAlreadyDone}
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

              {/* رسالة "سبق الإقرار" / "تم الآن" */}
              {isAlreadyDone && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {lookup.kind === 'pledged_now'
                      ? 'تم استلام إقراركِ بنجاح. شكراً لكِ.'
                      : 'سبق إقرار التعهد لهذه الهوية. لا حاجة لإعادته.'}
                  </span>
                </div>
              )}

              {/* checkbox + التعهد */}
              <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(!!v)}
                  disabled={lookup.kind !== 'found'}
                  className="mt-1 shrink-0"
                />
                <span className="text-sm leading-loose">
                  أتعهد أنا الطالبة في برنامج <strong>الوقار</strong> أن أتقيد بجميع ما ورد
                  في <strong>"اتفاقية الطالبات"</strong>، وأتحمل كامل المسؤولية المترتبة
                  على الإخلال بأي بند من بنودها.
                </span>
              </label>

              <Button
                type="submit"
                className="w-full"
                disabled={lookup.kind !== 'found' || !agreed || submitting}
              >
                {submitting ? 'جارٍ الحفظ…' : 'أوافق وأتعهَّد'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
