import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  BookOpen, GraduationCap, Users, Mic, TrendingUp,
  BookMarked, ClipboardList, Layers, Percent,
} from 'lucide-react';

const gradeColors: Record<string, string> = {
  'ممتاز': 'bg-success/10 text-success',
  'جيد جداً': 'bg-info/10 text-info',
  'جيد': 'bg-accent/10 text-accent',
  'مقبول': 'bg-warning/10 text-warning',
  'ضعيف': 'bg-destructive/10 text-destructive',
};

const PAGES_PER_JUZ = 20;
const PAGES_PER_KHATMA = 604;

const toISO = (d: Date) => d.toISOString().split('T')[0];
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000);

// Arabic-Indic formatting to match the official dashboard look (١٣٬٧٢٠).
const fmt = (n: number) => Math.round(n).toLocaleString('ar-EG');

// Hijri (Umm al-Qura) date label, e.g. "الأربعاء ٢١‏/١‏/١٤٤٧ هـ".
const hijri = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric',
    }).format(new Date(iso + 'T00:00:00')) + ' هـ';
  } catch {
    return iso;
  }
};

interface HarvestMetrics {
  required: number;
  completed: number;
  juz: number;
  khatma: number;
  pct: number;
}

const computeHarvest = (completed: number, required: number): HarvestMetrics => ({
  required,
  completed,
  juz: completed / PAGES_PER_JUZ,
  khatma: completed / PAGES_PER_KHATMA,
  pct: required > 0 ? (completed / required) * 100 : 0,
});

