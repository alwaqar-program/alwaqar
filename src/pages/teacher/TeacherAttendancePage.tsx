import { useEffect, useMemo, useState } from 'react';
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
import { Cohort, COHORTS, cohortLabel, COHORT_PLURAL, cohortSubjectColumn, subjectPayload } from '@/lib/cohorts';

const statusOptions = [
  { value: 'present', label: 'حاضرة', color: 'bg-success/10 text-success' },
  { value: 'absent', label: 'غائبة', color: 'bg-destructive/10 text-destructive' },
  { value: 'late', label: 'متأخرة', color: 'bg-warning/10 text-warning' },
  { value: 'excused', label: 'مستأذنة', color: 'bg-info/10 text-info' },
  { value: 'exempted', label: 'معذورة', color: 'bg-accent/15 text-accent-foreground' },
];
const lateReasons = [
  { value: 'illness', label: 'مرض' }, { value: 'transport', label: 'مواصلات' },
  { value: 'sleep', label: 'نوم' }, { value: 'other', label: 'أخرى' },
];

interface Entry { status: string; late_reason: string; late_reason_other: string; }

interface Person { id: string; full_name: string; kind: Cohort; }

export function AttendanceForm({ session }: { session: TeacherSession }) {
  const { toast } = useToast();
  // date يأتي من حقل التاريخ في الترويسة (TeacherGate)
  const { circle, period, date, students, loadingStudents, teacher } = session;

  const [cohort, setCohort] = useState<Cohort>('student');
  const [extra, setExtra] = useState<{ companion: Person[]; beginner: Person[] }>({ companion: [], beginner: [] });
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // كل الأشخاص في الحلقة: طالبات + مرافقات + مبتدئات.
  const people: Person[] = useMemo(() => [
    ...students.map(s => ({ id: s.id, full_name: s.full_name, kind: 'student' as Cohort })),
    ...extra.companion,
    ...extra.beginner,
  ], [students, extra]);

  // الأشخاص المعروضون حسب الفئة المختارة.
  const shownPeople = useMemo(() => people.filter(p => p.kind === cohort), [people, cohort]);

  // Load companions & beginners for the resolved circle (mirrors student load in the gate).
  useEffect(() => {
    const circleId = circle.id;
    if (!circleId) { setExtra({ companion: [], beginner: [] }); return; }
    let cancelled = false;
    setLoadingExtra(true);
    const load = async () => {
      const [coRes, beRes] = await Promise.all([
        supabase.from('companions').select('id, full_name, is_active').eq('circle_id', circleId).order('full_name'),
        supabase.from('beginners').select('id, full_name, is_active').eq('circle_id', circleId).order('full_name'),
      ]);
      if (cancelled) return;
      const map = (rows: any[] | null, kind: Cohort): Person[] =>
        (rows || []).filter(r => r.is_active !== false).map(r => ({ id: r.id, full_name: r.full_name, kind }));
      setExtra({ companion: map(coRes.data, 'companion'), beginner: map(beRes.data, 'beginner') });
      setLoadingExtra(false);
    };
    load();
    return () => { cancelled = true; };
  }, [circle.id]);

  useEffect(() => {
    if (shownPeople.length === 0) { setEntries({}); setExisting(new Set()); return; }
    const col = cohortSubjectColumn(cohort);
    const load = async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, companion_id, beginner_id, status, late_reason, late_reason_other')
        .eq('date', date).eq('period', period)
        .in(col, shownPeople.map(p => p.id));
      const next: Record<string, Entry> = {};
      const ex = new Set<string>();
      (data || []).forEach(a => {
        const pid = (a as any)[col] as string | null;
        if (!pid) return;
        next[pid] = { status: a.status, late_reason: a.late_reason || '', late_reason_other: a.late_reason_other || '' };
        ex.add(pid);
      });
      shownPeople.forEach(p => { if (!next[p.id]) next[p.id] = { status: 'present', late_reason: '', late_reason_other: '' }; });
      setEntries(next); setExisting(ex);
    };
    load();
  }, [shownPeople, cohort, period, date]);

  const update = (id: string, field: keyof Entry, value: string) =>
    setEntries(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleSave = async () => {
    setSaving(true);
    const toInsert = shownPeople.filter(p => !existing.has(p.id)).map(p => ({ id: p.id, ...entries[p.id] }));
    if (toInsert.length === 0) { toast({ title: 'تم تسجيل الحضور مسبقاً لهذه الفترة' }); setSaving(false); return; }
    for (const e of toInsert) {
      if (e.status === 'late' && !e.late_reason) {
        toast({ title: 'تنبيه', description: `سبب التأخير مطلوب لكل ${cohortLabel(cohort)} متأخرة`, variant: 'destructive' });
        setSaving(false); return;
      }
    }
    const { error } = await supabase.from('attendance').insert(
      toInsert.map(e => ({
        ...subjectPayload(cohort, e.id), date, period, status: e.status,
        late_reason: e.status === 'late' ? e.late_reason : null,
        late_reason_other: e.status === 'late' && e.late_reason === 'other' ? e.late_reason_other : null,
        recorded_by: teacher.teacher_name,
      }))
    );
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else { toast({ title: `تم تسجيل حضور ${toInsert.length} ${cohortLabel(cohort)}` }); setExisting(new Set(shownPeople.map(p => p.id))); }
    setSaving(false);
  };

  const cohortChips = (
    <div className="flex rounded-md border border-border overflow-hidden text-sm">
      {COHORTS.map(k => (
        <button key={k} type="button" onClick={() => setCohort(k)}
          className={`px-4 h-10 transition-colors ${cohort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
          {COHORT_PLURAL[k]}
        </button>
      ))}
    </div>
  );

  if (loadingStudents || loadingExtra) return (
    <>
      {cohortChips}
      <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">جارٍ التحميل…</CardContent></Card>
    </>
  );
  if (shownPeople.length === 0) return (
    <>
      {cohortChips}
      <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-center">
        <ClipboardCheck size={36} className="text-muted-foreground/30 mb-2" />
        <p className="text-muted-foreground text-sm">لا توجد {COHORT_PLURAL[cohort]} في «{circle.circle_name}»</p>
      </CardContent></Card>
    </>
  );

  const vals = Object.values(entries);
  const count = (s: string) => vals.filter(e => e.status === s).length;

  return (
    <>
      {cohortChips}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">حاضرة: {count('present')}</Badge>
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">غائبة: {count('absent')}</Badge>
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">متأخرة: {count('late')}</Badge>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-3">
          {shownPeople.map(s => {
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
