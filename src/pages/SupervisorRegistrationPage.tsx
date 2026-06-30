import { useState, useLayoutEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2 } from 'lucide-react';
import { registerSupervisor } from '@/lib/supervisor-actions';
import logoImg from '@/assets/logo.png';

const EMPTY_FORM = {
  fullName: '',
  title: '',
  nationalId: '',
  phone: '',
  email: '',
  notes: '',
};

export default function SupervisorRegistrationPage() {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'تسجيل مشرفات الوقار';
    return () => { document.title = previous; };
  }, []);

  const [form, setForm] = useState(EMPTY_FORM);
  const [hasCompanions, setHasCompanions] = useState<boolean | null>(null);
  const [companionsDetails, setCompanionsDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: '' }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'الاسم مطلوب';
    if (!form.title.trim()) e.title = 'المسمى الوظيفي مطلوب';
    if (!form.nationalId.trim()) e.nationalId = 'رقم الهوية مطلوب';
    else if (form.nationalId.trim().length !== 10) e.nationalId = 'رقم الهوية يجب أن يكون 10 أرقام';
    if (!form.phone.trim()) e.phone = 'رقم الجوال مطلوب';
    if (hasCompanions === null) e.hasCompanions = 'الرجاء الإجابة على هذا السؤال';
    if (hasCompanions === true && !companionsDetails.trim()) {
      e.companionsDetails = 'الرجاء كتابة بيانات المرافقين';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || hasCompanions === null) return;
    setSubmitting(true);
    const { error } = await registerSupervisor({
      fullName: form.fullName,
      title: form.title,
      nationalId: form.nationalId,
      phone: form.phone,
      email: form.email,
      hasCompanions,
      companionsDetails,
      notes: form.notes,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر حفظ التسجيل', description: error, variant: 'destructive' });
      return;
    }
    setSubmitted(true);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setHasCompanions(null);
    setCompanionsDetails('');
    setErrors({});
    setSubmitted(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">تسجيل مشرفات الوقار</h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 lg:py-12 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            {submitted ? (
              <div className="flex flex-col items-center text-center gap-4 py-8">
                <CheckCircle2 size={40} className="text-emerald-600" />
                <p className="text-emerald-700 text-lg">تم استلام تسجيلكِ بنجاح. شكراً لكِ.</p>
                <Button variant="outline" onClick={resetForm}>تسجيل مشرفة أخرى</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1 border-b pb-2">
                  <h2 className="font-display text-lg">بيانات المشرفة</h2>
                  <p className="text-sm text-muted-foreground">يُرجى تعبئة البيانات التالية للتسجيل في برنامج الوقار.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">الاسم الرباعي{errors.fullName && <span className="text-destructive"> *</span>}</Label>
                    <Input
                      id="full_name"
                      value={form.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      autoFocus
                    />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">المسمى الوظيفي{errors.title && <span className="text-destructive"> *</span>}</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      placeholder="مثال: مشرفة سكن"
                    />
                    {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="national_id">رقم الهوية{errors.nationalId && <span className="text-destructive"> *</span>}</Label>
                    <Input
                      id="national_id"
                      value={form.nationalId}
                      onChange={(e) => set('nationalId', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10 أرقام"
                      dir="ltr"
                      inputMode="numeric"
                    />
                    {errors.nationalId && <p className="text-xs text-destructive">{errors.nationalId}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الجوال{errors.phone && <span className="text-destructive"> *</span>}</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="05XXXXXXXX"
                      dir="ltr"
                      inputMode="tel"
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>هل معكِ مرافقات؟{errors.hasCompanions && <span className="text-destructive"> *</span>}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={hasCompanions === true ? 'default' : 'outline'}
                      onClick={() => { setHasCompanions(true); setErrors((p) => ({ ...p, hasCompanions: '' })); }}
                    >
                      نعم
                    </Button>
                    <Button
                      type="button"
                      variant={hasCompanions === false ? 'default' : 'outline'}
                      onClick={() => { setHasCompanions(false); setCompanionsDetails(''); setErrors((p) => ({ ...p, hasCompanions: '', companionsDetails: '' })); }}
                    >
                      لا
                    </Button>
                  </div>
                  {errors.hasCompanions && <p className="text-xs text-destructive">{errors.hasCompanions}</p>}
                </div>

                {hasCompanions === true && (
                  <div className="space-y-2">
                    <Label htmlFor="companions_details">
                      بيانات المرافقين{errors.companionsDetails && <span className="text-destructive"> *</span>}
                    </Label>
                    <Textarea
                      id="companions_details"
                      value={companionsDetails}
                      onChange={(e) => {
                        setCompanionsDetails(e.target.value);
                        if (errors.companionsDetails) setErrors((p) => ({ ...p, companionsDetails: '' }));
                      }}
                      rows={3}
                      placeholder="أسماء المرافقين وصلتهم بكِ..."
                    />
                    {errors.companionsDetails && <p className="text-xs text-destructive">{errors.companionsDetails}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'جارٍ الحفظ…' : 'تسجيل'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
