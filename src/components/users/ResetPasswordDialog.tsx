import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetFullName: string;
}

// Generate a memorable temporary password
function generatePassword(length = 10): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) p += chars[arr[i] % chars.length];
  return p;
}

export default function ResetPasswordDialog({ open, onOpenChange, targetUserId, targetFullName }: Props) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword(generatePassword());
      setShow(true);
      setDone(false);
    }
  }, [open]);

  function regenerate() {
    setPassword(generatePassword());
    setShow(true);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      toast({ title: 'تم النسخ', description: 'كلمة المرور في الحافظة' });
    } catch {
      toast({ title: 'تعذّر النسخ', variant: 'destructive' });
    }
  }

  async function handleSubmit() {
    if (password.length < 6) {
      toast({ title: 'كلمة المرور قصيرة', description: '6 أحرف على الأقل', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('reset-user-password', {
      body: { user_id: targetUserId, new_password: password },
    });
    setSubmitting(false);

    if (error || (data && data.error)) {
      toast({
        title: 'تعذّر إعادة التعيين',
        description: data?.error ?? error?.message ?? 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
      return;
    }
    setDone(true);
    toast({
      title: 'تمت إعادة التعيين',
      description: 'انسخي كلمة المرور وأرسليها للمستخدم بطريقة آمنة',
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <KeyRound size={18} />
            إعادة تعيين كلمة المرور
          </DialogTitle>
          <DialogDescription>
            للمستخدم: <span className="font-medium text-foreground">{targetFullName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>كلمة المرور الجديدة</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setDone(false); }}
                  dir="ltr"
                  className="pl-10 tabular-nums"
                  readOnly={done}
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
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} title="نسخ">
                <Copy size={16} />
              </Button>
              {!done && (
                <Button type="button" variant="outline" size="icon" onClick={regenerate} title="توليد جديد">
                  <RefreshCw size={16} />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {done
                ? 'انسخي كلمة المرور أعلاه وأرسليها للمستخدم. لن تظهر مرة أخرى.'
                : 'يُولَّد تلقائياً، أو يمكنكِ كتابة قيمة مخصصة. الحد الأدنى 6 أحرف.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {done ? 'إغلاق' : 'إلغاء'}
          </Button>
          {!done && (
            <Button onClick={handleSubmit} disabled={submitting || password.length < 6}>
              {submitting ? 'جارٍ التحديث…' : 'تأكيد إعادة التعيين'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
