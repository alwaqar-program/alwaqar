import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { Save, ClipboardCheck } from 'lucide-react';
import TeacherGate, { TeacherSession } from '@/components/teacher/TeacherGate';

const statusOptions = [
  { value: 'present', label: 'حاضرة', color: 'bg-success/10 text-success' },
  { value: 'absent', label: 'غائبة', color: 'bg-destructive/10 text-destructive' },
  { value: 'late', label: 'متأخرة', color: 'bg-warning/10 text-warning' },
  { value: 'excused', label: 'مستأذنة', color: 'bg-info/10 text-info' },
];
const lateReasons = [
  { value: 'illness', label: 'مرض' }, { value: 'transport', label: 'مواصلات' },
  { value: 'sleep', label: 'نوم' }, { value: 'other', label: 'أخرى' },
];

interface Entry { status: string; late_reason: string; late_reason_other: string; }

function AttendanceForm({ session }: { session: TeacherSession }) {
  const { toast } = useToast();
  // date يأتي من حقل التاريخ في الترويسة (TeacherGate)
  const { circle, period, date, students, loadingStudents, teacher } = session;

  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (students.length === 0) { setEntries({}); setExisting(new Set()); return; }
    const load = async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status, late_reason, late_reason_other')
        .eq('date', date).eq('period', period)
        .in('student_id', students.map(s => s.id));
      const next: Record<string, Entry> = {};
      const ex = new Set<string>();
      (data || []).forEach(a => {
        next[a.student_id] = { status: a.status, late_reason: a.late_reason || '', late_reason_other: a.late_reason_other || '' };
        ex.add(a.student_id);
      });
      students.forEach(s => { if (!next[s.id]) next[s.id] = { status: 'present', late_reason: '', late_reason_other: '' }; });
      setEntries(next); setExisting(ex);
    };
    load();
  }, [students, period, date]);

  const update = (id: string, field: keyof Entry, value: string) =>
    setEntries(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleSave = async () => {
    setSaving(true);
    const toInsert = students.filter(s => !existing.has(s.id)).map(s => ({ id: s.id, ...entries[s.id] }));
    if (toInsert.length === 0) { toast({ title: 'تم تسجيل الحضور مسبقاً لهذه الفترة' }); setSaving(false); return; }
    for (const e of toInsert) {
      if (e.status === 'late' && !e.late_reason) {
        toast({ title: 'خطأ', description: 'سبب التأخير مطلوب لكل طالبة متأخرة', variant: 'destructive' });
        setSaving(false); return;
      }
    }
    const { error } = await supabase.from('attendance').insert(
      toInsert.map(e => ({
        student_id: e.id, date, period, status: e.status,
        late_reason: e.status === 'late' ? e.late_reason : null,
        late_reason_other: e.status === 'late' && e.late_reason === 'other' ? e.late_reason_other : null,
        recorded_by: teacher.teacher_name,
      }))
    );
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else { toast({ title: `تم تسجيل حضور ${toInsert.length} طالبة` }); setExisting(new Set(students.map(s => s.id))); }
    setSaving(false);
  };

  if (loadingStudents) return <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">جارٍ تحميل الطالبات…</CardContent></Card>;
  if (students.length === 0) return (
    <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-center">
      <ClipboardCheck size={36} className="text-muted-foreground/30 mb-2" />
      <p className="text-muted-foreground text-sm">لا توجد طالبات مسجلات في «{circle.circle_name}»</p>
    </CardContent></Card>
  );

  const vals = Object.values(entries);
  const count = (s: string) => vals.filter(e => e.status === s).length;

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">حاضرة: {count('present')}</Badge>
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">غائبة: {count('absent')}</Badge>
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">متأخرة: {count('late')}</Badge>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-3">
          {students.map(s => {
            const entry = entries[s.id]; if (!entry) return null;
            const isEx = existing.has(s.id);
            return (
              <div key={s.id} className={`p-3 rounded-lg border space-y-2 ${isEx ? 'bg-muted/30 opacity-70' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{s.full_name}</span>
                  {isEx && <Badge variant="outline" className="text-xs">مسجّل</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(opt => (
                    <button key={opt.value} disabled={isEx} onClick={() => update(s.id, 'status', opt.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${entry.status === opt.value ? opt.color + ' border-current' : 'bg-background border-border hover:bg-muted'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {entry.status === 'late' && !isEx && (
                  <div className="flex gap-2 pt-1">
                    <SearchableSelect className="h-8 text-xs w-32" options={lateReasons} value={entry.late_reason}
                      onValueChange={v => update(s.id, 'late_reason', v)} placeholder="السبب" searchPlaceholder="ابحث…" />
                    {entry.late_reason === 'other' && (
                      <Input className="h-8 text-xs" placeholder="حدد السبب" value={entry.late_reason_other}
                        onChange={e => update(s.id, 'late_reason_other', e.target.value)} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save size={18} /> {saving ? 'جارٍ الحفظ…' : 'حفظ الحضور'}
      </Button>
    </>
  );
}

export default function TeacherAttendancePage() {
  return (
    <TeacherGate title="تسجيل الحضور" subtitle="أدخلي رقم هويتك لعرض طالبات حلقتك" needsPeriod dateLabel="تاريخ الحضور">
      {session => <AttendanceForm session={session} />}
    </TeacherGate>
  );
}
