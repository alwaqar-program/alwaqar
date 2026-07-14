import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MicOff, ClipboardX } from 'lucide-react';
import { lateReasonLabel } from '@/lib/late-reasons';

// Daily follow-up: who hasn't recited today (and why), and who has no attendance.
// Read-only — depends only on existing tables, so it is safe regardless of new migrations.

type Period = 'morning' | 'evening';

const statusLabel: Record<string, string> = {
  present: 'حاضرة',
  absent: 'غائبة',
  late: 'متأخرة',
  excused: 'مستأذنة',
  exempted: 'معذورة',
  none: 'بلا تحضير',
};
const statusColor: Record<string, string> = {
  present: 'bg-success/10 text-success border-success/20',
  absent: 'bg-destructive/10 text-destructive border-destructive/20',
  late: 'bg-warning/10 text-warning border-warning/20',
  excused: 'bg-info/10 text-info border-info/20',
  exempted: 'bg-accent/15 text-accent-foreground border-accent/30',
  none: 'bg-muted text-muted-foreground',
};
interface Student { id: string; full_name: string; circle_id: string | null; }
interface Att { student_id: string; status: string; period: string; late_reason: string | null; late_reason_other: string | null; }
interface Rec { student_id: string; period: string; }

export default function DailyFollowUp() {
  const [students, setStudents] = useState<Student[]>([]);
  const [circles, setCircles] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Att[]>([]);
  const [recitations, setRecitations] = useState<Rec[]>([]);
  const [period, setPeriod] = useState<Period>('morning');
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const load = async () => {
      const [s, c, a, r] = await Promise.all([
        supabase.from('students').select('id, full_name, circle_id')
          .eq('is_active', true),
        supabase.from('circles').select('id, circle_name').eq('is_active', true),
        supabase.from('attendance').select('student_id, status, period, late_reason, late_reason_other')
          .eq('date', today).eq('is_deleted', false),
        supabase.from('recitation_log').select('student_id, period')
          .eq('date', today).eq('is_deleted', false),
      ]);
      setStudents((s.data as Student[]) || []);
      const cMap: Record<string, string> = {};
      (c.data || []).forEach((x: any) => { cMap[x.id] = x.circle_name; });
      setCircles(cMap);
      setAttendance((a.data as Att[]) || []);
      setRecitations((r.data as Rec[]) || []);
      setLoading(false);
    };
    load();
  }, [today]);

  const { notRecited, noAttendance } = useMemo(() => {
    const recitedIds = new Set(recitations.filter(r => r.period === period).map(r => r.student_id));
    const attByStudent = new Map<string, Att>();
    attendance.filter(a => a.period === period).forEach(a => attByStudent.set(a.student_id, a));

    const inCircle = students.filter(s => s.circle_id); // only students assigned to a circle

    const notRecited = inCircle
      .filter(s => !recitedIds.has(s.id))
      .map(s => {
        const att = attByStudent.get(s.id);
        const status = att?.status ?? 'none';
        const reason = att?.late_reason ? lateReasonLabel(att.late_reason, att.late_reason_other) : null;
        return { id: s.id, name: s.full_name, circle: s.circle_id ? circles[s.circle_id] : '—', status, reason };
      })
      .sort((a, b) => (a.circle || '').localeCompare(b.circle || '', 'ar'));

    const noAttendance = inCircle
      .filter(s => !attByStudent.has(s.id))
      .map(s => ({ id: s.id, name: s.full_name, circle: s.circle_id ? circles[s.circle_id] : '—' }))
      .sort((a, b) => (a.circle || '').localeCompare(b.circle || '', 'ar'));

    return { notRecited, noAttendance };
  }, [students, circles, attendance, recitations, period]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            متابعة اليوم
          </CardTitle>
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(['morning', 'evening'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {p === 'morning' ? 'الفترة الصباحية' : 'الفترة المسائية'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">جارٍ التحميل…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Did not recite */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <MicOff size={16} className="text-destructive" />
                لم تُسمِّع اليوم
                <Badge variant="outline" className="text-xs">{notRecited.length}</Badge>
              </div>
              {notRecited.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">سمّعت جميع الطالبات 🎉</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {notRecited.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/50 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.circle}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.reason && <span className="text-xs text-muted-foreground">{s.reason}</span>}
                        <Badge variant="outline" className={`text-xs ${statusColor[s.status] || ''}`}>
                          {statusLabel[s.status] || s.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* No attendance recorded */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <ClipboardX size={16} className="text-warning" />
                بلا تسجيل حضور
                <Badge variant="outline" className="text-xs">{noAttendance.length}</Badge>
              </div>
              {noAttendance.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">سُجِّل حضور الجميع ✅</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {noAttendance.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/50 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.circle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
