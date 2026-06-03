import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  GitBranch, BookOpen, GraduationCap, Users, Mic, ClipboardCheck,
  TrendingUp, AlertTriangle, Calendar,
} from 'lucide-react';

const gradeColors: Record<string, string> = {
  'ممتاز': 'bg-success/10 text-success',
  'جيد جداً': 'bg-info/10 text-info',
  'جيد': 'bg-accent/10 text-accent',
  'مقبول': 'bg-warning/10 text-warning',
  'ضعيف': 'bg-destructive/10 text-destructive',
};

export default function DashboardPage() {
  const [stats, setStats] = useState({ branches: 0, circles: 0, teachers: 0, students: 0 });
  const [todayStats, setTodayStats] = useState({
    recitations: 0, totalPages: 0, presentCount: 0, absentCount: 0, lateCount: 0, examsToday: 0,
  });
  const [recentRecitations, setRecentRecitations] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchAll = async () => {
      const [b, c, t, s] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('circles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setStats({ branches: b.count || 0, circles: c.count || 0, teachers: t.count || 0, students: s.count || 0 });

      // Today's stats
      const [recRes, attRes, examRes] = await Promise.all([
        supabase.from('recitation_log').select('id, pages_recited, student_id').eq('date', today).eq('is_deleted', false),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('exams').select('id', { count: 'exact', head: true }).eq('date', today).eq('is_deleted', false),
      ]);

      const recData = recRes.data || [];
      const attData = attRes.data || [];
      setTodayStats({
        recitations: recData.length,
        totalPages: recData.reduce((sum, r) => sum + (r.pages_recited || 0), 0),
        presentCount: attData.filter(a => a.status === 'present').length,
        absentCount: attData.filter(a => a.status === 'absent').length,
        lateCount: attData.filter(a => a.status === 'late').length,
        examsToday: examRes.count || 0,
      });

      // Recent recitations (last 10)
      const { data: recentRec } = await supabase
        .from('recitation_log')
        .select('id, date, from_surah, to_surah, from_page, to_page, pages_recited, error_count, grade, students(full_name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentRecitations(recentRec || []);

      // Top students by pages (this week)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekRec } = await supabase
        .from('recitation_log')
        .select('student_id, pages_recited, students(full_name)')
        .eq('is_deleted', false)
        .gte('date', weekAgo.toISOString().split('T')[0]);

      // Aggregate by student
      const studentPages: Record<string, { name: string; pages: number }> = {};
      (weekRec || []).forEach(r => {
        const sid = r.student_id;
        if (!studentPages[sid]) studentPages[sid] = { name: (r.students as any)?.full_name || '', pages: 0 };
        studentPages[sid].pages += r.pages_recited || 0;
      });
      const sorted = Object.values(studentPages).sort((a, b) => b.pages - a.pages).slice(0, 5);
      setTopStudents(sorted);

      setLoading(false);
    };
    fetchAll();
  }, [today]);

  const summaryCards = [
    { label: 'الفروع', value: stats.branches, icon: <GitBranch size={22} />, color: 'text-primary' },
    { label: 'الحلقات', value: stats.circles, icon: <BookOpen size={22} />, color: 'text-accent' },
    { label: 'المعلمات', value: stats.teachers, icon: <GraduationCap size={22} />, color: 'text-info' },
    { label: 'الطالبات', value: stats.students, icon: <Users size={22} />, color: 'text-success' },
  ];

  const todayCards = [
    { label: 'تسميعات اليوم', value: todayStats.recitations, sub: `${todayStats.totalPages} صفحة`, icon: <Mic size={20} />, color: 'text-primary' },
    { label: 'الحضور', value: todayStats.presentCount, sub: `${todayStats.absentCount} غائبة · ${todayStats.lateCount} متأخرة`, icon: <ClipboardCheck size={20} />, color: 'text-success' },
    { label: 'اختبارات اليوم', value: todayStats.examsToday, sub: '', icon: <TrendingUp size={20} />, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground">بسم الله الرحمن الرحيم</h1>
        <p className="text-muted-foreground mt-1">مرحباً بك في نظام الوقار لإدارة حلقات تحفيظ القرآن الكريم</p>
      </div>

      {/* General Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((c, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${c.color}`}>{c.icon}</div>
              <div>
                <p className="text-2xl font-bold">{loading ? '...' : c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Activity */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={18} className="text-primary" />
          <h2 className="text-lg font-display text-foreground">نشاط اليوم</h2>
          <Badge variant="outline" className="text-xs" dir="ltr">{today}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {todayCards.map((c, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '...' : c.value}</p>
                    {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
                  </div>
                  <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${c.color}`}>{c.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
                        i === 0 ? 'bg-accent/20 text-accent' : i === 1 ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'
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
