import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { BookOpen, Check, X, AlertCircle, Download } from 'lucide-react';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';
import { allVerseOptions, parseVerseKey, globalIndexOfKey, pageOfVerse } from '@/lib/quran-verses';

const recitationCsvColumns: CsvColumnDef[] = [
  { key: 'full_name', header: 'الطالبة' },
  { key: 'from_page', header: 'من صفحة' },
  { key: 'to_page', header: 'إلى صفحة' },
  { key: 'from_surah', header: 'من سورة' },
  { key: 'to_surah', header: 'إلى سورة' },
  { key: 'pages_recited', header: 'عدد الصفحات' },
  { key: 'error_count', header: 'الأخطاء' },
  { key: 'score', header: 'الدرجة /20' },
  { key: 'grade', header: 'التقدير' },
  { key: 'date', header: 'التاريخ' },
];

type Period = 'morning' | 'evening';

// درجة التسميع اليومي من 20: ربع درجة خصمًا لكل خطأ.
const recitationScore = (errors: number) => Math.max(0, 20 - 0.25 * errors);

interface Circle {
  id: string;
  circle_name: string;
  branch_id: string;
  branches: { branch_name: string; id: string } | null;
}

interface Student {
  id: string;
  full_name: string;
  circle_id: string | null;
}

interface MushafPage {
  page_number: number;
  surah_name: string;
  surah_number: number;
  juz_number: number;
  sort_order: number;
  verse_start: number;
  verse_end: number;
}

interface TodayRecitation {
  student_id: string;
  period: string;
  to_page: number | null;
  to_surah: string | null;
  error_count: number;
  pages_recited: number | null;
  grade: string | null;
  score: number | null;
}

