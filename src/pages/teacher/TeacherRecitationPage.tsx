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
import { allVerseOptions, verseOptionsInRange, parseVerseKey, globalIndexOfKey, pageOfVerse } from '@/lib/quran-verses';

interface MushafPage {
  page_number: number; surah_name: string; surah_number: number;
  juz_number: number; sort_order: number; verse_start: number; verse_end: number;
}
interface TodayRec { student_id: string; period: string; to_page: number | null; to_surah: string | null; to_verse: number | null; pages_recited: number | null; }

// الدرجة /20 والتقدير يُحسبان في قاعدة البيانات ويُعرضان للمشرفات فقط —
// لا يظهران للمعلمة هنا.

export function RecitationForm({ session }: { session: TeacherSession }) {
  const { toast } = useToast();
  // date يأتي من حقل التاريخ في الترويسة (TeacherGate)
  const { circle, period, date, students, loadingStudents, teacher } = session;

  const [mushafPages, setMushafPages] = useState<MushafPage[]>([]);
  const [branchJuz, setBranchJuz] = useState<number[]>([]);
  const [todayRecs, setTodayRecs] = useState<TodayRec[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState('');
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [lahnCount, setLahnCount] = useState(0);
  const [isExtra, setIsExtra] = useState(false);
  const [thabit, setThabit] = useState(false);
  const [hifz, setHifz] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('mushaf_reference').select('page_number, surah_name, surah_number, juz_number, sort_order, verse_start, verse_end').order('sort_order')
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
        .eq('circle_id', circle.id).eq('date', date).eq('is_deleted', false),
      supabase.from('attendance').select('student_id, status, period').eq('date', date).in('student_id', ids),
    ]);
    setTodayRecs(rec || []);
    setAbsentIds(new Set((att || []).filter(a => a.period === period && a.status === 'absent').map(a => a.student_id)));
  };
  useEffect(() => { refreshDay(); /* eslint-disable-line */ }, [students, period, date, circle.id]);

  const recitedThisPeriod = (id: string) => todayRecs.some(r => r.student_id === id && r.period === period);
  const isAbsent = (id: string) => absentIds.has(id);
  const studentToday = (id: string) => todayRecs.filter(r => r.student_id === id && r.period === period);

  // Pages are DERIVED from the «سورة|آية» range (one source of truth, so
  // ordering validation actually works — user request).
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
  const orderOk = fromG == null || toG == null || fromG <= toG;

  const selectedStudent = students.find(s => s.id === selected);

  // نطاق التسميع المسموح = نطاق حفظ الطالبة (من سورة → إلى سورة) إن وُجد.
  const verseOpts = useMemo(() => {
    if (selectedStudent?.from_surah && selectedStudent?.to_surah) {
      return verseOptionsInRange(selectedStudent.from_surah, selectedStudent.to_surah);
    }
    return allVerseOptions();
  }, [selectedStudent?.from_surah, selectedStudent?.to_surah]);
  const isRestricted = selectedStudent?.from_surah && selectedStudent?.to_surah
    && verseOpts.length < allVerseOptions().length;

  // Clear the picked range when switching students (it may be outside the new range).
  useEffect(() => { setFromVerse(''); setToVerse(''); }, [selected]);

  const save = async () => {
    if (!selected || !fromRef || !toRef) { toast({ title: 'تنبيه', description: 'اختاري نطاق التسميع (من/إلى سورة وآية)', variant: 'destructive' }); return; }
    if (!orderOk) { toast({ title: 'تنبيه', description: 'بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف', variant: 'destructive' }); return; }
    // نصاب التثبيت ونصاب الحفظ إجباريان — لا حفظ بدونهما
    if (!thabit || !hifz) { toast({ title: 'تنبيه', description: 'يجب تأكيد نصاب التثبيت (سرد ذاتي) ونصاب الحفظ (سرد على شخص) قبل الحفظ', variant: 'destructive' }); return; }
    if (isAbsent(selected)) { toast({ title: 'تنبيه', description: 'لا يمكن تسجيل تسميع لطالبة غائبة', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('recitation_log').insert({
      student_id: selected, teacher_id: teacher.id || null, circle_id: circle.id, date, period,
      // الصفحات مشتقة تلقائياً من نطاق السورة|الآية
      from_page: fromPageInfo?.page_number ?? null,
      to_page: toPageInfo?.page_number ?? null,
      from_surah: fromRef.surah, to_surah: toRef.surah,
      from_verse: fromRef.verse, to_verse: toRef.verse,
      from_sort_order: fromPageInfo?.sort_order ?? null, to_sort_order: toPageInfo?.sort_order ?? null,
      is_extra_memorization: isExtra, thabit_confirmed: thabit, hifz_confirmed: hifz,
      error_count: errorCount, lahn_count: lahnCount, // grade + score are computed by the database
      recorded_by: teacher.teacher_name, // سجل: من أدخلت التسميع
    });
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'تم حفظ التسميع' });
      setFromVerse(''); setToVerse('');
      setErrorCount(0); setLahnCount(0); setIsExtra(false); setThabit(false); setHifz(false); setSelected('');
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

  return (
    <>
      {branchJuz.length > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <strong>نصاب الفرع:</strong> الأجزاء {[...branchJuz].sort((a, b) => a - b).join('، ')}
        </div>
      )}

      {selected && selectedStudent ? (
        <Card>
          <CardContent className="py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookOpen size={14} />
              </div>
              <p className="font-medium text-sm truncate">{selectedStudent.full_name}</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground shrink-0" onClick={() => setSelected('')}>
              تغيير الطالبة
            </Button>
          </CardContent>
        </Card>
      ) : (
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
      )}

      {selectedStudent && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="font-medium text-sm">تسجيل تسميع — {selectedStudent.full_name}</p>
            {isRestricted && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                نطاق حفظ الطالبة: <strong>{selectedStudent.from_surah}</strong> ← <strong>{selectedStudent.to_surah}</strong> — الخيارات محصورة فيه.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">من: سورة | رقم الآية *</Label>
                <SearchableSelect options={verseOpts} value={fromVerse} onValueChange={setFromVerse}
                  placeholder="السورة|الآية" searchPlaceholder="مثال: البقرة 5" maxVisible={100} allowClear />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">إلى: سورة | رقم الآية *</Label>
                <SearchableSelect options={verseOpts} value={toVerse} onValueChange={setToVerse}
                  placeholder="السورة|الآية" searchPlaceholder="مثال: البقرة 10" maxVisible={100} allowClear />
              </div>
            </div>
            {!orderOk && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                <AlertCircle size={16} /> بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف
              </div>
            )}
            {/* الحصيلة والدرجة والتقدير تُحسب وتُحفظ في النظام وتظهر للمشرفات فقط */}
            <div className="flex flex-wrap items-center gap-4">
              {/* نفس مسميات الصفحة الإدارية */}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={isExtra} onCheckedChange={v => setIsExtra(!!v)} /> حفظ زيادة خارج النصاب</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={thabit} onCheckedChange={v => setThabit(!!v)} /> نصاب التثبيت (سرد ذاتي) *</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={hifz} onCheckedChange={v => setHifz(!!v)} /> نصاب الحفظ (سرد على شخص) *</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">عدد الأخطاء</Label>
                <Input type="number" min={0} value={errorCount} onChange={e => setErrorCount(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">عدد اللحون</Label>
                <Input type="number" min={0} value={lahnCount} onChange={e => setLahnCount(parseInt(e.target.value) || 0)} />
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
    <TeacherGate title="تسجيل التسميع" subtitle="أدخلي رقم هويتك لعرض طالبات حلقتك" needsPeriod dateLabel="تاريخ التسميع">
      {session => <RecitationForm session={session} />}
    </TeacherGate>
  );
}
