import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Check, X, AlertCircle } from 'lucide-react';
import TeacherGate, { TeacherSession } from '@/components/teacher/TeacherGate';
import { allVerseOptions, verseOptionsInRange, parseVerseKey, globalIndexOfKey, pageOfVerse } from '@/lib/quran-verses';
import { Cohort, COHORTS, cohortLabel, COHORT_PLURAL, cohortSubjectColumn, subjectPayload } from '@/lib/cohorts';
import { isSponsor } from '@/lib/circle-type';
import { examTypeForDate, EXAM_TYPE_LABEL } from '@/lib/exam-schedule';

interface MushafPage {
  page_number: number; surah_name: string; surah_number: number;
  juz_number: number; sort_order: number; verse_start: number; verse_end: number;
}
interface TodayRec {
  student_id: string | null; companion_id: string | null; beginner_id: string | null;
  period: string; to_page: number | null; to_surah: string | null; to_verse: number | null; pages_recited: number | null;
}

// شخص في الحلقة: طالبة (بنطاق حفظ) أو مرافقة/مبتدئة (بدون نطاق).
interface Person { id: string; full_name: string; kind: Cohort; from_surah: string | null; to_surah: string | null; }

// الدرجة /20 والتقدير يُحسبان في قاعدة البيانات ويُعرضان للمشرفات فقط —
// لا يظهران للمعلمة هنا.

