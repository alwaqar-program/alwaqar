import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { sortCircles } from '@/lib/circle-order';
import { NumberStepper } from '@/components/ui/number-stepper';
import { BookOpen, AlertCircle, Download, Plus, Pencil } from 'lucide-react';
import { RecordHistoryButton } from '@/components/RecordHistoryButton';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';
import {
  allVerseOptions, verseOptionsInRange, parseVerseKey, globalIndexOfKey, pageOfVerse,
} from '@/lib/quran-verses';
import { Cohort, COHORTS, cohortLabel, COHORT_PLURAL, cohortSubjectColumn, subjectPayload } from '@/lib/cohorts';
import { CircleType, isSponsor, circleTypeLabel, CIRCLE_TYPE_FILTERS } from '@/lib/circle-type';

// درجة التسميع اليومي من 20: ربع درجة خصمًا لكل خطأ ولحن (تُحسب في قاعدة البيانات).
// المدخل هنا هو مجموع (الأخطاء + اللحون) — نفس نموذج الاختبارات.
const recitationScore = (total: number) => Math.max(0, 20 - 0.25 * total);
// التقدير — يطابق العمود المولّد: 0-2 ممتاز · 3-4 جيد جدًا · 5-6 جيد · 7+ ضعيف
const getGrade = (total: number) => {
  if (total <= 2) return { text: 'ممتاز', color: 'text-success' };
  if (total <= 4) return { text: 'جيد جدًا', color: 'text-info' };
  if (total <= 6) return { text: 'جيد', color: 'text-accent' };
  return { text: 'ضعيف', color: 'text-destructive' };
};
const gradeColors: Record<string, string> = {
  'ممتاز': 'bg-success/10 text-success border-success/20',
  'جيد جدًا': 'bg-info/10 text-info border-info/20',
  'جيد': 'bg-accent/10 text-accent border-accent/20',
  'مقبول': 'bg-warning/10 text-warning border-warning/20', // legacy rows
  'ضعيف': 'bg-destructive/10 text-destructive border-destructive/20',
};

const overviewCsvColumns: CsvColumnDef[] = [
  { key: 'full_name', header: 'الطالبة' },
  { key: 'circle_name', header: 'الحلقة' },
  { key: 'range', header: 'النطاق' },
  { key: 'pages', header: 'الصفحات' },
  { key: 'errors', header: 'الأخطاء' },
  { key: 'lahn', header: 'اللحون' },
  { key: 'score', header: 'الدرجة /20' },
  { key: 'grade', header: 'التقدير' },
  { key: 'recorded_by', header: 'سجّلها' },
];

interface Person {
  id: string; full_name: string; circle_id: string | null; kind: Cohort;
  from_surah: string | null; to_surah: string | null;
}
interface Circle { id: string; circle_name: string; circle_type: string; }
interface MushafPage {
  page_number: number; surah_name: string; surah_number: number;
  juz_number: number; sort_order: number; verse_start: number; verse_end: number;
}
interface RecRow {
  id: string; student_id: string | null; companion_id: string | null; beginner_id: string | null;
  period: string;
  from_surah: string | null; from_verse: number | null;
  to_surah: string | null; to_verse: number | null;
  pages_recited: number | null; error_count: number; lahn_count: number | null;
  score: number | null; grade: string | null;
  thabit_confirmed: boolean | null; hifz_confirmed: boolean | null; is_extra_memorization: boolean | null;
  recorded_by: string | null;
  teachers?: { teacher_name: string } | null;
}
interface AttRow {
  student_id: string | null; companion_id: string | null; beginner_id: string | null;
  status: string; period: string;
}