export default function RecitationPage() {
  const { toast } = useToast();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [mushafPages, setMushafPages] = useState<MushafPage[]>([]);
  const [branchJuz, setBranchJuz] = useState<number[]>([]);
  const [todayRecitations, setTodayRecitations] = useState<TodayRecitation[]>([]);
  const [todayAtt, setTodayAtt] = useState<{ student_id: string; status: string; period: string }[]>([]);

  const [selectedCircle, setSelectedCircle] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  // Period is chosen per recitation session (a circle runs both صباحي and مسائي).
  const [period, setPeriod] = useState<Period>('morning');
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [isExtra, setIsExtra] = useState(false);
  const [thabitConfirmed, setThabitConfirmed] = useState(false);
  const [hifzConfirmed, setHifzConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Load circles with branches
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('circles')
        .select('id, circle_name, branch_id, branches(branch_name, id)')
        .eq('is_active', true);
      setCircles(data || []);
    };
    load();
  }, []);

  // Load mushaf pages
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('mushaf_reference')
        .select('page_number, surah_name, surah_number, juz_number, sort_order, verse_start, verse_end')
        .order('sort_order');
      setMushafPages(data || []);
    };
    load();
  }, []);

  // When circle is selected, load students + branch juz
  useEffect(() => {
    if (!selectedCircle) { setStudents([]); return; }

    const load = async () => {
      // Get students
      const { data: studData } = await supabase
        .from('students')
        .select('id, full_name, circle_id')
        .eq('circle_id', selectedCircle)
        .eq('is_active', true)
        .eq('admission_status', 'registered');
      setStudents(studData || []);

      // Get branch juz for this circle
      const circle = circles.find(c => c.id === selectedCircle);
      if (circle?.branch_id) {
        const { data: juzData } = await supabase
          .from('branch_juz')
          .select('juz_number')
          .eq('branch_id', circle.branch_id);
        setBranchJuz((juzData || []).map(j => j.juz_number));
      }

      // Today's recitations for this circle (both periods; filtered client-side)
      const { data: recData } = await supabase
        .from('recitation_log')
        .select('student_id, period, to_page, to_surah, error_count, pages_recited, grade, score')
        .eq('circle_id', selectedCircle)
        .eq('date', today)
        .eq('is_deleted', false);
      setTodayRecitations(recData || []);

      // Today's attendance (both periods; filtered client-side)
      const { data: attData } = await supabase
        .from('attendance')
        .select('student_id, status, period')
        .eq('date', today)
        .in('student_id', (studData || []).map(s => s.id));
      setTodayAtt(attData || []);
    };
    load();
  }, [selectedCircle, circles, today]);

  const circleOptions = useMemo(
    () => circles.map(c => ({
      value: c.id,
      label: `${c.circle_name} — ${c.branches?.branch_name ?? ''}`,
    })),
    [circles]
  );

  // Check if student recited in the selected period today
  const hasRecitedToday = (studentId: string) =>
    todayRecitations.some(r => r.student_id === studentId && r.period === period);

  // Get student's recitations in the selected period today
  const getStudentTodayInfo = (studentId: string) =>
    todayRecitations.filter(r => r.student_id === studentId && r.period === period);

  // Check if student is absent in the selected period
  const isAbsent = (studentId: string) =>
    todayAtt.some(a => a.student_id === studentId && a.period === period && a.status === 'absent');

  // Pages are DERIVED from the «سورة|آية» range (one source of truth, so
  // ordering validation actually works).
  const pageRefs = useMemo(() => mushafPages.map(p => ({
    page_number: p.page_number, surah_number: p.surah_number,
    verse_start: p.verse_start, sort_order: p.sort_order,
  })), [mushafPages]);
  const fromRef = parseVerseKey(fromVerse);
  const toRef = parseVerseKey(toVerse);
  const fromG = fromVerse ? globalIndexOfKey(fromVerse) : null;
  const toG = toVerse ? globalIndexOfKey(toVerse) : null;
  const fromPageInfo = fromRef ? pageOfVerse(pageRefs, fromRef.surah, fromRef.verse) : null;
  const toPageInfo = toRef ? pageOfVerse(pageRefs, toRef.surah, toRef.verse) : null;
  const isOrderValid = fromG == null || toG == null || fromG <= toG;
  const pagesCount = fromPageInfo && toPageInfo ? toPageInfo.page_number - fromPageInfo.page_number + 1 : null;

  // Grade calculation — must mirror the recitation_log.grade generated column.
  // أخطاء 0-2 ممتاز · 3-4 جيد جدًا · 5-6 جيد · 7+ ضعيف
  const getGrade = (errors: number) => {
    if (errors <= 2) return { text: 'ممتاز', color: 'text-success' };
    if (errors <= 4) return { text: 'جيد جدًا', color: 'text-info' };
    if (errors <= 6) return { text: 'جيد', color: 'text-accent' };
    return { text: 'ضعيف', color: 'text-destructive' };
  };

  const handleSave = async () => {
    if (!selectedStudent || !fromRef || !toRef) {
      toast({ title: 'خطأ', description: 'اختر نطاق التسميع (من/إلى سورة وآية)', variant: 'destructive' });
      return;
    }
    if (!isOrderValid) {
      toast({ title: 'خطأ', description: 'بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف', variant: 'destructive' });
      return;
    }
    if (isAbsent(selectedStudent)) {
      toast({ title: 'خطأ', description: 'لا يمكن تسجيل تسميع لطالبة غائبة', variant: 'destructive' });
      return;
    }

    setSaving(true);

    // Get teacher_id - for now use first teacher (should be from auth context)
    const { data: teachers } = await supabase.from('teachers').select('id').limit(1);
    const teacherId = teachers?.[0]?.id;
    if (!teacherId) {
      toast({ title: 'خطأ', description: 'لا يوجد معلمة مسجلة', variant: 'destructive' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('recitation_log').insert({
      student_id: selectedStudent,
      teacher_id: teacherId,
      circle_id: selectedCircle,
      date: today,
      period,
      // الصفحات مشتقة تلقائياً من نطاق السورة|الآية
      from_page: fromPageInfo?.page_number ?? null,
      to_page: toPageInfo?.page_number ?? null,
      from_surah: fromRef.surah,
      to_surah: toRef.surah,
      from_verse: fromRef.verse,
      to_verse: toRef.verse,
      from_sort_order: fromPageInfo?.sort_order ?? null,
      to_sort_order: toPageInfo?.sort_order ?? null,
      is_extra_memorization: isExtra,
      thabit_confirmed: thabitConfirmed,
      hifz_confirmed: hifzConfirmed,
      error_count: errorCount,
      // grade + score (/20) are computed by the database (generated columns).
    });

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم حفظ التسميع بنجاح' });
      // Refresh today's recitations
      const { data: recData } = await supabase
        .from('recitation_log')
        .select('student_id, period, to_page, to_surah, error_count, pages_recited, grade, score')
        .eq('circle_id', selectedCircle)
        .eq('date', today)
        .eq('is_deleted', false);
      setTodayRecitations(recData || []);
      // Reset form
      setFromVerse('');
      setToVerse('');
      setErrorCount(0);
      setIsExtra(false);
      setThabitConfirmed(false);
      setHifzConfirmed(false);
      setSelectedStudent('');
    }
    setSaving(false);
  };

  const selectedStudentObj = students.find(s => s.id === selectedStudent);
  const grade = getGrade(errorCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">تسجيل التسميع</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل التسميع اليومي للطالبات</p>
        </div>
        {selectedCircle && todayRecitations.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            const exportData = todayRecitations.map(r => {
              const student = students.find(s => s.id === r.student_id);
              return { ...r, full_name: student?.full_name || '', date: today };
            });
            exportToCsv(exportData, recitationCsvColumns, `recitation_${today}`);
          }}>
            <Download size={14} /> تصدير CSV
          </Button>
        )}
      </div>

      {/* Step 1: Select Circle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">اختيار الحلقة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <SearchableSelect
            className="max-w-sm flex-1 min-w-[220px]"
            options={circleOptions}
            value={selectedCircle}
            onValueChange={v => { setSelectedCircle(v); setSelectedStudent(''); }}
            placeholder="اختر الحلقة"
            searchPlaceholder="ابحث عن حلقة..."
          />
          {/* Period is chosen here, not on the circle (each circle runs both) */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm shrink-0">
            {(['morning', 'evening'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setPeriod(p); setSelectedStudent(''); }}
                className={`px-4 py-2 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {p === 'morning' ? 'الفترة الصباحية' : 'الفترة المسائية'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Students list */}
      {selectedCircle && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">طالبات الحلقة</CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد طالبات مسجلات في هذه الحلقة</p>
            ) : (
              <div className="space-y-2">
                {students.map(s => {
                  const recited = hasRecitedToday(s.id);
                  const absent = isAbsent(s.id);
                  const todayInfo = getStudentTodayInfo(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => !absent && setSelectedStudent(s.id)}
                      disabled={absent}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-right ${
                        selectedStudent === s.id
                          ? 'border-primary bg-primary/5'
                          : absent
                          ? 'border-destructive/20 bg-destructive/5 opacity-60 cursor-not-allowed'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                          recited ? 'bg-success/10 text-success' : absent ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                        }`}>
                          {recited ? <Check size={16} /> : absent ? <X size={16} /> : <BookOpen size={14} />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.full_name}</p>
                          {todayInfo.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              سمّعت اليوم: {todayInfo.reduce((sum, r) => sum + (r.pages_recited || 0), 0)} صفحات | 
                              آخر موضع: {todayInfo[todayInfo.length - 1]?.to_surah} ص{todayInfo[todayInfo.length - 1]?.to_page}
                            </p>
                          )}
                          {absent && <p className="text-xs text-destructive">غائبة اليوم</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {recited && <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">سمّعت ✓</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Recitation form */}
      {selectedStudent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">تسجيل تسميع — {selectedStudentObj?.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {branchJuz.length > 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <strong>نصاب الفرع:</strong> الأجزاء {branchJuz.sort((a, b) => a - b).join('، ')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>من: سورة | رقم الآية *</Label>
                <SearchableSelect
                  options={allVerseOptions()}
                  value={fromVerse}
                  onValueChange={setFromVerse}
                  placeholder="السورة|الآية"
                  searchPlaceholder="مثال: البقرة 5"
                  maxVisible={100}
                  allowClear
                />
              </div>
              <div className="space-y-2">
                <Label>إلى: سورة | رقم الآية *</Label>
                <SearchableSelect
                  options={allVerseOptions()}
                  value={toVerse}
                  onValueChange={setToVerse}
                  placeholder="السورة|الآية"
                  searchPlaceholder="مثال: البقرة 10"
                  maxVisible={100}
                  allowClear
                />
              </div>
            </div>

            {!isOrderValid && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                <AlertCircle size={16} />
                بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف
              </div>
            )}

            {isOrderValid && fromPageInfo && toPageInfo && (
              <div className="text-sm bg-primary/5 p-3 rounded-lg border border-primary/10">
                <strong>الحصيلة:</strong> {pagesCount} صفحات (ص{fromPageInfo.page_number} → ص{toPageInfo.page_number})
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isExtra"
                  checked={isExtra}
                  onCheckedChange={(v) => setIsExtra(!!v)}
                />
                <Label htmlFor="isExtra" className="text-sm">حفظ زيادة خارج النصاب</Label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="thabit"
                  checked={thabitConfirmed}
                  onCheckedChange={(v) => setThabitConfirmed(!!v)}
                />
                <Label htmlFor="thabit" className="text-sm">نصاب التثبيت (سرد ذاتي)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hifz"
                  checked={hifzConfirmed}
                  onCheckedChange={(v) => setHifzConfirmed(!!v)}
                />
                <Label htmlFor="hifz" className="text-sm">نصاب الحفظ (سرد على شخص)</Label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>عدد الأخطاء</Label>
                <Input
                  type="number"
                  min={0}
                  value={errorCount}
                  onChange={e => setErrorCount(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>الدرجة /20</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 font-bold">
                  {recitationScore(errorCount)}
                  <span className="text-xs text-muted-foreground mr-1">/ 20</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>التقدير</Label>
                <div className={`h-10 flex items-center px-3 rounded-md border bg-muted/30 font-medium ${grade.color}`}>
                  {grade.text}
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || !isOrderValid} className="w-full">
              {saving ? 'جارٍ الحفظ...' : 'حفظ التسميع'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
