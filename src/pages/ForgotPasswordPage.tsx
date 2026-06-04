import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import logoImg from '@/assets/logo.png';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <img src={logoImg} alt="شعار تمام" className="mx-auto w-20 h-20 object-contain" />
          <div>
            <h1 className="text-2xl font-display text-foreground">إعادة تعيين كلمة المرور</h1>
            <p className="text-sm text-muted-foreground mt-1">
              أدخلي بريدكِ المسجَّل وسنرسل لكِ رابط إعادة التعيين
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="font-medium">تم إرسال الرابط</p>
                <p className="text-sm text-muted-foreground mt-1">
                  افتحي رسالة الإيميل من <strong>{email}</strong> واضغطي على الرابط لتعيين كلمة مرور جديدة.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  لم تصلكِ الرسالة؟ تحققي من مجلد الرسائل غير المرغوبة أو حاولي مرة أخرى.
                </p>
              </div>
              <Button variant="outline" onClick={() => setSent(false)} className="w-full">
                إعادة المحاولة
              </Button>
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowRight size={14} />
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    dir="ltr"
                    className="pr-9"
                    autoFocus
                  />
                  <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? 'جارٍ الإرسال…' : 'إرسال رابط الإعادة'}
              </Button>
              <Link
                to="/login"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowRight size={14} />
                العودة لتسجيل الدخول
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
