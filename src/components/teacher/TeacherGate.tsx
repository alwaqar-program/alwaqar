import { ReactNode, useEffect, useLayoutEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { KeyRound, LogOut, UserCheck } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import {
  Period, PERIOD_LABEL, StudentLite, TeacherCircle, TeacherInfo,
  lookupTeacherByNationalId, loadCircleStudents,
} from '@/lib/teacher-session';

export interface TeacherSession {
  teacher: TeacherInfo;
  circle: TeacherCircle;
  period: Period;
  students: StudentLite[];
  loadingStudents: boolean;
  reloadStudents: () => Promise<void>;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Show the morning/evening toggle (recitation & attendance need it; exams don't). */
  needsPeriod?: boolean;
  children: (session: TeacherSession) => ReactNode;
}

export default function TeacherGate({ title, subtitle, needsPeriod = false, children }: Props) {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const prev = document.title;
    document.title = `${title} — حلقات الوقار`;
    return () => { document.title = prev; };
  }, [title]);

  const [nationalId, setNationalId] = useState('');
  const [checking, setChecking] = useState(false);

  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [circles, setCircles] = useState<TeacherCircle[]>([]);
  const [circleId, setCircleId] = useState('');
  const [period, setPeriod] = useState<Period>('morning');

  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const circle = circles.find(c => c.id === circleId) || null;

  // When the selected circle changes, default the period to one it covers.
  useEffect(() => {
    if (circle && !circle.periods.includes(period)) {
      setPeriod(circle.periods[0] ?? 'morning');
    }
  }, [circle, period]);

  const reloadStudents = async () => {
    if (!circleId) return;
    setLoadingStudents(true);
    setStudents(await loadCircleStudents(circleId));
    setLoadingStudents(false);
  };

  useEffect(() => {
    if (!circleId) { setStudents([]); return; }
    let cancelled = false;
    setLoadingStudents(true);
    loadCircleStudents(circleId).then(s => {
      if (!cancelled) { setStudents(s); setLoadingStudents(false); }
    });
    return () => { cancelled = true; };
  }, [circleId]);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!nationalId.trim()) return;
    setChecking(true);
    try {
      const result = await lookupTeacherByNationalId(nationalId);
      if (!result) {
        toast({ title: 'لم نتعرّف على الرقم', description: 'لا توجد معلمة فعّالة بهذا رقم الهوية.', variant: 'destructive' });
        return;
      }
      if (result.circles.length === 0) {
        toast({ title: 'لا توجد حلقة', description: 'لست مكلّفة بأي حلقة فعّالة حالياً. راجعي الإدارة.', variant: 'destructive' });
        return;
      }
      setTeacher(result.teacher);
      setCircles(result.circles);
      setCircleId(result.circles[0].id);
      setPeriod(result.circles[0].periods[0] ?? 'morning');
    } catch (err) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  const reset = () => {
    setTeacher(null);
    setCircles([]);
    setCircleId('');
    setStudents([]);
    setNationalId('');
  };

  // ---------- Gate ----------
  if (!teacher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center space-y-3">
            <img src={logoImg} alt="" className="h-16 w-16 object-contain" />
            <div>
              <CardTitle className="font-display text-lg">{title}</CardTitle>
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nid">رقم هوية المعلمة</Label>
                <div className="relative">
                  <KeyRound size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nid"
                    className="pr-9"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="١٠٠٠٠٠٠٠٠٠"
                    value={nationalId}
                    onChange={e => setNationalId(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={checking || !nationalId.trim()}>
                {checking ? 'جارٍ التحقق…' : 'دخول'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Authenticated shell ----------
  const showPeriodToggle = needsPeriod && (circle?.periods.length ?? 0) > 1;
  const session: TeacherSession | null = circle
    ? { teacher, circle, period, students, loadingStudents, reloadStudents }
    : null;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UserCheck size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{teacher.teacher_name}</p>
                  <p className="text-xs text-muted-foreground">{title}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={reset}>
                <LogOut size={14} /> خروج
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[200px] flex-1">
                <Label className="text-xs">الحلقة</Label>
                {circles.length > 1 ? (
                  <SearchableSelect
                    options={circles.map(c => ({ value: c.id, label: c.circle_name }))}
                    value={circleId}
                    onValueChange={setCircleId}
                    placeholder="اختر الحلقة"
                    searchPlaceholder="ابحث…"
                  />
                ) : (
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-medium">
                    {circle?.circle_name}
                  </div>
                )}
              </div>

              {needsPeriod && (
                <div className="space-y-1.5">
                  <Label className="text-xs">الفترة</Label>
                  {showPeriodToggle ? (
                    <div className="flex rounded-md border border-border overflow-hidden text-sm">
                      {circle!.periods.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPeriod(p)}
                          className={`px-4 h-10 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          {PERIOD_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-medium">
                      {PERIOD_LABEL[period]}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {session && children(session)}
      </div>
    </div>
  );
}
