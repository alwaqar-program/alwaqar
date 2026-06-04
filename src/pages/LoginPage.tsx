import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/logo.png';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        toast({ title: 'تم إنشاء الحساب بنجاح', description: 'يرجى تفعيل البريد الإلكتروني' });
      } else {
        await signIn(email, password);
        toast({ title: 'تم تسجيل الدخول بنجاح' });
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <img src={logoImg} alt="شعار تمام" className="mx-auto w-24 h-24 object-contain" />
          <div>
            <h1 className="text-2xl font-display text-foreground">نظام الوقار</h1>
            <p className="text-sm text-muted-foreground mt-1">إدارة حلقات تحفيظ القرآن الكريم</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required dir="ltr" minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '...' : isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'}
            </Button>
            {!isSignUp && (
              <Link
                to="/forgot-password"
                className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                نسيت كلمة المرور؟
              </Link>
            )}
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب جديد'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