export default function RecitationPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  // من أدخل السجل — يظهر في اللوق أنه مدير النظام
  const adminName = user?.email ? `مدير النظام (${user.email})` : 'مدير النظام';

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState<'morning' | 'evening'>('morning');
  const [filterCircle, setFilterCircle] = useState('');
  const [filterCohort, setFilterCohort] = useState<'' | Cohort>('');
  const [filterCircleType, setFilterCircleType] = useState<'' | CircleType>('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | recited | notRecited
  const [search, setSearch] = useState('');

  const [people, setPeople] = useState<Person[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [mushafPages, setMushafPages] = useState<MushafPage[]>([]);
  const [recRows, setRecRows] = useState<RecRow[]>([]);
  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ----- Entry dialog (إدخال تسميع) -----
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryCohort, setEntryCohort] = useState<Cohort>('student');
  const [entryStudent, setEntryStudent] = useState('');
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [lahnCount, setLahnCount] = useState(0);
  const [isExtra, setIsExtra] = useState(false);
  const [thabitConfirmed, setThabitConfirmed] = useState(false);
  const [hifzConfirmed, setHifzConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // set = تعديل سجل موجود

  // ----- حل التكرار: عرض سجلات فترة واحدة واعتماد سجل وحذف الباقي -----
  const [dupResolve, setDupResolve] = useState<{ name: string; recs: RecRow[] } | null>(null);
  const [resolving, setResolving] = useState(false);
  const loadingEditRef = useRef(false); // يمنع مسح الحقول عند تعبئة نموذج التعديل

  useEffect(() => {
    const loadStatic = async () => {
      const [stRes, coRes, beRes, cRes, mRes] = await Promise.all([
        supabase.from('students')
          .select('id, full_name, circle_id, from_surah, to_surah, is_active')
          .eq('is_active', true).order('full_name'),
        supabase.from('companions').select('id, full_name, circle_id, is_active').order('full_name'),
        supabase.from('beginners').select('id, full_name, circle_id, is_active').order('full_name'),
        supabase.from('circles').select('id, circle_name, circle_type').eq('is_active', true),
        supabase.from('mushaf_reference')
          .select('page_number, surah_name, surah_number, juz_number, sort_order, verse_start, verse_end')
          .order('sort_order'),
      ]);
      if (stRes.error) toast({ title: 'خطأ', description: stRes.error.message, variant: 'destructive' });
      const merge = (rows: any[] | null, kind: Cohort): Person[] =>
        (rows || []).filter(r => r.is_active !== false)
          .map(r => ({
            id: r.id, full_name: r.full_name, circle_id: r.circle_id, kind,
            from_surah: r.from_surah ?? null, to_surah: r.to_surah ?? null,
          }));
      setPeople([
        ...merge(stRes.data, 'student'),
        ...merge(coRes.data, 'companion'),
        ...merge(beRes.data, 'beginner'),
      ]);
      setCircles(sortCircles(cRes.data || []));
      setMushafPages(mRes.data || []);
    };
    loadStatic();
  }, [toast]);

  const loadDay = async () => {
    setLoading(true);
    const [recRes, attRes] = await Promise.all([
      supabase.from('recitation_log')
        .select('id, student_id, companion_id, beginner_id, period, from_surah, from_verse, to_surah, to_verse, pages_recited, error_count, lahn_count, score, grade, thabit_confirmed, hifz_confirmed, is_extra_memorization, recorded_by, teachers(teacher_name)')
        .eq('date', date).eq('is_deleted', false),
      supabase.from('attendance').select('student_id, companion_id, beginner_id, status, period').eq('date', date).eq('is_deleted', false),
    ]);
    if (recRes.error) toast({ title: 'خطأ', description: recRes.error.message, variant: 'destructive' });
    setRecRows((recRes.data as RecRow[] | null) || []);
    setAttRows(attRes.data || []);
    setLoading(false);
  };
  useEffect(() => { loadDay(); }, [date]); // eslint-disable-line

  const circleName = (id: string | null) => circles.find(c => c.id === id)?.circle_name || '-';
  const circleTypeOf = (id: string | null) => circles.find(c => c.id === id)?.circle_type;
  const recsFor = (personId: string, kind: Cohort) => {
    const col = cohortSubjectColumn(kind);
    return recRows.filter(r => (r as any)[col] === personId && r.period === period);
  };
  const isAbsent = (personId: string, kind: Cohort) => {
    const col = cohortSubjectColumn(kind);
    return attRows.some(a => (a as any)[col] === personId && a.period === period && a.status === 'absent');
  };

  const fmtRange = (r: RecRow) => {
    const from = r.from_surah ? `${r.from_surah}${r.from_verse ? `|${r.from_verse}` : ''}` : '';
    const to = r.to_surah ? `${r.to_surah}${r.to_verse ? `|${r.to_verse}` : ''}` : '';
    return from || to ? `${from} ← ${to}` : '-';
  };

  // Overview: one row per person (any cohort) for date+period.
  // `overviewAll` ignores the status filter so the summary counts stay totals.
  const overviewAll = useMemo(() => {
    return people
      .filter(p => !filterCohort || p.kind === filterCohort)
      .filter(p => !filterCircle || p.circle_id === filterCircle)
      .filter(p => !filterCircleType || circleTypeOf(p.circle_id) === filterCircleType)
      .filter(p => !search || p.full_name.includes(search))
      .map(p => {
        const recs = recsFor(p.id, p.kind);
        const last = recs[recs.length - 1];
        return {
          id: p.id,
          kind: p.kind,
          kind_label: cohortLabel(p.kind),
          full_name: p.full_name,
          circle_name: circleName(p.circle_id),
          circle_id: p.circle_id,
          recited: recs.length > 0,
          count: recs.length,
          range: last ? fmtRange(last) : '',
          pages: recs.reduce((sum, r) => sum + (r.pages_recited || 0), 0) || '',
          errors: last ? last.error_count : '',
          lahn: last ? (last.lahn_count ?? 0) : '',
          score: last?.score ?? '',
          grade: last?.grade ?? '',
          recorded_by: last ? (last.recorded_by || last.teachers?.teacher_name || '—') : '',
          absent: isAbsent(p.id, p.kind),
          editRec: last ?? null, // آخر سجل تسميع (للتعديل)
          recs, // كل سجلات هذه الفترة (لحل التكرار)
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, recRows, attRows, period, filterCircle, filterCohort, filterCircleType, search, circles]);

  const recitedCount = overviewAll.filter(r => r.recited).length;
  const notRecited = overviewAll.length - recitedCount;

  // Apply the clickable status filter on top of the other filters.
  const filteredOverview = useMemo(() => {
    if (!filterStatus) return overviewAll;
    return overviewAll.filter(r => filterStatus === 'recited' ? r.recited : !r.recited);
  }, [overviewAll, filterStatus]);

  // Sortable columns (same behaviour as the students table).
  const { sortKey, sortDir, toggleSort } = useTableSort();
  const overview = useMemo(() => {
    const acc: Record<string, { get: (r: (typeof filteredOverview)[number]) => unknown; type: 'text' | 'number' }> = {
      name: { get: (r) => r.full_name, type: 'text' },
      circle: { get: (r) => r.circle_name, type: 'text' },
      range: { get: (r) => r.range, type: 'text' },
      pages: { get: (r) => r.pages, type: 'number' },
      errors: { get: (r) => r.errors, type: 'number' },
      lahn: { get: (r) => r.lahn, type: 'number' },
      score: { get: (r) => r.score, type: 'number' },
      grade: { get: (r) => r.grade, type: 'text' },
      recorded_by: { get: (r) => r.recorded_by, type: 'text' },
    };
    const col = sortKey ? acc[sortKey] : null;
    if (!col) return filteredOverview;
    return sortRows(filteredOverview, col.get, sortDir, col.type);
  }, [filteredOverview, sortKey, sortDir]);

  // Pagination for the overview table.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(overview.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  useEffect(() => { setPage(1); }, [date, period, filterCircle, filterCohort, filterCircleType, filterStatus, search, sortKey, sortDir]);
  const pagedOverview = overview.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ----- Entry dialog helpers -----
  const entryPeople = useMemo(
    () => people.filter(p => p.kind === entryCohort),
    [people, entryCohort],
  );
  const entryStudentObj = people.find(p => p.id === entryStudent && p.kind === entryCohort);
  // حلقات الحرم لا تتبع النِّصاب: تُخفى حقول (زيادة/تثبيت/حفظ) ولا تُشترط.
  const entrySponsor = isSponsor(circleTypeOf(entryStudentObj?.circle_id ?? null));
  const verseOpts = useMemo(() => {
    if (entryStudentObj?.from_surah && entryStudentObj?.to_surah) {
      return verseOptionsInRange(entryStudentObj.from_surah, entryStudentObj.to_surah);
    }
    return allVerseOptions();
  }, [entryStudentObj?.from_surah, entryStudentObj?.to_surah]);
  const isRestricted = entryStudentObj?.from_surah && entryStudentObj?.to_surah
    && verseOpts.length < allVerseOptions().length;

  useEffect(() => { if (loadingEditRef.current) return; setFromVerse(''); setToVerse(''); }, [entryStudent]);
  // Switching cohort clears the selected person (ids don't cross cohorts).
  useEffect(() => { if (loadingEditRef.current) return; setEntryStudent(''); }, [entryCohort]);
  // بعد تعبئة نموذج التعديل (كل التغييرات في نفس الدورة) نُعيد تفعيل المسح للتغييرات اللاحقة.
  useEffect(() => { loadingEditRef.current = false; });

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
  const totalErrors = errorCount + lahnCount; // أخطاء + لحون — نفس نموذج الاختبارات
  const grade = getGrade(totalErrors);

  const resetEntry = () => {
    setEditingId(null);
    setEntryCohort('student'); setEntryStudent(''); setFromVerse(''); setToVerse('');
    setErrorCount(0); setLahnCount(0); setIsExtra(false); setThabitConfirmed(false); setHifzConfirmed(false);
  };

  // فتح نموذج التعديل معبّأً بقيم سجل موجود.
  const openEditRec = (r: RecRow) => {
    loadingEditRef.current = true; // امنع مسح الحقول أثناء التعبئة
    const kind: Cohort = r.student_id ? 'student' : r.companion_id ? 'companion' : 'beginner';
    const subjectId = r.student_id || r.companion_id || r.beginner_id || '';
    setEditingId(r.id);
    setEntryCohort(kind);
    setEntryStudent(subjectId);
    setFromVerse(r.from_surah ? `${r.from_surah}${r.from_verse ? `|${r.from_verse}` : ''}` : '');
    setToVerse(r.to_surah ? `${r.to_surah}${r.to_verse ? `|${r.to_verse}` : ''}` : '');
    setErrorCount(r.error_count || 0);
    setLahnCount(r.lahn_count || 0);
    setIsExtra(!!r.is_extra_memorization);
    setThabitConfirmed(!!r.thabit_confirmed);
    setHifzConfirmed(!!r.hifz_confirmed);
    setEntryOpen(true);
  };

  // فتح نموذج إدخال جديد مضبوطاً على شخص معيّن (من زر الصف).
  const openEntryForPerson = (personId: string, kind: Cohort) => {
    loadingEditRef.current = true; // امنع مسح الحقول أثناء الضبط
    resetEntry();
    setEntryCohort(kind);
    setEntryStudent(personId);
    setEntryOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!entryStudent || !fromRef || !toRef) {
      toast({ title: 'تنبيه', description: `اختر ${cohortLabel(entryCohort)} ونطاق التسميع (من/إلى سورة وآية)`, variant: 'destructive' });
      return;
    }
    if (!isOrderValid) {
      toast({ title: 'تنبيه', description: 'بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف', variant: 'destructive' });
      return;
    }
    if (!entrySponsor && (!thabitConfirmed || !hifzConfirmed)) {
      toast({ title: 'تنبيه', description: 'يجب تأكيد نصاب التثبيت (سرد ذاتي) ونصاب الحفظ (سرد على شخص) قبل الحفظ', variant: 'destructive' });
      return;
    }
    if (isAbsent(entryStudent, entryCohort)) {
      toast({ title: 'تنبيه', description: `لا يمكن تسجيل تسميع ${cohortLabel(entryCohort)} غائبة`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    // الحقول القابلة للتحرير (grade + score /20 يحسبهما DB كأعمدة مولّدة).
    const fields = {
      from_page: fromPageInfo?.page_number ?? null,
      to_page: toPageInfo?.page_number ?? null,
      from_surah: fromRef.surah,
      to_surah: toRef.surah,
      from_verse: fromRef.verse,
      to_verse: toRef.verse,
      from_sort_order: fromPageInfo?.sort_order ?? null,
      to_sort_order: toPageInfo?.sort_order ?? null,
      is_extra_memorization: entrySponsor ? false : isExtra,
      thabit_confirmed: entrySponsor ? false : thabitConfirmed,
      hifz_confirmed: entrySponsor ? false : hifzConfirmed,
      error_count: errorCount,
      lahn_count: lahnCount,
      recorded_by: adminName, // آخر من سجّل/عدّل — والتاريخ الكامل في سجل التدقيق
    };
    // تعديل: تحديث بالمعرّف. إدخال جديد: نضيف الحلقة والتاريخ والفترة.
    const { error } = editingId
      ? await supabase.from('recitation_log').update(fields).eq('id', editingId)
      : await supabase.from('recitation_log').insert({
          ...subjectPayload(entryCohort, entryStudent),
          teacher_id: null, // إدخال إداري — الإسناد عبر recorded_by
          circle_id: entryStudentObj?.circle_id ?? null,
          date, period, ...fields,
        });

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingId ? 'تم تعديل التسميع بنجاح' : 'تم حفظ التسميع بنجاح' });
      setEntryOpen(false);
      resetEntry();
      loadDay();
    }
    setSaving(false);
  };

  // اعتماد سجل واحد وحذف باقي سجلات التكرار (حذف ناعم — قابل للاسترجاع من سجل التدقيق).
  const confirmRecord = async (keepId: string) => {
    if (!dupResolve) return;
    const toDelete = dupResolve.recs.filter(r => r.id !== keepId);
    if (toDelete.length === 0) { setDupResolve(null); return; }
    setResolving(true);
    for (const r of toDelete) {
      const { error } = await supabase.from('recitation_log')
        .update({ is_deleted: true }).eq('id', r.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); setResolving(false); return; }
    }
    toast({ title: `تم اعتماد سجل واحد وحذف ${toDelete.length} سجل مكرر` });
    setDupResolve(null); setResolving(false); loadDay();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display text-foreground">التسميع</h1>
          <p className="text-sm text-muted-foreground mt-1">استعراض التسميع المسجّل لكل الحلقات — ومن سجّله</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() =>
            exportToCsv(overview.map(r => ({ ...r, grade: r.grade || 'لم تُسمِّع' })), overviewCsvColumns, `recitation_${date}_${period}`)
          }>
            <Download size={14} /> تصدير CSV
          </Button>
          <Button onClick={() => { resetEntry(); setEntryOpen(true); }}>
            <Plus size={18} /> إدخال تسميع
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" dir="ltr" className="h-10 w-[150px]" value={date} max={today}
              onChange={e => setDate(e.target.value || today)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الفترة</Label>
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              {(['morning', 'evening'] as const).map(p => (
                <button key={p} type="button" onClick={() => setPeriod(p)}
                  className={`px-4 h-10 transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  {p === 'morning' ? 'صباحي' : 'مسائي'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الفئة</Label>
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              {(['', ...COHORTS] as const).map(k => (
                <button key={k || 'all'} type="button" onClick={() => setFilterCohort(k as '' | Cohort)}
                  className={`px-3 h-10 transition-colors ${filterCohort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  {k === '' ? 'الكل' : COHORT_PLURAL[k as Cohort]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">نوع الحلقة</Label>
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              {CIRCLE_TYPE_FILTERS.map(([value, label]) => (
                <button key={value || 'all'} type="button" onClick={() => setFilterCircleType(value as '' | CircleType)}
                  className={`px-3 h-10 transition-colors ${filterCircleType === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 min-w-[180px]">
            <Label className="text-xs">الحلقة</Label>
            <SearchableSelect
              options={[{ value: '', label: 'كل الحلقات' }, ...circles.map(c => ({ value: c.id, label: c.circle_name }))]}
              value={filterCircle} onValueChange={setFilterCircle}
              placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة..." allowClear />
          </div>
          <div className="space-y-1.5 min-w-[180px] flex-1 max-w-xs">
            <Label className="text-xs">بحث</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="الاسم..." />
          </div>
        </CardContent>
      </Card>

      {/* Summary — clickable status filters (اضغطي للتصفية) */}
      <div className="flex gap-2 flex-wrap items-center">
        {([
          { key: 'recited', label: 'سمّعت', color: 'bg-success/10 text-success border-success/20', n: recitedCount },
          { key: 'notRecited', label: 'لم تُسمِّع', color: 'bg-destructive/10 text-destructive border-destructive/20', n: notRecited },
        ] as const).map(f => {
          const active = filterStatus === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterStatus(active ? '' : f.key)}
              title={active ? 'إلغاء التصفية' : 'تصفية حسب هذه الحالة'}
              className={`rounded-full transition ${active ? 'ring-2 ring-primary ring-offset-1' : 'opacity-90 hover:opacity-100'}`}
            >
              <Badge variant="outline" className={`cursor-pointer ${f.color}`}>{f.label}: {f.n}</Badge>
            </button>
          );
        })}
        {filterStatus && (
          <button type="button" onClick={() => setFilterStatus('')}
            className="text-xs text-muted-foreground underline hover:text-foreground">
            إظهار الكل
          </button>
        )}
      </div>

      {/* Overview table */}
      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : overview.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا يوجد أعضاء مطابقون</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="الطالبة" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الحلقة" sortKey="circle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="النطاق" sortKey="range" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الصفحات" sortKey="pages" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الأخطاء" sortKey="errors" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="اللحون" sortKey="lahn" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الدرجة /20" sortKey="score" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="التقدير" sortKey="grade" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="سجّلها" sortKey="recorded_by" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedOverview.map(r => (
                <TableRow key={r.id} className={!r.recited ? 'bg-muted/20' : ''}>
                  <TableCell className="font-medium">
                    {r.full_name}
                    {r.count > 1 && (
                      <button type="button" onClick={() => setDupResolve({ name: r.full_name, recs: r.recs })}
                        title="سجلات مكررة — اضغطي للمراجعة واعتماد سجل واحد">
                        <Badge variant="secondary" className="mr-1.5 text-xs cursor-pointer hover:bg-warning/20 hover:text-warning">×{r.count}</Badge>
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.circle_name}
                    {circleTypeLabel(circleTypeOf(r.circle_id)) && (
                      <Badge variant="secondary" className="mr-1.5 text-[10px]">{circleTypeLabel(circleTypeOf(r.circle_id))}</Badge>
                    )}
                  </TableCell>
                  {r.recited ? (
                    <>
                      <TableCell className="text-sm">{r.range}</TableCell>
                      <TableCell>{r.pages}</TableCell>
                      <TableCell>{r.errors}</TableCell>
                      <TableCell>{r.lahn}</TableCell>
                      <TableCell className="font-bold">{r.score}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={gradeColors[r.grade] || ''}>{r.grade}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.recorded_by}</TableCell>
                      <TableCell>
                        {r.editRec && (
                          <div className="flex items-center gap-0.5">
                            <RecordHistoryButton tableName="recitation_log" rowId={r.editRec.id} title={r.full_name} />
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              title={r.count > 1 ? 'سجلات مكررة — مراجعة واعتماد سجل واحد' : 'تعديل التسميع'}
                              onClick={() => r.count > 1 ? setDupResolve({ name: r.full_name, recs: r.recs }) : openEditRec(r.editRec!)}>
                              <Pencil size={14} />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell colSpan={6}>
                        <span className="text-muted-foreground text-sm">
                          {r.absent ? 'غائبة — لا تسميع' : 'لم تُسمِّع'}
                        </span>
                      </TableCell>
                      <TableCell />
                      <TableCell>
                        {!r.absent && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="تسجيل تسميع"
                            onClick={() => openEntryForPerson(r.id, r.kind)}>
                            <Pencil size={14} />
                          </Button>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={safePage} pageSize={PAGE_SIZE} total={overview.length} onPageChange={setPage} />
        </Card>
      )}

      {/* إدخال تسميع */}
      <Dialog open={entryOpen} onOpenChange={(o) => { setEntryOpen(o); if (!o) resetEntry(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? 'تعديل تسميع' : 'إدخال تسميع'} — {date} ({period === 'morning' ? 'صباحي' : 'مسائي'})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>الفئة</Label>
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {COHORTS.map(k => (
                  <button key={k} type="button" disabled={!!editingId} onClick={() => setEntryCohort(k)}
                    className={`flex-1 px-3 h-10 transition-colors ${entryCohort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'} ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {COHORT_PLURAL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{cohortLabel(entryCohort)}</Label>
              <SearchableSelect
                disabled={!!editingId}
                options={entryPeople.map(p => ({ value: p.id, label: `${p.full_name} — ${circleName(p.circle_id)}` }))}
                value={entryStudent} onValueChange={setEntryStudent}
                placeholder={`اختر ${cohortLabel(entryCohort)}`} searchPlaceholder={`ابحث عن ${cohortLabel(entryCohort)}...`} />
            </div>

            {entryStudent && isAbsent(entryStudent, entryCohort) && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                <AlertCircle size={16} /> هذه {cohortLabel(entryCohort)} غائبة في هذه الفترة — لا يمكن تسجيل تسميع لها
              </div>
            )}

            {entryStudent && (
              <>
                {isRestricted && (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    نطاق حفظ {cohortLabel(entryCohort)}: <strong>{entryStudentObj?.from_surah}</strong> ← <strong>{entryStudentObj?.to_surah}</strong> — الخيارات محصورة فيه.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>من: سورة | رقم الآية *</Label>
                    <SearchableSelect options={verseOpts} value={fromVerse} onValueChange={setFromVerse}
                      placeholder="السورة|الآية" searchPlaceholder="مثال: البقرة 5" maxVisible={100} allowClear />
                  </div>
                  <div className="space-y-2">
                    <Label>إلى: سورة | رقم الآية *</Label>
                    <SearchableSelect options={verseOpts} value={toVerse} onValueChange={setToVerse}
                      placeholder="السورة|الآية" searchPlaceholder="مثال: البقرة 10" maxVisible={100} allowClear />
                  </div>
                </div>

                {!isOrderValid && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                    <AlertCircle size={16} /> بداية النطاق يجب أن تكون قبل نهايته في ترتيب المصحف
                  </div>
                )}

                {isOrderValid && fromPageInfo && toPageInfo && (
                  <div className="text-sm bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <strong>الحصيلة:</strong> {pagesCount} صفحات (ص{fromPageInfo.page_number} → ص{toPageInfo.page_number})
                  </div>
                )}

                {/* حقول النِّصاب تُخفى لحلقات الحرم (لا تتبع النِّصاب) */}
                {!entrySponsor && (
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={isExtra} onCheckedChange={v => setIsExtra(!!v)} /> حفظ زيادة خارج النصاب
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={thabitConfirmed} onCheckedChange={v => setThabitConfirmed(!!v)} /> نصاب التثبيت (سرد ذاتي) *
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={hifzConfirmed} onCheckedChange={v => setHifzConfirmed(!!v)} /> نصاب الحفظ (سرد على شخص) *
                  </label>
                </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>عدد الأخطاء</Label>
                    <NumberStepper value={errorCount} onChange={setErrorCount} />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد اللحون</Label>
                    <NumberStepper value={lahnCount} onChange={setLahnCount} />
                  </div>
                  <div className="space-y-2">
                    <Label>الدرجة /20</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 font-bold">
                      {recitationScore(totalErrors)}<span className="text-xs text-muted-foreground mr-1">/ 20</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>التقدير</Label>
                    <div className={`h-10 flex items-center px-3 rounded-md border bg-muted/30 font-medium ${grade.color}`}>
                      {grade.text}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  سيُسجَّل في اللوق أن المدخِل: {adminName}
                </p>

                <Button onClick={handleSaveEntry} disabled={saving || !isOrderValid || isAbsent(entryStudent, entryCohort)} className="w-full">
                  {saving ? 'جارٍ الحفظ...' : editingId ? 'حفظ التعديل' : 'حفظ التسميع'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* حل التكرار: مراجعة السجلات المكررة واعتماد سجل واحد وحذف الباقي */}
      <Dialog open={!!dupResolve} onOpenChange={(o) => { if (!o) setDupResolve(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              سجلات مكررة — {dupResolve?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              يوجد {dupResolve?.recs.length} سجلات لهذه الفترة. اعتمدي السجل الصحيح — وسيُحذف الباقي (حذف قابل للاسترجاع من سجل التدقيق).
            </p>
            {dupResolve?.recs.map((rec, i) => (
              <div key={rec.id} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">سجل {i + 1}</span>
                  {rec.grade && <Badge variant="outline" className={gradeColors[rec.grade] || ''}>{rec.grade}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">النطاق:</span> {fmtRange(rec)}</div>
                  <div><span className="text-muted-foreground">الصفحات:</span> {rec.pages_recited ?? '-'}</div>
                  <div><span className="text-muted-foreground">الأخطاء:</span> {rec.error_count}</div>
                  <div><span className="text-muted-foreground">اللحون:</span> {rec.lahn_count ?? 0}</div>
                  <div><span className="text-muted-foreground">الدرجة:</span> <strong>{rec.score ?? '-'}</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">سجّلها:</span> {rec.recorded_by || rec.teachers?.teacher_name || '—'}</div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="flex-1" disabled={resolving} onClick={() => confirmRecord(rec.id)}>
                    اعتماد هذا السجل وحذف الباقي
                  </Button>
                  <RecordHistoryButton tableName="recitation_log" rowId={rec.id} title={dupResolve.name} />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