export default function DashboardPage() {
  const [stats, setStats] = useState({ circles: 0, teachers: 0, students: 0 });

  // Course harvest source data (fetched once, recomputed client-side by day).
  const [recRows, setRecRows] = useState<{ date: string; pages: number }[]>([]);
  const [dailyRequired, setDailyRequired] = useState(0);
  const [targetBreakdown, setTargetBreakdown] = useState<
    { name: string; edp: number; count: number; subtotal: number }[]
  >([]);
  const [startDate, setStartDate] = useState<string>(toISO(new Date()));
  const [totalDays, setTotalDays] = useState(21);
  const [day, setDay] = useState(1);

  const [recentRecitations, setRecentRecitations] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toISO(new Date());

  useEffect(() => {
    const fetchAll = async () => {
      const [c, t, s] = await Promise.all([
        supabase.from('circles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('students').select('id', { count: 'exact', head: true })
          .eq('is_active', true).eq('admission_status', 'registered'),
      ]);
      setStats({ circles: c.count || 0, teachers: t.count || 0, students: s.count || 0 });

      // --- Required pages: Σ each active+registered student's branch.expected_daily_pages ---
      const [studRes, circRes, branchRes, recRes] = await Promise.all([
        supabase.from('students').select('circle_id')
          .eq('is_active', true).eq('admission_status', 'registered'),
        supabase.from('circles').select('id, branch_id').eq('is_active', true),
        supabase.from('branches')
          .select('id, branch_name, expected_daily_pages, program_start_date, program_end_date')
          .eq('is_active', true),
        supabase.from('recitation_log').select('date, pages_recited').eq('is_deleted', false),
      ]);

      const circleToBranch = new Map((circRes.data || []).map(c => [c.id, c.branch_id]));
      const branchStudentCount = new Map<string, number>();
      for (const st of studRes.data || []) {
        const bid = st.circle_id ? circleToBranch.get(st.circle_id) : null;
        if (bid) branchStudentCount.set(bid, (branchStudentCount.get(bid) || 0) + 1);
      }
      let reqPerDay = 0;
      const breakdown = (branchRes.data || []).map(b => {
        const count = branchStudentCount.get(b.id) || 0;
        const edp = b.expected_daily_pages ?? 0;
        const subtotal = count * edp;
        reqPerDay += subtotal;
        return { name: b.branch_name as string, edp, count, subtotal };
      }).sort((a, b) => b.subtotal - a.subtotal);
      setDailyRequired(reqPerDay);
      setTargetBreakdown(breakdown);

      const recs = (recRes.data || []).map(r => ({ date: r.date as string, pages: r.pages_recited || 0 }));
      setRecRows(recs);

      // --- Course timeline ---
      const branches = branchRes.data || [];
      const startCandidates = branches.map(b => b.program_start_date).filter(Boolean) as string[];
      const recDates = recs.map(r => r.date).filter(Boolean);
      const courseStart = startCandidates.length
        ? startCandidates.sort()[0]
        : recDates.length ? recDates.sort()[0] : today;
      setStartDate(courseStart);

      const spans = branches
        .filter(b => b.program_start_date && b.program_end_date)
        .map(b => daysBetween(b.program_start_date as string, b.program_end_date as string) + 1);
      const total = spans.length ? Math.max(...spans) : 21;
      setTotalDays(total);

      // Default the slider to today's course day (clamped to the course length).
      const elapsed = Math.min(total, Math.max(1, daysBetween(courseStart, today) + 1));
      setDay(elapsed);

      // Recent recitations (last 8)
      const { data: recentRec } = await supabase
        .from('recitation_log')
        .select('id, date, from_surah, to_surah, from_page, to_page, pages_recited, error_count, grade, students(full_name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentRecitations(recentRec || []);

      // Top students by pages (this week)
      const weekAgo = addDays(today, -7);
      const { data: weekRec } = await supabase
        .from('recitation_log')
        .select('student_id, pages_recited, students(full_name)')
        .eq('is_deleted', false)
        .gte('date', weekAgo);
      const studentPages: Record<string, { name: string; pages: number }> = {};
      (weekRec || []).forEach(r => {
        const sid = r.student_id;
        if (!studentPages[sid]) studentPages[sid] = { name: (r.students as any)?.full_name || '', pages: 0 };
        studentPages[sid].pages += r.pages_recited || 0;
      });
      setTopStudents(Object.values(studentPages).sort((a, b) => b.pages - a.pages).slice(0, 5));

      setLoading(false);
    };
    fetchAll();
  }, [today]);

  const dayDate = useMemo(() => addDays(startDate, day - 1), [startDate, day]);

  const daily = useMemo(() => {
    const completed = recRows
      .filter(r => r.date === dayDate)
      .reduce((sum, r) => sum + r.pages, 0);
    return computeHarvest(completed, dailyRequired);
  }, [recRows, dayDate, dailyRequired]);

  const cumulative = useMemo(() => {
    const completed = recRows
      .filter(r => r.date >= startDate && r.date <= dayDate)
      .reduce((sum, r) => sum + r.pages, 0);
    return computeHarvest(completed, dailyRequired * day);
  }, [recRows, startDate, dayDate, dailyRequired, day]);

  const summaryCards = [
    { label: 'عدد الطالبات', value: stats.students, icon: <Users size={22} />, color: 'text-success' },
    { label: 'عدد الحلقات', value: stats.circles, icon: <BookOpen size={22} />, color: 'text-accent' },
    { label: 'عدد المعلمات', value: stats.teachers, icon: <GraduationCap size={22} />, color: 'text-info' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground">بسم الله الرحمن الرحيم</h1>
        <p className="text-muted-foreground mt-1">مرحباً بك في نظام الوقار لإدارة حلقات تحفيظ القرآن الكريم</p>
      </div>

      {/* General Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryCards.map((c, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg bg-muted flex items-center justify-center ${c.color}`}>{c.icon}</div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : fmt(c.value)}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Day selector */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">عدد الأيام</span>
            <Badge variant="outline" className="text-sm font-bold bg-primary/10 text-primary border-primary/20">
              اليوم {fmt(day)}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">{fmt(totalDays)}</span>
            <Slider
              dir="ltr"
              min={1}
              max={totalDays}
              step={1}
              value={[day]}
              onValueChange={([v]) => setDay(v)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums">١</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily target source (where الأوجه المطلوبة comes from) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            المستهدف اليومي الإجمالي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold tabular-nums text-primary">{loading ? '...' : fmt(dailyRequired)}</span>
            <span className="text-sm text-muted-foreground">صفحة / يوم — وهي «الأوجه المطلوبة» اليومية</span>
          </div>
          {targetBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لم يُحدَّد المستهدف اليومي للفروع أو لا توجد طالبات مسجلات في حلقات.
              عدّلي «المستهدف اليومي» لكل فرع من صفحة إدارة الفروع.
            </p>
          ) : (
            <div className="space-y-1.5">
              {targetBreakdown.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border/40 pb-1.5 last:border-0">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {fmt(b.count)} طالبة × {b.edp.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}{' '}
                    = <span className="text-foreground font-semibold tabular-nums">{fmt(b.subtotal)}</span> صفحة
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily harvest */}
      <HarvestSection
        title={`حصيلة يوم ${hijri(dayDate)}`}
        metrics={daily}
        loading={loading}
      />

      {/* Cumulative harvest */}
      <HarvestSection
        title="الحصيلة التراكمية للدورة"
        metrics={cumulative}
        loading={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Recitations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Mic size={18} className="text-primary" />
              آخر التسميعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRecitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد تسميعات بعد</p>
            ) : (
              <div className="space-y-2">
                {recentRecitations.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 text-sm">
                    <div>
                      <p className="font-medium">{(r.students as any)?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.from_surah} → {r.to_surah} · {r.pages_recited} صفحات</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${gradeColors[r.grade] || ''}`}>{r.grade}</Badge>
                      <span className="text-xs text-muted-foreground" dir="ltr">{r.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Students This Week */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp size={18} className="text-success" />
              أكثر الطالبات إنجازاً (الأسبوع)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات</p>
            ) : (
              <div className="space-y-2">
                {topStudents.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      {s.pages} صفحة
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quran Verse */}
      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-lg font-display">
            ﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">سورة الحجر - آية 9</p>
        </CardContent>
      </Card>
    </div>
  );
}

function HarvestSection({ title, metrics, loading }: { title: string; metrics: HarvestMetrics; loading: boolean }) {
  const cells = [
    { label: 'الأوجه المطلوبة', value: fmt(metrics.required), icon: <ClipboardList size={16} /> },
    { label: 'الأوجه المنجزة', value: fmt(metrics.completed), icon: <BookOpen size={16} /> },
    { label: 'الأجزاء المنجزة', value: fmt(metrics.juz), icon: <Layers size={16} /> },
    { label: 'تعادل من ختمات', value: `${fmt(metrics.khatma)} ختمة`, icon: <BookMarked size={16} /> },
    { label: 'نسبة الإنجاز', value: `${fmt(metrics.pct)}%`, icon: <Percent size={16} /> },
  ];
  return (
    <div>
      <div className="rounded-lg bg-primary text-primary-foreground text-center py-2.5 mb-3 font-display">
        {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cells.map((c, i) => (
          <Card key={i} className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-2">
                {c.icon}
                <span className="text-xs">{c.label}</span>
              </div>
              <div className="rounded-md bg-primary/10 text-primary font-bold py-2 text-lg tabular-nums">
                {loading ? '...' : c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