export function RecitationForm({ session, enableExam = false }: { session: TeacherSession; enableExam?: boolean }) {
  const { toast } = useToast();
  // date يأتي من حقل التاريخ في الترويسة (TeacherGate)
  const { circle, period, date, students, loadingStudents, teacher } = session;
  // حلقات الحرم لا تتبع النِّصاب: تُخفى حقول (زيادة/تثبيت/حفظ) ولا تُشترط.
  const sponsor = isSponsor(circle.circle_type);
  // نوع الاختبار المجدول لهذا اليوم (فقط إذا كان الاختبار مُفعّلاً — الرابط العام).
  const examType = enableExam ? examTypeForDate(date) : null;

  const [mushafPages, setMushafPages] = useState<MushafPage[]>([]);
  const [branchJuz, setBranchJuz] = useState<number[]>([]);
  const [todayRecs, setTodayRecs] = useState<TodayRec[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  const [cohort, setCohort] = useState<Cohort>('student');
  const [extra, setExtra] = useState<{ companion: Person[]; beginner: Person[] }>({ companion: [], beginner: [] });
  const [loadingExtra, setLoadingExtra] = useState(false);

  const [selected, setSelected] = useState('');
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [lahnCount, setLahnCount] = useState(0);
  const [isExtra, setIsExtra] = useState(false);
  const [thabit, setThabit] = useState(false);
  const [hifz, setHifz] = useState(false);
  const [saving, setSaving] = useState(false);

  // وضع الإدخال بعد اختيار الطالبة: تسميع (افتراضي) أو اختبار (طالبات فقط، في يوم اختبار مُفعّل).
  const [entryMode, setEntryMode] = useState<'recitation' | 'exam'>('recitation');
  const [segmentChange, setSegmentChange] = useState(false); // تغيير المقطع (اختبار)
  const [examDone, setExamDone] = useState<Set<string>>(new Set()); // مفاتيح student_id-exam_type المسجَّلة

  // تحميل الاختبارات المسجَّلة مسبقاً لطالبات الحلقة (حارس التكرار) — للاختبار فقط.
  useEffect(() => {
    if (!enableExam || students.length === 0) { setExamDone(new Set()); return; }
    supabase.from('exams').select('student_id, exam_type').eq('is_deleted', false)
      .in('student_id', students.map(s => s.id))
      .then(({ data }) => setExamDone(new Set((data || []).map(e => `${e.student_id}-${e.exam_type}`))));
  }, [enableExam, students]);

  // الاختبار للطالبات فقط: أي فئة أخرى تُجبَر على وضع التسميع.
  useEffect(() => { if (cohort !== 'student') setEntryMode('recitation'); }, [cohort]);
  // تصفير عدّادات الأخطاء/اللحون/تغيير المقطع عند تبديل الوضع أو الطالبة.
  useEffect(() => { setErrorCount(0); setLahnCount(0); setSegmentChange(false); }, [entryMode, selected]);

  const canExam = enableExam && cohort === 'student';
  const isExamDup = entryMode === 'exam' && !!selected && !!examType && examDone.has(`${selected}-${examType}`);

  useEffect(() => {
    supabase.from('mushaf_reference').select('page_number, surah_name, surah_number, juz_number, sort_order, verse_start, verse_end').order('sort_order')
      .then(({ data }) => setMushafPages(data || []));
  }, []);

  useEffect(() => {
    if (!circle.branch_id) { setBranchJuz([]); return; }
    supabase.from('branch_juz').select('juz_number').eq('branch_id', circle.branch_id)
      .then(({ data }) => setBranchJuz((data || []).map(j => j.juz_number)));
  }, [circle.branch_id]);

  // كل الأشخاص في الحلقة: طالبات (بنطاق حفظ) + مرافقات + مبتدئات.
  const people: Person[] = useMemo(() => [
    ...students.map(s => ({ id: s.id, full_name: s.full_name, kind: 'student' as Cohort, from_surah: s.from_surah, to_surah: s.to_surah })),
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
        (rows || []).filter(r => r.is_active !== false).map(r => ({ id: r.id, full_name: r.full_name, kind, from_surah: null, to_surah: null }));
      setExtra({ companion: map(coRes.data, 'companion'), beginner: map(beRes.data, 'beginner') });
      setLoadingExtra(false);
    };
    load();
    return () => { cancelled = true; };
  }, [circle.id]);

  // Match the absent-guard by the selected cohort's subject column.
  const col = cohortSubjectColumn(cohort);

  const refreshDay = async () => {
    if (shownPeople.length === 0) { setTodayRecs([]); setAbsentIds(new Set()); return; }
    const ids = shownPeople.map(p => p.id);
    const [{ data: rec }, { data: att }] = await Promise.all([
      supabase.from('recitation_log').select('student_id, companion_id, beginner_id, period, to_page, to_surah, to_verse, pages_recited')
        .eq('circle_id', circle.id).eq('date', date).eq('is_deleted', false),
      supabase.from('attendance').select('student_id, companion_id, beginner_id, status, period').eq('date', date).in(col, ids),
    ]);
    setTodayRecs(rec || []);
    setAbsentIds(new Set((att || [])
      .filter(a => a.period === period && a.status === 'absent')
      .map(a => (a as any)[col] as string | null)
      .filter((id): id is string => !!id)));
  };
  useEffect(() => { refreshDay(); /* eslint-disable-line */ }, [shownPeople, period, date, circle.id, cohort]);

  const recPersonId = (r: TodayRec) => (r as any)[col] as string | null;
  const recitedThisPeriod = (id: string) => todayRecs.some(r => recPersonId(r) === id && r.period === period);
  const isAbsent = (id: string) => absentIds.has(id);
  const studentToday = (id: string) => todayRecs.filter(r => recPersonId(r) === id && r.period === period);

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

  const selectedStudent = shownPeople.find(p => p.id === selected);

  // نطاق التسميع المسموح = نطاق حفظ الطالبة (من سورة → إلى سورة) إن وُجد.
  // المرافقات/المبتدئات بلا نطاق محفوظ → كل السور متاحة.
  const verseOpts = useMemo(() => {
    if (selectedStudent?.from_surah && selectedStudent?.to_surah) {
      return verseOptionsInRange(selectedStudent.from_surah, selectedStudent.to_surah);
    }
    return allVerseOptions();
  }, [selectedStudent?.from_surah, selectedStudent?.to_surah]);
  const isRestricted = selectedStudent?.from_surah && selectedStudent?.to_surah
    && verseOpts.length < allVerseOptions().length;

  // Clear the picked range + selection when switching person or cohort.
  useEffect(() => { setFromVerse(''); setToVerse(''); }, [selected]);
  useEffect(() => { setSelected(''); setFromVerse(''); setToVerse(''); }, [cohort]);

  const save = async () => {
    if (!selected || !fromRef || !toRef) { toast({ title: 'تنبيه', description: 'اختاري نطاق التسميع (من/إلى سورة وآية)', variant: 'destructive' }); return; }
    if (!orderOk) { toast({ title: 'تنبيه', description: 'بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف', variant: 'destructive' }); return; }
    // نصاب التثبيت ونصاب الحفظ إجباريان — لا حفظ بدونهما (عدا حلقات الحرم)
    if (!sponsor && (!thabit || !hifz)) { toast({ title: 'تنبيه', description: 'يجب تأكيد نصاب التثبيت (سرد ذاتي) ونصاب الحفظ (سرد على شخص) قبل الحفظ', variant: 'destructive' }); return; }
    if (isAbsent(selected)) { toast({ title: 'تنبيه', description: `لا يمكن تسجيل تسميع ل${cohortLabel(cohort)} غائبة`, variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('recitation_log').insert({
      ...subjectPayload(cohort, selected), teacher_id: teacher.id || null, circle_id: circle.id, date, period,
      // الصفحات مشتقة تلقائياً من نطاق السورة|الآية
      from_page: fromPageInfo?.page_number ?? null,
      to_page: toPageInfo?.page_number ?? null,
      from_surah: fromRef.surah, to_surah: toRef.surah,
      from_verse: fromRef.verse, to_verse: toRef.verse,
      from_sort_order: fromPageInfo?.sort_order ?? null, to_sort_order: toPageInfo?.sort_order ?? null,
      is_extra_memorization: sponsor ? false : isExtra,
      thabit_confirmed: sponsor ? false : thabit,
      hifz_confirmed: sponsor ? false : hifz,
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

  // حفظ الاختبار: نفس منطق صفحة الاختبار (exams) — النوع مثبَّت حسب يوم الاختبار،
  // والدرجة/التقدير يُحسبان في قاعدة البيانات ولا يظهران للمسجِّلة (أخطاء + لحون + تغيير مقطع فقط).
  const saveExam = async () => {
    if (!selected) { toast({ title: 'تنبيه', description: 'اختاري الطالبة', variant: 'destructive' }); return; }
    if (!examType) { toast({ title: 'تنبيه', description: 'لا يوجد اختبار مجدول في هذا اليوم', variant: 'destructive' }); return; }
    if (isExamDup) { toast({ title: 'تنبيه', description: 'سجّلت هذه الطالبة هذا الاختبار مسبقاً', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('exams').insert({
      student_id: selected, exam_type: examType, date,
      errors_section_1: errorCount, // عدد الأخطاء
      errors_section_2: lahnCount,  // عدد اللحون (يخصم ربع درجة مثل الخطأ)
      errors_section_3: 0,
      errors_section_4: 0,
      segment_changes: segmentChange ? 1 : 0,
      examiner_name: teacher.teacher_name,
      recorded_by: teacher.teacher_name, // سجل: من أدخلت الاختبار
      // total_errors, total_score, max_score are computed by the database
    });
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'تم تسجيل الاختبار' });
      setExamDone(prev => new Set(prev).add(`${selected}-${examType}`));
      setErrorCount(0); setLahnCount(0); setSegmentChange(false); setSelected('');
    }
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
        <BookOpen size={36} className="text-muted-foreground/30 mb-2" />
        <p className="text-muted-foreground text-sm">لا توجد {COHORT_PLURAL[cohort]} في «{circle.circle_name}»</p>
      </CardContent></Card>
    </>
  );

  return (
    <>
      {cohortChips}
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
              تغيير ال{cohortLabel(cohort)}
            </Button>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardContent className="pt-4 space-y-2 max-h-[65vh] overflow-y-auto">
          {shownPeople.map(s => {
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

      {/* بعد اختيار الطالبة: اختاري تسميع أو اختبار (طالبات فقط، الرابط العام). */}
      {selectedStudent && canExam && (
        <div className="flex rounded-md border border-border overflow-hidden text-sm w-fit">
          {([['recitation', 'التسميع'], ['exam', 'الاختبار']] as ['recitation' | 'exam', string][]).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setEntryMode(m)}
              className={`px-4 h-10 transition-colors ${entryMode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {selectedStudent && entryMode === 'exam' && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="font-medium text-sm">تسجيل اختبار — {selectedStudent.full_name}</p>
            {examType ? (
              <>
                <div className="text-sm bg-muted/50 p-2 rounded">
                  اختبار اليوم: <strong>{EXAM_TYPE_LABEL[examType] ?? examType}</strong>
                </div>
                {isExamDup && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                    <AlertCircle size={16} /> سجّلت هذه الطالبة هذا الاختبار مسبقاً
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">عدد الأخطاء</Label>
                    <NumberStepper value={errorCount} onChange={setErrorCount} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">عدد اللحون</Label>
                    <NumberStepper value={lahnCount} onChange={setLahnCount} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={segmentChange} onCheckedChange={v => setSegmentChange(!!v)} />
                  غيّرت المقطع (مسموح مرة واحدة فقط)
                </label>
                {/* الدرجة والتقدير يُحسبان في النظام ويظهران للمشرفات فقط */}
                <Button onClick={saveExam} disabled={saving || isExamDup} className="w-full">{saving ? 'جارٍ الحفظ…' : 'حفظ الاختبار'}</Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                لا يوجد اختبار مجدول في هذا اليوم. أيام الاختبارات: ١١ / ١٨ / ٢٢ يوليو — عدّلي التاريخ في الأعلى.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedStudent && entryMode === 'recitation' && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="font-medium text-sm">تسجيل تسميع — {selectedStudent.full_name}</p>
            {isRestricted && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                نطاق حفظ ال{cohortLabel(cohort)}: <strong>{selectedStudent.from_surah}</strong> ← <strong>{selectedStudent.to_surah}</strong> — الخيارات محصورة فيه.
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
            {/* حقول النِّصاب تُخفى لحلقات الحرم (لا تتبع النِّصاب) */}
            {!sponsor && (
            <div className="flex flex-wrap items-center gap-4">
              {/* نفس مسميات الصفحة الإدارية */}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={isExtra} onCheckedChange={v => setIsExtra(!!v)} /> حفظ زيادة خارج النصاب</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={thabit} onCheckedChange={v => setThabit(!!v)} /> نصاب التثبيت (سرد ذاتي) *</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={hifz} onCheckedChange={v => setHifz(!!v)} /> نصاب الحفظ (سرد على شخص) *</label>
            </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">عدد الأخطاء</Label>
                <NumberStepper value={errorCount} onChange={setErrorCount} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">عدد اللحون</Label>
                <NumberStepper value={lahnCount} onChange={setLahnCount} />
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
