import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  BookOpen, GraduationCap, Users, Mic, TrendingUp,
  BookMarked, ClipboardList, Layers, Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DailyFollowUp from '@/components/DailyFollowUp';
import { dailyNisab } from '@/lib/program-target';
import { splitHarvest, type HaramFilter } from '@/lib/harvest';
import { isSponsor, CIRCLE_TYPE_FILTERS } from '@/lib/circle-type';

const gradeColors: Record<string, string> = {
  'ممتاز': 'bg-success/10 text-success',
  'جيد جدًا': 'bg-info/10 text-info',
  'جيد': 'bg-accent/10 text-accent',
  'مقبول': 'bg-warning/10 text-warning', // legacy rows
  'ضعيف': 'bg-destructive/10 text-destructive',
};

const PAGES_PER_JUZ = 20;
const PAGES_PER_KHATMA = 604;

// تنسيق التاريخ بمكوّناته المحلية (لا UTC) حتى يتطابق مع التحليل المحلي في addDays
// ومع تواريخ التسميع المخزّنة كـ YYYY-MM-DD؛ استخدام toISOString هنا يُزحزح اليوم
// يوماً كاملاً في التوقيت السعودي (UTC+3).
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  // حصيلة الدورة مُجمّعة في قاعدة البيانات (مجموع الصفحات لكل يوم + نوع الحلقة) —
  // تُجلب دفعةً واحدة (~صفّان لكل تاريخ) وتُعاد الحسبة محلياً حسب اليوم المختار.
  const [recRows, setRecRows] = useState<{ date: string; pages: number; sponsor: boolean }[]>([]);
  const [dailyRequired, setDailyRequired] = useState(0);
  // هل توجد حلقات حرم أصلاً؟ (لإظهار فلتر الحصيلة الثلاثي).
  const [hasSponsor, setHasSponsor] = useState(false);
  // دمج الحرم في الإجماليات افتراضياً، مع إمكانية العرض بدونه.
  const [haramFilter, setHaramFilter] = useState<HaramFilter>('');
  const [targetBreakdown, setTargetBreakdown] = useState<
    { name: string; edp: number; count: number; subtotal: number }[]
  >([]);
  const [startDate, setStartDate] = useState<string>(toISO(new Date()));
  const [totalDays, setTotalDays] = useState(21);
  const [day, setDay] = useState(1);
  const [programStartSet, setProgramStartSet] = useState(true); // false = لا يوجد تاريخ بداية مثبّت

  const [recentRecitations, setRecentRecitations] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toISO(new Date());

  useEffect(() => {
    const fetchAll = async () => {
      const { count: studentCount } = await supabase.from('students')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true).eq('admission_status', 'registered');
      // عدد الحلقات وعدد المعلمات يُحسبان لاحقاً بعد جلب الحلقات والفروع (معلمة لكل حلقة).
      setStats({ circles: 0, teachers: 0, students: studentCount || 0 });

      // --- Required pages + حصيلة مُجمّعة من قاعدة البيانات ---
      // بدل جلب آلاف صفوف التسميع للمتصفح، تُرجّع الدالة مجموع الصفحات لكل (يوم + نوع الحلقة)
      // فقط — أداء ثابت مهما نمت البيانات، ويُحسب حيّاً عند كل تحميل (يعكس أي تعديل تسميع).
      const [studRes, circRes, branchRes, recAgg] = await Promise.all([
        supabase.from('students').select('circle_id')
          .eq('is_active', true).eq('admission_status', 'registered'),
        supabase.from('circles').select('id, branch_id, circle_type').eq('is_active', true),
        supabase.from('branches')
          .select('id, branch_name, juz_count, expected_daily_pages, program_start_date, program_end_date')
          .eq('is_active', true),
        (supabase.rpc as any)('dashboard_recitation_by_day'),
      ]);

      const circleToBranch = new Map((circRes.data || []).map(c => [c.id, c.branch_id]));
      const sponsorIds = new Set<string>(
        (circRes.data || []).filter(c => isSponsor(c.circle_type)).map(c => c.id as string),
      );
      setHasSponsor(sponsorIds.size > 0);

      // عدد الحلقات = الحلقات النشطة «تابعة للحرم» (circle_type='regular') بفرع محدد فقط
      // (juz_count > 0)، مع استبعاد «حلقاتنا» وفرع «غير محدد».
      const branchJuz = new Map((branchRes.data || []).map(b => [b.id, b.juz_count ?? 0]));
      const circleCount = (circRes.data || []).filter(c =>
        c.circle_type === 'regular' && ((branchJuz.get(c.branch_id) ?? 0) > 0),
      ).length;
      // عدد المعلمات = عدد الحلقات (معلمة واحدة لكل حلقة).
      setStats(prev => ({ ...prev, circles: circleCount, teachers: circleCount }));
      const branchStudentCount = new Map<string, number>();
      for (const st of studRes.data || []) {
        // استبعاد طالبات حلقات الحرم من نصاب حلقاتنا الثابت.
        if (st.circle_id && sponsorIds.has(st.circle_id)) continue;
        const bid = st.circle_id ? circleToBranch.get(st.circle_id) : null;
        if (bid) branchStudentCount.set(bid, (branchStudentCount.get(bid) || 0) + 1);
      }
      let reqPerDay = 0;
      // فرع «غير محدد» (juz_count = 0) لا يُحتسب في الإحصائيات (يُستبعد من المتطلب والتفصيل).
      const breakdown = (branchRes.data || []).filter(b => (b.juz_count ?? 0) > 0).map(b => {
        const count = branchStudentCount.get(b.id) || 0;
        // المستهدف اليومي = نصاب الفرع حسب عدد الأجزاء (فرع غير محدد juz=0 مُستبعَد أصلاً).
        const edp = dailyNisab(b.juz_count) ?? b.expected_daily_pages ?? 0;
        const subtotal = count * edp;
        reqPerDay += subtotal;
        return { name: b.branch_name as string, edp, count, subtotal };
      }).sort((a, b) => b.subtotal - a.subtotal);
      setDailyRequired(reqPerDay);
      setTargetBreakdown(breakdown);

      const recs = ((recAgg.data as any[]) || []).map(r => ({
        date: r.date as string,
        pages: Number(r.pages) || 0,
        sponsor: !!r.sponsor,
      }));
      setRecRows(recs);

      // --- Course timeline ---
      const branches = branchRes.data || [];
      const startCandidates = branches.map(b => b.program_start_date).filter(Boolean) as string[];
      const recDates = recs.map(r => r.date).filter(Boolean);
      // إذا لم يُثبَّت تاريخ بداية على أي فرع، نُبلّغ بوضوح بدل الافتراض الصامت أنه «اليوم».
      setProgramStartSet(startCandidates.length > 0);
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

      // أعلى الطالبات صفحاتٍ هذا الأسبوع — مجمّعة في قاعدة البيانات (تُرجّع أعلى ٥ فقط).
      const weekAgo = addDays(today, -7);
      const { data: topData } = await (supabase.rpc as any)('top_students_since', { since: weekAgo, lim: 5 });
      setTopStudents(((topData as any[]) || []).map(r => ({ name: r.full_name || '', pages: Number(r.pages) || 0 })));

      setLoading(false);
    };
    fetchAll();
  }, [today]);

  const dayDate = useMemo(() => addDays(startDate, day - 1), [startDate, day]);

  const daily = useMemo(() => {
    const rows = recRows.filter(r => r.date === dayDate);
    const { completed, required } = splitHarvest(rows, dailyRequired, haramFilter);
    return computeHarvest(completed, required);
  }, [recRows, dayDate, dailyRequired, haramFilter]);

  const cumulative = useMemo(() => {
    const rows = recRows.filter(r => r.date >= startDate && r.date <= dayDate);
    const { completed, required } = splitHarvest(rows, dailyRequired * day, haramFilter);
    return computeHarvest(completed, required);
  }, [recRows, startDate, dayDate, dailyRequired, day, haramFilter]);

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

      {/* تحذير: لا يوجد تاريخ بداية مثبّت — لا نُظهر يوماً مضلِّلاً بصمت */}
      {!loading && !programStartSet && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 flex items-start gap-3">
            <ClipboardList size={20} className="text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">بداية البرنامج غير محدَّدة</p>
              <p className="text-muted-foreground mt-1">
                لم يُثبَّت «تاريخ بداية البرنامج» على أي فرع، لذلك عدّاد «اليوم» والحصيلة اليومية غير مثبّتة وقد تكون مضلِّلة.
                حدِّدي تاريخ البداية من صفحة إدارة الفروع لكل فرع نشط.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* فلتر الحصيلة: الكل / تابعة للحرم / حلقاتنا (يظهر فقط عند وجود حلقات حرم) */}
      {hasSponsor && (
        <div className="flex flex-wrap items-center gap-1.5">
          {CIRCLE_TYPE_FILTERS.map(([val, label]) => (
            <Button
              key={val}
              type="button"
              size="sm"
              variant={haramFilter === val ? 'default' : 'outline'}
              className="h-7 px-3 text-xs"
              onClick={() => setHaramFilter(val as HaramFilter)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

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

      {/* Daily follow-up: who hasn't recited / has no attendance, and why */}
      <DailyFollowUp />

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
