import { ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { sortCircles } from '@/lib/circle-order';
import { CircleType, circleTypeLabel } from '@/lib/circle-type';
import { BookOpen } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';
import {
  Period, PERIOD_LABEL, StudentLite, TeacherCircle, loadCircleStudents,
} from '@/lib/teacher-session';
import { TeacherSession } from '@/components/teacher/TeacherGate';

interface Props {
  title: string;
  subtitle?: string;
  /** Show the morning/evening toggle (recitation & attendance need it; exams don't). */
  needsPeriod?: boolean;
  /** Label of the compact date field in the header (e.g. "تاريخ التسميع"). */
  dateLabel?: string;
  /** Which circles to list. 'sponsor' = تابعة للحرم entry; default 'regular' (our circles). */
  circleType?: CircleType;
  children: (session: TeacherSession) => ReactNode;
}

/**
 * A gate like {@link TeacherGate} but WITHOUT a teacher login: it lists ALL
 * active circles so a supervisor (with no fixed circle) can pick any circle and
 * record for its students. Records are attributed to the optional "اسم المسجِّلة"
 * field, or «رابط عام (بدون معلمة)» when left blank — teacher_id is null.
 */
export default function CircleGate({ title, subtitle, needsPeriod = false, dateLabel, circleType = 'regular', children }: Props) {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const prev = document.title;
    document.title = `${title} — حلقات الوقار`;
    return () => { document.title = prev; };
  }, [title]);

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState<Period>('morning');
  const [recorderName, setRecorderName] = useState('');

  const [circles, setCircles] = useState<TeacherCircle[]>([]);
  const [circleId, setCircleId] = useState('');
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const circle = circles.find(c => c.id === circleId) || null;

  // Load every active circle. Any circle covers both periods here (the
  // recorder chooses), matching the admin recitation/attendance pages.
  useEffect(() => {
    supabase.from('circles').select('id, circle_name, branch_id, circle_type, allow_unrestricted_recitation').eq('is_active', true)
      .eq('circle_type', circleType ?? 'regular').order('circle_name')
      .then(({ data, error }) => {
        if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
        setCircles(sortCircles((data || []).map(c => ({
          id: c.id, circle_name: c.circle_name, branch_id: c.branch_id ?? null,
          circle_type: c.circle_type ?? 'regular',
          allow_unrestricted_recitation: c.allow_unrestricted_recitation ?? false,
          periods: ['morning', 'evening'] as Period[],
        }))));
      });
  }, [toast, circleType]);

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

  const recorder = recorderName.trim() || 'رابط عام (بدون معلمة)';
  const session: TeacherSession | null = circle
    ? {
        teacher: { id: '', teacher_name: recorder, national_id: null },
        circle, period, date, students, loadingStudents, reloadStudents,
      }
    : null;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="" className="h-9 w-9 object-contain" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{title}</p>
                  {circleTypeLabel(circleType) && <Badge variant="secondary">{circleTypeLabel(circleType)}</Badge>}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[200px] flex-1">
                <Label className="text-xs">الحلقة</Label>
                <SearchableSelect
                  options={circles.map(c => ({ value: c.id, label: c.circle_name }))}
                  value={circleId}
                  onValueChange={setCircleId}
                  placeholder="اختر الحلقة"
                  searchPlaceholder="ابحث عن حلقة…"
                />
              </div>

              {needsPeriod && (
                <div className="space-y-1.5">
                  <Label className="text-xs">الفترة</Label>
                  <div className="flex rounded-md border border-border overflow-hidden text-sm">
                    {(['morning', 'evening'] as Period[]).map(p => (
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
                </div>
              )}

              {dateLabel && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{dateLabel}</Label>
                  <Input
                    type="date"
                    dir="ltr"
                    className="h-10 w-[150px]"
                    value={date}
                    max={today}
                    onChange={e => setDate(e.target.value || today)}
                  />
                </div>
              )}

              <div className="space-y-1.5 min-w-[180px] flex-1">
                <Label className="text-xs">اسم المسجِّلة (اختياري)</Label>
                <Input
                  value={recorderName}
                  onChange={e => setRecorderName(e.target.value)}
                  placeholder="يظهر في السجل — من أدخلت"
                />
              </div>
            </div>

            {dateLabel && date !== today && (
              <p className="text-xs text-warning">تنبيه: تسجّلين على يوم سابق ({date})</p>
            )}
            <p className="text-xs text-muted-foreground">سيُسجَّل في السجل أن المدخِلة: {recorder}</p>
          </CardContent>
        </Card>

        {!circle ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-10 text-center">
              <BookOpen size={36} className="text-muted-foreground/30 mb-2" />
              <p className="text-muted-foreground text-sm">اختاري الحلقة لعرض طالباتها</p>
            </CardContent>
          </Card>
        ) : (
          session && children(session)
        )}
      </div>
    </div>
  );
}
