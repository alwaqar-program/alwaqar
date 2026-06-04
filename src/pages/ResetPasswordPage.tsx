import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import logoImg from '@/assets/logo.png';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState<'pending' | 'ok' | 'invalid'>('pending');

  // Supabase puts the recovery session in the URL hash; the SDK handles it
  // automatically via onAuthStateChange. We just wait for the session.
  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) setSessionReady((s) => (s === 'pending' ? 'invalid' : s));
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        clearTimeout(timeout);
        setSessionReady('ok');
      }
    });

    // Also check current session immediately (in case event already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) {
        clearTimeout(timeout);
        setSessionReady('ok');
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'كلمة المرور قصيرة', description: '6 أحرف على الأقل', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'كلمتا المرور غير متطابقتين', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'تعذّر التحديث', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم تحديث كلمة المرور', description: 'يمكنكِ الآن تسجيل الدخول بها' });
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <img src={logoImg} alt="شعار تمام" className="mx-auto w-20 h-20 object-contain" />
          <div>
            <h1 className="text-2xl font-display text-foreground">تعيين كلمة مرور جديدة</h1>
            <p className="text-sm text-muted-foreground mt-1">اختاري كلمة مرور قوية تتذكَّرينها</p>
          </div>
        </CardHeader>
        <CardContent>
          {sessionReady === 'pending' && (
            <p className="text-center text-muted-foreground py-6">جارٍ التحقق من الرابط…</p>
          )}

          {sessionReady === 'invalid' && (
            <div className="space-y-3 text-center py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <p className="font-medium">رابط غير صالح أو منتهي الصلاحية</p>
              <p className="text-sm text-muted-foreground">
                اطلبي رابط إعادة تعيين جديد من صفحة "نسيت كلمة المرور".
              </p>
              <Button variant="outline" onClick={() => navigate('/forgot-password')} className="w-full">
                طلب رابط جديد
              </Button>
            </div>
          )}

          {sessionReady === 'ok' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    dir="ltr"
                    className="pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                  dir="ltr"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
