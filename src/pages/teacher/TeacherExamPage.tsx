import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, FileCheck } from 'lucide-react';
import TeacherGate, { TeacherSession } from '@/components/teacher/TeacherGate';

const examTypes: Record<string, string> = { weekly_1: 'الأسبوع الأول', weekly_2: 'الأسبوع الثاني', final: 'النهائي' };
// الإدخال لكل الاختبارات: عدد الأخطاء + عدد اللحون (كلٌّ يخصم ربع درجة).
// تُخزَّن الأخطاء في errors_section_1 واللحون في errors_section_2.
// الدرجة تُحسب في قاعدة البيانات وتظهر للمشرفات فقط — لا تُعرض للمعلمة هنا.

function ExamForm({ session }: { session: TeacherSession }) {
  const { toast } = useToast();
  // date يأتي من حقل التاريخ في الترويسة (TeacherGate)
  const { circle, date, students, loadingStudents, teacher } = session;

  const empty = { student_id: '', exam_type: 'weekly_1', errors: 0, lahn: 0, changes: 0 };
  const [form, setForm] = useState(empty);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (students.length === 0) { setExisting(new Set()); return; }
    supabase.from('exams').select('student_id, exam_type').eq('is_deleted', false)
      .in('student_id', students.map(s => s.id))
      .then(({ data }) => setExisting(new Set((data || []).map(e => `${e.student_id}-${e.exam_type}`))));
  }, [students]);

  const isDup = !!form.student_id && existing.has(`${form.student_id}-${form.exam_type}`);

  const save = async () => {
    if (!form.student_id) { toast({ title: 'تنبيه', description: 'اختاري الطالبة', variant: 'destructive' }); return; }
    if (isDup) { toast({ title: 'تنبيه', description: 'سجّلت هذه الطالبة هذا الاختبار مسبقاً', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('exams').insert({
      student_id: form.student_id, exam_type: form.exam_type, date,
      errors_section_1: form.errors, // عدد الأخطاء
      errors_section_2: form.lahn,   // عدد اللحون (يخصم ربع درجة مثل الخطأ)
      errors_section_3: 0,
      errors_section_4: 0,
      segment_changes: form.changes, examiner_name: teacher.teacher_name,
      recorded_by: teacher.teacher_name, // سجل: من أدخلت الاختبار
      // total_errors, total_score, max_score are computed by the database
    });
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'تم تسجيل الاختبار' });
      setExisting(prev => new Set(prev).add(`${form.student_id}-${form.exam_type}`));
      setForm(empty);
    }
    setSaving(false);
  };

  if (loadingStudents) return <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">جارٍ تحميل الطالبات…</CardContent></Card>;
  if (students.length === 0) return (
    <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-center">
      <FileCheck size={36} className="text-muted-foreground/30 mb-2" />
      <p className="text-muted-foreground text-sm">لا توجد طالبات مسجلات في «{circle.circle_name}»</p>
    </CardContent></Card>
  );

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">الطالبة</Label>
          <SearchableSelect options={students.map(s => ({ value: s.id, label: s.full_name }))}
            value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))}
            placeholder="اختاري الطالبة" searchPlaceholder="ابحث…" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">نوع الاختبار</Label>
          <SearchableSelect options={Object.keys(examTypes).map(k => ({ value: k, label: examTypes[k] }))}
            value={form.exam_type} onValueChange={v => setForm(f => ({ ...f, exam_type: v }))}
            placeholder="النوع" searchPlaceholder="ابحث…" />
        </div>
        {isDup && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
            <AlertCircle size={16} /> سجّلت هذه الطالبة هذا الاختبار مسبقاً
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">عدد الأخطاء</Label>
            <Input type="number" min={0} value={form.errors} onChange={e => setForm(f => ({ ...f, errors: parseInt(e.target.value) || 0 }))} /></div>
          <div className="space-y-1.5"><Label className="text-xs">عدد اللحون</Label>
            <Input type="number" min={0} value={form.lahn} onChange={e => setForm(f => ({ ...f, lahn: parseInt(e.target.value) || 0 }))} /></div>
        </div>
        {/* تغيير المقطع مسموح مرة واحدة فقط */}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.changes === 1} onCheckedChange={v => setForm(f => ({ ...f, changes: v ? 1 : 0 }))} />
          غيّرت المقطع (مسموح مرة واحدة فقط)
        </label>
        {/* مجموع الأخطاء والدرجة يُحسبان في النظام ويظهران للمشرفات فقط */}
        <Button onClick={save} disabled={saving || isDup} className="w-full">{saving ? 'جارٍ الحفظ…' : 'حفظ الاختبار'}</Button>
      </CardContent>
    </Card>
  );
}

export default function TeacherExamPage() {
  return (
    <TeacherGate title="تسجيل الاختبار" subtitle="أدخلي رقم هويتك لعرض طالبات حلقتك" dateLabel="تاريخ الاختبار">
      {session => <ExamForm session={session} />}
    </TeacherGate>
  );
}
