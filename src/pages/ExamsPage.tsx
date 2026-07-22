import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { sortCircles } from '@/lib/circle-order';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { FileCheck, Plus, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import { CircleType, circleTypeLabel, CIRCLE_TYPE_FILTERS } from '@/lib/circle-type';
import { Cohort, COHORTS, COHORT_PLURAL, cohortLabel, subjectPayload } from '@/lib/cohorts';

const examTypes: Record<string, string> = {
  weekly_1: 'الأسبوع الأول',
  weekly_2: 'الأسبوع الثاني',
  final: 'النهائي',
  // legacy types (kept so old rows still render)
  quarter: 'ربع',
  half: 'نصف',
  complete: 'ختم',
};

// Each exam type implies a max score and a number of error sections (مقاطع).
const examConfig: Record<string, { max: number; sections: number }> = {
  weekly_1: { max: 20, sections: 2 },
  weekly_2: { max: 20, sections: 2 },
  final: { max: 40, sections: 4 },
};
// Types offered when creating a new exam.
const newExamTypes = ['weekly_1', 'weekly_2', 'final'] as const;

// الدرجة = الحد الأقصى − 0.25×الأخطاء − 2×تغيير المقطع (بحد أدنى صفر).
const examScore = (max: number, errors: number, changes: number) =>
  Math.max(0, max - 0.25 * errors - 2 * changes);

// التقدير مشتقّ من نسبة الدرجة إلى حدّها الأقصى (يوافق عتبات getScoreColor).
const examGradeText = (score: number | null, max: number | null): string => {
  if (!max) return 'ضعيف';
  const pct = ((score ?? 0) / max) * 100;
  if (pct >= 90) return 'ممتاز';
  if (pct >= 70) return 'جيد جدًا';
  if (pct >= 50) return 'جيد';
  return 'ضعيف';
};
const gradeColors: Record<string, string> = {
  'ممتاز': 'bg-success/10 text-success border-success/20',
  'جيد جدًا': 'bg-info/10 text-info border-info/20',
  'جيد': 'bg-warning/10 text-warning border-warning/20',
  'ضعيف': 'bg-destructive/10 text-destructive border-destructive/20',
};

const examCsvColumns: CsvColumnDef[] = [
  { key: 'subject_name', header: 'الاسم' },
  { key: 'cohort_label', header: 'الفئة' },
  { key: 'exam_type', header: 'النوع', transform: v => examTypes[v as string] || v },
  { key: 'date', header: 'التاريخ' },
  { key: 'errors_section_1', header: 'عدد الأخطاء' },
  { key: 'errors_section_2', header: 'عدد اللحون' },
  { key: 'segment_changes', header: 'تغيير المقطع' },
  { key: 'total_score', header: 'الدرجة' },
  { key: 'max_score', header: 'الحد الأقصى' },
  { key: 'examiner_name', header: 'المختبرة' },
  { key: 'recorded_by', header: 'سجّلها' },
];

interface Person {
  id: string;
  full_name: string;
  circle_id: string | null;
  kind: Cohort;
}

interface Circle { id: string; circle_name: string; circle_type: string; }

type SubjectJoin = { full_name: string; circle_id: string | null } | null;

interface Exam {
  id: string;
  student_id: string | null;
  companion_id: string | null;
  beginner_id: string | null;
  exam_type: string;
  date: string;
  errors_section_1: number | null;
  errors_section_2: number | null;
  errors_section_3: number | null;
  errors_section_4: number | null;
  segment_changes: number | null;
  total_errors: number | null;
  total_score: number | null;
  max_score: number | null;
  examiner_name: string | null;
  recorded_by: string | null;
  students?: SubjectJoin;
  companions?: SubjectJoin;
  beginners?: SubjectJoin;
}

// من هو صاحب الاختبار (طالبة/مرافقة/مبتدئة) — أيّاً كان عمود الفاعل المعبّأ.
const examSubject = (e: Exam): { id: string; kind: Cohort; name: string; circle_id: string | null } => {
  if (e.companion_id) return { id: e.companion_id, kind: 'companion', name: e.companions?.full_name || '', circle_id: e.companions?.circle_id ?? null };
  if (e.beginner_id) return { id: e.beginner_id, kind: 'beginner', name: e.beginners?.full_name || '', circle_id: e.beginners?.circle_id ?? null };
  return { id: e.student_id || '', kind: 'student', name: e.students?.full_name || '', circle_id: e.students?.circle_id ?? null };
};

export default function ExamsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  // من أدخل السجل — يظهر في اللوق أنه مدير النظام
  const adminName = user?.email ? `مدير النظام (${user.email})` : 'مدير النظام';
  const [exams, setExams] = useState<Exam[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [coverageCircle, setCoverageCircle] = useState('');
  const [filterCircleType, setFilterCircleType] = useState<'' | CircleType>('');
  const [filterMissingType, setFilterMissingType] = useState(''); // '' | exam type → show only those not tested for it
  const [coverageCohort, setCoverageCohort] = useState<'' | Cohort>('');
  // فلاتر تبويب «السجل» (مستقلة عن تبويب التغطية).
  const [logCircle, setLogCircle] = useState('');
  const [logCircleType, setLogCircleType] = useState<'' | CircleType>('');
  const [logCohort, setLogCohort] = useState<'' | Cohort>('');
  const [logType, setLogType] = useState<'' | string>('');
  const [logSearch, setLogSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingExams, setExistingExams] = useState<Set<string>>(new Set());

  // subject_id = معرّف الطالبة/المرافقة/المبتدئة حسب cohort. errors_section_1 = الأخطاء، _2 = اللحون.
  const emptyForm = {
    cohort: 'student' as Cohort,
    subject_id: '',
    exam_type: 'weekly_1' as string,
    errors_section_1: 0,
    errors_section_2: 0,
    segment_changes: 0,
    examiner_name: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const { sortKey, sortDir, toggleSort } = useTableSort();

  const fetchData = async () => {
    const [exRes, stRes, coRes, beRes, cRes] = await Promise.all([
      supabase.from('exams')
        .select('*, students(full_name, circle_id), companions(full_name, circle_id), beginners(full_name, circle_id)')
        .eq('is_deleted', false).order('date', { ascending: false }),
      supabase.from('students').select('id, full_name, circle_id').eq('is_active', true).order('full_name'),
      supabase.from('companions').select('id, full_name, circle_id').eq('is_active', true).order('full_name'),
      supabase.from('beginners').select('id, full_name, circle_id').eq('is_active', true).order('full_name'),
      supabase.from('circles').select('id, circle_name, circle_type').eq('is_active', true),
    ]);
    if (exRes.error) toast({ title: 'خطأ', description: exRes.error.message, variant: 'destructive' });
    setExams(exRes.data || []);
    const mk = (rows: any[] | null, kind: Cohort): Person[] =>
      (rows || []).map(r => ({ id: r.id, full_name: r.full_name, circle_id: r.circle_id ?? null, kind }));
    setPeople([...mk(stRes.data, 'student'), ...mk(coRes.data, 'companion'), ...mk(beRes.data, 'beginner')]);
    setCircles(sortCircles(cRes.data || []));
    // مفاتيح التكرار: معرّف الفاعل + نوع الاختبار (أيّاً كانت الفئة).
    const keys = new Set((exRes.data || []).map(e => `${examSubject(e).id}-${e.exam_type}`));
    setExistingExams(keys);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // People of the currently-selected cohort in the new-exam dialog.
  const formPeople = useMemo(() => people.filter(p => p.kind === form.cohort), [people, form.cohort]);
  // Switching cohort clears the selected person (ids don't cross cohorts).
  useEffect(() => { setForm(f => ({ ...f, subject_id: '' })); }, [form.cohort]);

  // Check for duplicate when subject or exam type changes
  useEffect(() => {
    if (form.subject_id && form.exam_type) {
      setDuplicateWarning(existingExams.has(`${form.subject_id}-${form.exam_type}`));
    } else {
      setDuplicateWarning(false);
    }
  }, [form.subject_id, form.exam_type, existingExams]);

  const cfg = examConfig[form.exam_type] ?? { max: 100, sections: 3 };
  const totalErrors = form.errors_section_1 + form.errors_section_2; // أخطاء + لحون
  const totalScore = examScore(cfg.max, totalErrors, form.segment_changes);

  // Colour by ratio of score to its max (so /20 and /40 scale the same).
  const getScoreColor = (score: number | null, max: number | null) => {
    if (!score || !max) return 'text-destructive';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'text-success';
    if (pct >= 70) return 'text-info';
    if (pct >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const handleSave = async () => {
    if (!form.subject_id) {
      toast({ title: 'تنبيه', description: `اختر ال${cohortLabel(form.cohort)}`, variant: 'destructive' });
      return;
    }
    if (duplicateWarning) {
      toast({ title: 'تنبيه', description: `هذه ال${cohortLabel(form.cohort)} أدت هذا الاختبار مسبقاً`, variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('exams').insert({
      ...subjectPayload(form.cohort, form.subject_id),
      exam_type: form.exam_type,
      errors_section_1: form.errors_section_1, // عدد الأخطاء
      errors_section_2: form.errors_section_2, // عدد اللحون
      errors_section_3: 0,
      errors_section_4: 0,
      segment_changes: form.segment_changes,
      examiner_name: form.examiner_name || null,
      recorded_by: adminName, // اللوق: أدخلها مدير النظام
      // total_errors, total_score, max_score are computed by the database.
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'تنبيه', description: `هذه ال${cohortLabel(form.cohort)} أدت هذا الاختبار مسبقاً`, variant: 'destructive' });
      } else {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'تم تسجيل الاختبار بنجاح' });
      setDialogOpen(false);
      fetchData();
    }
  };

  // ----- التغطية: من اختُبرت ومن لا، لكل نوع -----
  const circleName = (id: string | null) => circles.find(c => c.id === id)?.circle_name || '-';
  const circleTypeOf = (id: string | null) => circles.find(c => c.id === id)?.circle_type;

  // ----- تبويب «السجل»: تصفية ثم فرز -----
  const filteredExams = useMemo(() => exams
    .filter(e => !logType || e.exam_type === logType)
    .filter(e => !logCohort || examSubject(e).kind === logCohort)
    .filter(e => !logCircle || examSubject(e).circle_id === logCircle)
    .filter(e => !logCircleType || circleTypeOf(examSubject(e).circle_id) === logCircleType)
    .filter(e => !logSearch || examSubject(e).name.includes(logSearch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exams, logType, logCohort, logCircle, logCircleType, logSearch, circles]);

  const sortedExams = useMemo(() => {
    const acc: Record<string, (e: Exam) => unknown> = {
      student: (e) => examSubject(e).name,
      circle: (e) => circleName(examSubject(e).circle_id),
      type: (e) => examTypes[e.exam_type],
      date: (e) => e.date,
      errors: (e) => e.errors_section_1,
      lahn: (e) => e.errors_section_2,
      changes: (e) => e.segment_changes,
      score: (e) => e.total_score,
      grade: (e) => (e.max_score ? (e.total_score ?? 0) / e.max_score : 0),
      examiner: (e) => e.examiner_name,
    };
    const types: Record<string, 'date' | 'number'> = {
      date: 'date', errors: 'number', lahn: 'number', changes: 'number', score: 'number', grade: 'number',
    };
    if (!sortKey || !acc[sortKey]) return filteredExams;
    return sortRows(filteredExams, acc[sortKey], sortDir, types[sortKey] ?? 'text');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredExams, sortKey, sortDir, circles]);
  const coverage = useMemo(() => {
    // exams grouped by subject id (any cohort) → { exam_type: Exam }
    const bySubject = new Map<string, Record<string, Exam>>();
    exams.forEach(e => {
      const sid = examSubject(e).id;
      if (!bySubject.has(sid)) bySubject.set(sid, {});
      bySubject.get(sid)![e.exam_type] = e;
    });
    return people
      .filter(p => !coverageCohort || p.kind === coverageCohort)
      .filter(p => !coverageCircle || p.circle_id === coverageCircle)
      .filter(p => !filterCircleType || circleTypeOf(p.circle_id) === filterCircleType)
      .map(p => ({
        id: p.id,
        full_name: p.full_name,
        kind: p.kind,
        circle_id: p.circle_id,
        circle_name: circleName(p.circle_id),
        types: bySubject.get(p.id) ?? {},
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, exams, coverageCohort, coverageCircle, filterCircleType, circles]);
  const missingCount = (t: string) => coverage.filter(r => !r.types[t]).length;

  // Coverage sorting — distinct keys (cov_*) so it never collides with the
  // log table's sort, since both tables share the one useTableSort.
  const sortedCoverage = (() => {
    const acc: Record<string, (r: (typeof coverage)[number]) => unknown> = {
      cov_student: (r) => r.full_name,
      cov_circle: (r) => r.circle_name,
    };
    if (!sortKey || !acc[sortKey]) return coverage;
    return sortRows(coverage, acc[sortKey], sortDir, 'text');
  })();

  // Clickable «لم تُختبر» filter: show only those not tested for the chosen type.
  const filteredCoverage = filterMissingType
    ? sortedCoverage.filter(r => !r.types[filterMissingType])
    : sortedCoverage;

  // Pagination — coverage tab and log tab paginate independently.
  const PAGE_SIZE = 25;
  const [covPage, setCovPage] = useState(1);
  const covPageCount = Math.max(1, Math.ceil(filteredCoverage.length / PAGE_SIZE));
  const covSafePage = Math.min(covPage, covPageCount);
  useEffect(() => { setCovPage(1); }, [coverageCircle, filterCircleType, coverageCohort, filterMissingType, sortKey, sortDir]);
  const pagedCoverage = filteredCoverage.slice((covSafePage - 1) * PAGE_SIZE, covSafePage * PAGE_SIZE);

  const [logPage, setLogPage] = useState(1);
  const logPageCount = Math.max(1, Math.ceil(sortedExams.length / PAGE_SIZE));
  const logSafePage = Math.min(logPage, logPageCount);
  useEffect(() => { setLogPage(1); }, [sortKey, sortDir, logType, logCohort, logCircle, logCircleType, logSearch]);
  const pagedExams = sortedExams.slice((logSafePage - 1) * PAGE_SIZE, logSafePage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">الاختبارات</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل وعرض اختبارات التسميع</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions
            data={exams.map(e => ({ ...e, subject_name: examSubject(e).name, cohort_label: cohortLabel(examSubject(e).kind) }))}
            columns={examCsvColumns} tableName="exams" filename="exams" onImportComplete={fetchData} />
          <Button onClick={() => {
            setForm(emptyForm);
            setDialogOpen(true);
          }}>
            <Plus size={18} /> تسجيل اختبار
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">تسجيل اختبار جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>الفئة</Label>
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {COHORTS.map(k => (
                  <button key={k} type="button" onClick={() => setForm(f => ({ ...f, cohort: k }))}
                    className={`flex-1 px-3 h-10 transition-colors ${form.cohort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    {COHORT_PLURAL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{cohortLabel(form.cohort)}</Label>
              <SearchableSelect
                options={formPeople.map(p => ({ value: p.id, label: p.full_name }))}
                value={form.subject_id}
                onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}
                placeholder={`اختر ال${cohortLabel(form.cohort)}`}
                searchPlaceholder={`ابحث عن ${cohortLabel(form.cohort)}...`}
              />
            </div>
            <div className="space-y-2">
              <Label>نوع الاختبار</Label>
              <SearchableSelect
                options={newExamTypes.map(k => ({ value: k, label: `${examTypes[k]} (من ${examConfig[k].max})` }))}
                value={form.exam_type}
                onValueChange={v => setForm(f => ({ ...f, exam_type: v }))}
                placeholder="نوع الاختبار"
                searchPlaceholder="ابحث..."
              />
            </div>

            {duplicateWarning && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 p-2 rounded">
                <AlertCircle size={16} />
                هذه الطالبة أدت هذا الاختبار مسبقاً. لا يمكن التكرار.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">عدد الأخطاء</Label>
                <Input type="number" min={0} value={form.errors_section_1} onChange={e => setForm(f => ({ ...f, errors_section_1: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">عدد اللحون</Label>
                <Input type="number" min={0} value={form.errors_section_2} onChange={e => setForm(f => ({ ...f, errors_section_2: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="space-y-2">
              {/* مسموح مرة واحدة فقط (خصم درجتين) */}
              <Label className="text-xs">تغيير المقطع (مرة واحدة كحد أقصى، خصم درجتين)</Label>
              <Input type="number" min={0} max={1} value={form.segment_changes}
                onChange={e => setForm(f => ({ ...f, segment_changes: Math.min(1, Math.max(0, parseInt(e.target.value) || 0)) }))} />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">مجموع الأخطاء واللحون:</span>
                <span className="font-bold mr-2">{totalErrors}</span>
              </div>
              <div>
                <span className="text-muted-foreground">الدرجة:</span>
                <span className={`font-bold mr-2 ${getScoreColor(totalScore, cfg.max)}`}>{totalScore} / {cfg.max}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>اسم المختبرة</Label>
              <Input value={form.examiner_name} onChange={e => setForm(f => ({ ...f, examiner_name: e.target.value }))} />
            </div>

            <Button onClick={handleSave} disabled={duplicateWarning} className="w-full">حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : (
        <Tabs defaultValue="coverage" dir="rtl">
          <TabsList>
            <TabsTrigger value="coverage">التغطية — من اختُبرت ومن لا</TabsTrigger>
            <TabsTrigger value="log">السجل</TabsTrigger>
          </TabsList>

          <TabsContent value="coverage" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {([['', 'كل الفئات'], ...COHORTS.map(k => [k, COHORT_PLURAL[k]] as [Cohort, string])]).map(([value, label]) => (
                  <button key={value || 'all'} type="button" onClick={() => setCoverageCohort(value as '' | Cohort)}
                    className={`px-3 h-10 transition-colors ${coverageCohort === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {CIRCLE_TYPE_FILTERS.map(([value, label]) => (
                  <button key={value || 'all'} type="button" onClick={() => setFilterCircleType(value as '' | CircleType)}
                    className={`px-3 h-10 transition-colors ${filterCircleType === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <SearchableSelect
                className="w-56"
                options={[{ value: '', label: 'كل الحلقات' }, ...circles.map(c => ({ value: c.id, label: c.circle_name }))]}
                value={coverageCircle} onValueChange={setCoverageCircle}
                placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة..." allowClear />
              <div className="flex gap-2 flex-wrap items-center">
                {newExamTypes.map(t => {
                  const active = filterMissingType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterMissingType(active ? '' : t)}
                      title={active ? 'إلغاء التصفية' : 'عرض من لم تُختبر في هذا الاختبار فقط'}
                      className={`rounded-full transition ${active ? 'ring-2 ring-primary ring-offset-1' : 'opacity-90 hover:opacity-100'}`}
                    >
                      <Badge variant="outline" className="cursor-pointer bg-destructive/10 text-destructive border-destructive/20">
                        {examTypes[t]} — لم تُختبر: {missingCount(t)}
                      </Badge>
                    </button>
                  );
                })}
                {filterMissingType && (
                  <button type="button" onClick={() => setFilterMissingType('')}
                    className="text-xs text-muted-foreground underline hover:text-foreground">
                    إظهار الكل
                  </button>
                )}
              </div>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="الطالبة" sortKey="cov_student" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                    <SortableHead label="الحلقة" sortKey="cov_circle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                    {newExamTypes.map(t => <TableHead key={t} className="text-right">{examTypes[t]}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedCoverage.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.full_name}
                        {r.kind !== 'student' && (
                          <Badge variant="secondary" className="mr-1.5 text-[10px]">{cohortLabel(r.kind)}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.circle_name}
                        {circleTypeLabel(circleTypeOf(r.circle_id)) && (
                          <Badge variant="secondary" className="mr-1.5 text-[10px]">{circleTypeLabel(circleTypeOf(r.circle_id))}</Badge>
                        )}
                      </TableCell>
                      {newExamTypes.map(t => {
                        const e = r.types[t];
                        return (
                          <TableCell key={t}>
                            {e ? (
                              <span className={getScoreColor(e.total_score, e.max_score)}>
                                <span className="font-bold">{e.total_score}</span>
                                <span className="text-xs text-muted-foreground"> / {e.max_score}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={covSafePage} pageSize={PAGE_SIZE} total={filteredCoverage.length} onPageChange={setCovPage} />
            </Card>
          </TabsContent>

          <TabsContent value="log" className="space-y-4">
            {/* فلاتر السجل — الفئة + نوع الحلقة + نوع الاختبار + الحلقة + بحث */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">الفئة</Label>
                <div className="flex rounded-md border border-border overflow-hidden text-sm">
                  {([['', 'الكل'], ...COHORTS.map(k => [k, COHORT_PLURAL[k]] as [Cohort, string])]).map(([value, label]) => (
                    <button key={value || 'all'} type="button" onClick={() => setLogCohort(value as '' | Cohort)}
                      className={`px-3 h-10 transition-colors ${logCohort === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع الحلقة</Label>
                <div className="flex rounded-md border border-border overflow-hidden text-sm">
                  {CIRCLE_TYPE_FILTERS.map(([value, label]) => (
                    <button key={value || 'all'} type="button" onClick={() => setLogCircleType(value as '' | CircleType)}
                      className={`px-3 h-10 transition-colors ${logCircleType === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع الاختبار</Label>
                <div className="flex rounded-md border border-border overflow-hidden text-sm">
                  {([['', 'الكل'], ...newExamTypes.map(t => [t, examTypes[t]] as [string, string])]).map(([value, label]) => (
                    <button key={value || 'all'} type="button" onClick={() => setLogType(value)}
                      className={`px-3 h-10 transition-colors ${logType === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs">الحلقة</Label>
                <SearchableSelect
                  options={[{ value: '', label: 'كل الحلقات' }, ...circles.map(c => ({ value: c.id, label: c.circle_name }))]}
                  value={logCircle} onValueChange={setLogCircle}
                  placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة..." allowClear />
              </div>
              <div className="space-y-1.5 min-w-[180px] flex-1 max-w-xs">
                <Label className="text-xs">بحث</Label>
                <Input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="اسم الطالبة..." />
              </div>
            </div>

            {filteredExams.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileCheck size={40} className="text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">{exams.length === 0 ? 'لا توجد اختبارات بعد' : 'لا توجد اختبارات مطابقة للفلاتر'}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="الطالبة" sortKey="student" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="الحلقة" sortKey="circle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="النوع" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="التاريخ" sortKey="date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="عدد الأخطاء" sortKey="errors" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="عدد اللحون" sortKey="lahn" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="تغيير المقطع" sortKey="changes" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="الدرجة" sortKey="score" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="التقدير" sortKey="grade" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="المختبرة" sortKey="examiner" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <TableHead className="text-right">سجّلها</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedExams.map(e => {
                      const grade = examGradeText(e.total_score, e.max_score);
                      const subj = examSubject(e);
                      return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {subj.name}
                          {subj.kind !== 'student' && (
                            <Badge variant="secondary" className="mr-1.5 text-[10px]">{cohortLabel(subj.kind)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {circleName(subj.circle_id)}
                          {circleTypeLabel(circleTypeOf(subj.circle_id)) && (
                            <Badge variant="secondary" className="mr-1.5 text-[10px]">{circleTypeLabel(circleTypeOf(subj.circle_id))}</Badge>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline">{examTypes[e.exam_type]}</Badge></TableCell>
                        <TableCell dir="ltr" className="text-right">{e.date}</TableCell>
                        <TableCell>{e.errors_section_1 ?? 0}</TableCell>
                        <TableCell>{e.errors_section_2 ?? 0}</TableCell>
                        <TableCell>{e.segment_changes ?? 0}</TableCell>
                        <TableCell className={getScoreColor(e.total_score, e.max_score)}>
                          <span className="font-bold">{e.total_score}</span>
                          <span className="text-xs text-muted-foreground"> / {e.max_score}</span>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={gradeColors[grade] || ''}>{grade}</Badge></TableCell>
                        <TableCell>{e.examiner_name || '-'}</TableCell>
                        <TableCell className="text-sm">{e.recorded_by || e.examiner_name || '-'}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <TablePagination page={logSafePage} pageSize={PAGE_SIZE} total={sortedExams.length} onPageChange={setLogPage} />
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
