import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { softDeleteApplicant } from '@/lib/applicant-actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantId: string;
  applicantName: string;
  onDeleted?: () => void;
}

export default function DeleteApplicantDialog({ open, onOpenChange, applicantId, applicantName, onDeleted }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) {
      toast({ title: 'يرجى ذكر سبب الحذف', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await softDeleteApplicant(applicantId, reason.trim());
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر الحذف', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم الحذف', description: 'تم نقل المتقدمة إلى الحالة "محذوفة"' });
    onOpenChange(false);
    setReason('');
    onDeleted?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف المتقدمة</AlertDialogTitle>
          <AlertDialogDescription>
            ستُنقل المتقدمة <strong>{applicantName}</strong> إلى الحالة "محذوفة" مع الاحتفاظ ببياناتها (يمكن استرجاعها لاحقاً).
            يرجى ذكر سبب الحذف لتسجيله في السجل.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2 space-y-2">
          <Label className="text-sm">سبب الحذف <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: تسجيل مكرر، انسحبت بنفسها، بيانات غير صحيحة…"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting || !reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
