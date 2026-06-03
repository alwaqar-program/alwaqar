import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, FileSignature, ArrowRight } from 'lucide-react';
import { Applicant, STATUS_AR } from '@/lib/applicant-labels';
import { findApplicantByNationalId, pledgeApplicant } from '@/lib/applicant-actions';
import logoImg from '@/assets/logo.png';

type Stage = 'enter_id' | 'confirm' | 'success' | 'already_pledged';

export default function PledgePage() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('enter_id');
  const [nationalId, setNationalId] = useState('');
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    const id = nationalId.trim();
    if (!id) {
      toast({ title: 'يرجى إدخال رقم الهوية', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await findApplicantByNationalId(id);
    setLoading(false);
    if (error) {
      toast({ title: 'تعذّر التحقق', description: error, variant: 'destructive' });
      return;
    }
    if (!data) {
      toast({
        title: 'لم نعثر على تسجيلك',
        description: 'تأكدي من رقم الهوية، أو تواصلي مع إدارة الدورة.',
        variant: 'destructive',
      });
      return;
    }
    if (data.status === 'deleted' || data.status === 'rejected') {
      toast({
        title: 'لم نعثر على تسجيلك',
        description: 'يرجى التواصل مع إدارة الدورة.',
        variant: 'destructive',
      });
      return;
    }
    setApplicant(data);
    if (data.status === 'pledged') {
      setStage('already_pledged');
    } else {
      setStage('confirm');
    }
  }

  async function handlePledge() {
    if (!applicant) return;
    setLoading(true);
    const { error } = await pledgeApplicant(applicant.id, applicant.status);
    setLoading(false);
    if (error) {
      toast({ title: 'تعذّر حفظ الإقرار', description: error, variant: 'destructive' });
      return;
    }
    setStage('success');
  }

  function reset() {
    setStage('enter_id');
    setNationalId('');
    setApplicant(null);
    setAgreed(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Top brand bar */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-display text-lg leading-tight">نظام الوقار</h1>
            <p className="text-xs text-muted-foreground">جمعية تعلَّم للقرآن وعلومه</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-8 lg:py-12 flex items-start justify-center">
        <div className="w-full max-w-2xl">
          {stage === 'enter_id' && (
            <EnterIdStage
              nationalId={nationalId}
              setNationalId={setNationalId}
              loading={loading}
              onSubmit={handleLookup}
            />
          )}

          {stage === 'confirm' && applicant && (
            <ConfirmStage
              applicant={applicant}
              agreed={agreed}
              setAgreed={setAgreed}
              loading={loading}
              onPledge={handlePledge}
              onBack={reset}
            />
          )}

          {stage === 'already_pledged' && applicant && (
            <AlreadyPledgedStage applicant={applicant} onReset={reset} />
          )}

          {stage === 'success' && applicant && (
            <SuccessStage applicant={applicant} onReset={reset} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ─────────── Stages ─────────── */

function EnterIdStage({ nationalId, setNationalId, loading, onSubmit }: {
  nationalId: string;
  setNationalId: (s: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <FileSignature size={22} />
        </div>
        <CardTitle className="font-display text-2xl">تعهد الالتزام باتفاقية الطالبات</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          للبدء، أدخلي رقم الهوية الوطنية المسجَّل عند التقديم.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="national_id">رقم الهوية الوطنية</Label>
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
          <Button type="submit" className="w-full" disabled={loading || nationalId.length === 0}>
            {loading ? 'جارٍ التحقق…' : 'التالي'}
            <ArrowRight size={16} className="ms-2 rtl:rotate-180" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ConfirmStage({ applicant, agreed, setAgreed, loading, onPledge, onBack }: {
  applicant: Applicant;
  agreed: boolean;
  setAgreed: (b: boolean) => void;
  loading: boolean;
  onPledge: () => void;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">تعهد الالتزام باتفاقية الطالبات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section: إقرار وإلتزام */}
        <section className="space-y-4">
          <h2 className="font-display text-lg border-b pb-2">
            إقرار وإلتزام
            <span className="text-sm text-muted-foreground font-body block mt-1">
              "ويُغني عن التوقيع الخطي"
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="رقم الهوية" value={applicant.national_id} mono />
            <FieldDisplay label="الاسم الرباعي" value={applicant.full_name} />
          </div>

          <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm leading-loose">
            أتعهد أنا الطالبة في برنامج <strong>الوقار</strong> أن أتقيَّد بجميع ما ورد
            في <strong>"اتفاقية الطالبات"</strong>، وأتحمَّل كامل المسؤولية المُترتِّبة
            على الإخلال بأيِّ بندٍ من بنودها.
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-1" />
            <span className="text-sm">
              أُقرُّ بأنني قرأتُ هذا التعهد وفهمتُه، وأوافق عليه دون إكراه.
            </span>
          </label>
        </section>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onBack} disabled={loading} className="flex-1">
            رجوع
          </Button>
          <Button onClick={onPledge} disabled={loading || !agreed} className="flex-1">
            {loading ? 'جارٍ الحفظ…' : 'أوافق وأتعهَّد'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlreadyPledgedStage({ applicant, onReset }: { applicant: Applicant; onReset: () => void }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <h2 className="font-display text-2xl">سبق إقرار التعهد</h2>
        <p className="text-sm text-muted-foreground">
          الأخت <strong>{applicant.full_name}</strong> سبق إقرارها للتعهد.
        </p>
        <p className="text-xs text-muted-foreground">
          الحالة الحالية: {STATUS_AR[applicant.status]}
        </p>
        <Button variant="outline" onClick={onReset} className="mt-2">
          إقرار طالبة أخرى
        </Button>
      </CardContent>
    </Card>
  );
}

function SuccessStage({ applicant, onReset }: { applicant: Applicant; onReset: () => void }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="font-display text-2xl">تم استلام إقراركِ بنجاح</h2>
        <p className="text-sm text-muted-foreground">
          شكراً <strong>{applicant.full_name}</strong>. وُثِّق إقراركِ بالتعهد، ولا حاجة لإعادته.
        </p>
        <Button variant="outline" onClick={onReset} className="mt-2">
          إقرار طالبة أخرى
        </Button>
      </CardContent>
    </Card>
  );
}

function FieldDisplay({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={`px-3 py-2 bg-muted/30 border border-border rounded-md text-sm ${mono ? 'tabular-nums' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}
