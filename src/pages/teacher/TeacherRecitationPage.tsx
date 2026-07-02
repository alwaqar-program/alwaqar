import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Check, X, AlertCircle } from 'lucide-react';
import TeacherGate, { TeacherSession } from '@/components/teacher/TeacherGate';

interface MushafPage {
  page_number: number; surah_name: string; juz_number: number; sort_order: number;
  verse_start: number; verse_end: number;
}
interface TodayRec { student_id: string; period: string; to_page: number | null; to_surah: string | null; to_verse: number | null; pages_recited: number | null; }

// Mirrors the recitation_log generated columns (score /20, grade scale).
const recScore = (errors: number) => Math.max(0, 20 - 0.25 * errors);
const recGrade = (errors: number) => {
  if (errors <= 2) return { text: 'ممتاز', color: 'text-success' };
  if (errors <= 4) return { text: 'جيد جدًا', color: 'text-info' };
  if (errors <= 6) return { text: 'جيد', color: 'text-accent' };
  return { text: 'ضعيف', color: 'text-destructive' };
};

function RecitationForm({ session }: { session: TeacherSession }) {
  const { toast } = useToast();
  const { circle, period, students, loadingStudents, teacher } = session;
  const today = new Date().toISOString().split('T')[0];

  const [mushafPages, setMushafPages] = useState<MushafPage[]>([]);
  const [branchJuz, setBranchJuz] = useState<number[]>([]);
  const [todayRecs, setTodayRecs] = useState<TodayRec[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [fromPage, setFromPage] = useState('');
  const [toPage, setToPage] = useState('');
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [isExtra, setIsExtra] = useState(false);
  const [thabit, setThabit] = useState(false);
  const [hifz, setHifz] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('mushaf_reference').select('page_number, surah_name, juz_number, sort_order, verse_start, verse_end').order('sort_order')
      .then(({ data }) => setMushafPages(data || []));
  }, []);

  useEffect(() => {
    if (!circle.branch_id) { setBranchJuz([]); return; }
    supabase.from('branch_juz').select('juz_number').eq('branch_id', circle.branch_id)
      .then(({ data }) => setBranchJuz((data || []).map(j => j.juz_number)));
  }, [circle.branch_id]);

  const refreshDay = async () => {
    if (students.length === 0) { setTodayRecs([]); setAbsentIds(new Set()); return; }
    const ids = students.map(s => s.id);
    const [{ data: rec }, { data: att }] = await Promise.all([
      supabase.from('recitation_log').select('student_id, period, to_page, to_surah, to_verse, pages_recited')
        .eq('circle_id', circle.id).eq('date', today).eq('is_deleted', false),
      supabase.from('attendance').select('student_id, status, period').eq('date', today).in('student_id', ids),
    ]);
    setTodayRecs(rec || []);
    setAbsentIds(new Set((att || []).filter(a => a.period === period && a.status === 'absent').map(a => a.student_id)));
  };
  useEffect(() => { refreshDay(); /* eslint-disable-line */ }, [students, period, today, circle.id]);

  const filteredPages = useMemo(() => {
    if (showAll || branchJuz.length === 0) return mushafPages;
    return mushafPages.filter(p => branchJuz.includes(p.juz_number));
  }, [mushafPages, branchJuz, showAll]);
  const pageOptions = useMemo(() => filteredPages.map(p => ({
    value: String(p.page_number), label: `ص${p.page_number} — ${p.surah_name} (ج${p.juz_number})`,
  })), [filteredPages]);

  const recitedThisPeriod = (id: string) => todayRecs.some(r => r.student_id === id && r.period === period);
  const isAbsent = (id: string) => absentIds.has(id);
  const studentToday = (id: string) => todayRecs.filter(r => r.student_id === id && r.period === period);

  const fromPageInfo = mushafPages.find(p => p.page_number === parseInt(fromPage));
  const toPageInfo = mushafPages.find(p => p.page_number === parseInt(toPage));
  const fromSort = fromPageInfo?.sort_order || 0;
  const toSort = toPageInfo?.sort_order || 0;
  const orderOk = !fromPage || !toPage || fromSort <= toSort;
  const grade = recGrade(errorCount);

  const save = async () => {
    if (!selected || !fromPage || !toPage) { toast({ title: 'خطأ', description: 'أكملي الحقول المطلوبة', variant: 'destructive' }); return; }
    if (!orderOk) { toast({ title: 'خطأ', description: 'صفحة البداية قبل النهاية', variant: 'destructive' }); return; }
    if (isAbsent(selected)) { toast({ title: 'خطأ', description: 'لا يمكن تسجيل تسميع لطالبة غائبة', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('recitation_log').insert({
      student_id: selected, teacher_id: teacher.id, circle_id: circle.id, date: today, period,
      from_page: parseInt(fromPage), to_page: parseInt(toPage),
      from_surah: fromPageInfo?.surah_name, to_surah: toPageInfo?.surah_name,
      from_verse: fromVerse ? parseInt(fromVerse) : null,
      to_verse: toVerse ? parseInt(toVerse) : null,
      from_sort_order: fromPageInfo?.sort_order, to_sort_order: toPageInfo?.sort_order,
      is_extra_memorization: isExtra, thabit_confirmed: thabit, hifz_confirmed: hifz,
      error_count: errorCount, // grade + score are computed by the database
    });
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'تم حفظ التسميع' });
      setFromPage(''); setToPage(''); setFromVerse(''); setToVerse('');
      setErrorCount(0); setIsExtra(false); setThabit(false); setHifz(false); setSelected('');
      refreshDay();
    }
    setSaving(false);
  };

  if (loadingStudents) return <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">جارٍ تحميل الطالبات…</CardContent></Card>;
  if (students.length === 0) return (
    <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-center">
      <BookOpen size={36} className="text-muted-foreground/30 mb-2" />
      <p className="text-muted-foreground text-sm">لا توجد طالبات مسجلات في «{circle.circle_name}»</p>
    </CardContent></Card>
  );

  const selectedStudent = students.find(s => s.id === selected);

  return (
    <>
      {branchJuz.length > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <strong>نصاب الفرع:</strong> الأجزاء {[...branchJuz].sort((a, b) => a - b).join('، ')}
        </div>
      )}

      <Card>
        <CardContent className="pt-4 space-y-2">
          {students.map(s => {
            const recited = recitedThisPeriod(s.id);
            const absent = isAbsent(s.id);
            const info = studentToday(s.id);
            return (
              <button key={s.id} onClick={() => !absent && setSelected(s.id)} disabled={absent}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-right ${
                  selected === s.id ? 'border-primary bg-primary/5'
                  : absent ? 'border-destructive/20 bg-destructive/5 opacity-60 cursor-not-allowed'
                  : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${recited ? 'bg-success/10 text-success' : absent ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                    {recited ? <Check size={16} /> : absent ? <X size={16} /> : <BookOpen size={14} />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.full_name}</p>
                    {info.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        سمّعت: {info.reduce((sum, r) => sum + (r.pages_recited || 0), 0)} صفحات · آخر موضع {info[info.length - 1]?.to_surah} ص{info[info.length - 1]?.to_page}{info[info.length - 1]?.to_verse ? ` آية ${info[info.length - 1]?.to_verse}` : ''}
                      </p>
                    )}
                    {absent && <p className="text-xs text-destructive">غائبة هذه الفترة</p>}
                  </div>
                </div>
                {recited && <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">سمّعت ✓</Badge>}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {selectedStudent && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="font-medium text-sm">تسجيل تسميع — {selectedStudent.full_name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">من صفحة</Label>
                <SearchableSelect options={pageOptions} value={fromPage} onValueChange={setFromPage} placeholder="اختر" searchPlaceholder="ابحث…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">إلى صفحة</Label>
                <SearchableSelect options={pageOptions} value={toPage} onValueChange={setToPage} placeholder="اختر" searchPlaceholder="ابحث…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">من الآية{fromPageInfo ? ` (${fromPageInfo.verse_start}–${fromPageInfo.verse_end})` : ''}</Label>
                <Input type="number" min={1} inputMode="numeric" placeholder="رقم الآية"
                  value={fromVerse} onChange={e => setFromVerse(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">إلى الآية{toPageInfo ? ` (${toPageInfo.verse_start}–${toPageInfo.verse_end})` : ''}</Label>
                <Input type="number" min={1} inputMode="numeric" placeholder="رقم الآية"
                  value={toVerse} onChange={e => setToVerse(e.target.value)} />
              </div>
            </div>
            {!orderOk && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                <AlertCircle size={16} /> صفحة البداية يجب أن تكون قبل النهاية
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={showAll} onCheckedChange={v => setShowAll(!!v)} /> عرض كل المصحف</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={isExtra} onCheckedChange={v => setIsExtra(!!v)} /> حفظ زيادة</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={thabit} onCheckedChange={v => setThabit(!!v)} /> نصاب التثبيت</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={hifz} onCheckedChange={v => setHifz(!!v)} /> نصاب الحفظ</label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">عدد الأخطاء</Label>
                <Input type="number" min={0} value={errorCount} onChange={e => setErrorCount(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الدرجة /20</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 font-bold">{recScore(errorCount)}<span className="text-xs text-muted-foreground mr-1">/ 20</span></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">التقدير</Label>
                <div className={`h-10 flex items-center px-3 rounded-md border bg-muted/30 font-medium ${grade.color}`}>{grade.text}</div>
              </div>
            </div>
            <Button onClick={save} disabled={saving || !orderOk} className="w-full">{saving ? 'جارٍ الحفظ…' : 'حفظ التسميع'}</Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function TeacherRecitationPage() {
  return (
    <TeacherGate title="تسجيل التسميع" subtitle="أدخلي رقم هويتك لعرض طالبات حلقتك" needsPeriod>
      {session => <RecitationForm session={session} />}
    </TeacherGate>
  );
}
