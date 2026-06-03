import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ApplicantForm, { ApplicantFormValues } from './ApplicantForm';
import { Applicant } from '@/lib/applicant-labels';
import { createApplicant, updateApplicant } from '@/lib/applicant-actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant?: Applicant;     // present = edit, absent = add
  onSaved?: (saved: Applicant) => void;
}

export default function ApplicantFormDialog({ open, onOpenChange, applicant, onSaved }: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!applicant;

  async function handleSubmit(values: ApplicantFormValues) {
    setSubmitting(true);
    try {
      if (isEdit && applicant) {
        const { data, error } = await updateApplicant(applicant.id, applicant, values);
        if (error) throw new Error(error);
        toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات المتقدمة' });
        if (data) onSaved?.(data);
      } else {
        const { data, error } = await createApplicant(values);
        if (error) throw new Error(error);
        toast({ title: 'تمت الإضافة', description: 'أُضيفت المتقدمة بنجاح' });
        if (data) onSaved?.(data);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'تعذّر الحفظ',
        description: err.message ?? 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل بيانات المتقدمة' : 'إضافة متقدمة جديدة'}</DialogTitle>
        </DialogHeader>
        <ApplicantForm
          initial={applicant}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitting={submitting}
          submitLabel={isEdit ? 'حفظ التعديلات' : 'إضافة'}
        />
      </DialogContent>
    </Dialog>
  );
}
