import { ReactNode, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound } from 'lucide-react';
import logoImg from '@/assets/logo.png';

// بصمة SHA-256 لرمز الدخول — الرمز نفسه غير موجود في الكود عمداً
// حتى لا يُستخرج من ملفات الواجهة.
const ACCESS_HASH = 'a6277c42d22ff2052eb68392828fb6a00c8fdb37a79f2a24db1cfbc9aa3eff04';
const STORAGE_KEY = 'alwaqar_gate';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * بوابة رمز على مستوى النظام كله (نفس فكرة بوابة رابط المعلمات):
 * لا تُعرض أي صفحة قبل إدخال الرمز الصحيح. يُحفظ التحقق في sessionStorage
 * فلا يُطلب الرمز عند تحديث الصفحة، ويُطلب من جديد عند فتح تبويب/جلسة جديدة.
 */
export default function AccessGate({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === ACCESS_HASH);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setChecking(true);
    try {
      if ((await sha256Hex(code)) === ACCESS_HASH) {
        sessionStorage.setItem(STORAGE_KEY, ACCESS_HASH);
        setUnlocked(true);
      } else {
        toast({ title: 'رمز غير صحيح', variant: 'destructive' });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center space-y-3">
          <img src={logoImg} alt="" className="h-16 w-16 object-contain" />
          <div>
            <CardTitle className="font-display text-lg">نظام الوقار</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">أدخلي رمز الدخول للمتابعة</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-code">رمز الدخول</Label>
              <div className="relative">
                <KeyRound size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="access-code"
                  type="password"
                  className="pr-9"
                  dir="ltr"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={checking || !code}>
              {checking ? 'جارٍ التحقق…' : 'دخول'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
