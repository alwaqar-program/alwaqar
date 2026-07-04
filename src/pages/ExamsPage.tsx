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

const examCsvColumns: CsvColumnDef[] = [
  { key: 'students', header: 'الطالبة', transform: v => v?.full_name || '' },
  { key: 'exam_type', header: 'النوع', transform: v => examTypes[v as string] || v },
  { key: 'date', header: 'التاريخ' },
  { key: 'total_errors', header: 'الأخطاء' },
  { key: 'segment_changes', header: 'تغيير المقطع' },
  { key: 'total_score', header: 'الدرجة' },
  { key: 'max_score', header: 'الحد الأقصى' },
  { key: 'examiner_name', header: 'المختبرة' },
  { key: 'recorded_by', header: 'سجّلها' },
];

interface Student {
  id: string;
  full_name: string;
  circle_id: string | null;
}

interface Circle { id: string; circle_name: string; }

interface Exam {
  id: string;
  student_id: string;
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
  students?: { full_name: string } | null;
}

export default function ExamsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  // من أدخل السجل — يظهر في اللوق أنه مدير النظام
  const adminName = user?.email ? `مدير النظام (${user.email})` : 'مدير النظام';
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [coverageCircle, setCoverageCircle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingExams, setExistingExams] = useState<Set<string>>(new Set());

  // errors_section_1 = عدد الأخطاء، errors_section_2 = عدد اللحون (كلٌّ يخصم ربع درجة)
  const emptyForm = {
    student_id: '',
    exam_type: 'weekly_1' as string,
    errors_section_1: 0,
    errors_section_2: 0,
    segment_changes: 0,
    examiner_name: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedExams = (() => {
    const acc: Record<string, (e: Exam) => unknown> = {
      student: (e) => e.students?.full_name,
      type: (e) => examTypes[e.exam_type],
      date: (e) => e.date,
      errors: (e) => e.total_errors,
      score: (e) => e.total_score,
      examiner: (e) => e.examiner_name,
    };
    const types: Record<string, 'date' | 'number'> = { date: 'date', errors: 'number', score: 'number' };
    if (!sortKey || !acc[sortKey]) return exams;
    return sortRows(exams, acc[sortKey], sortDir, types[sortKey] ?? 'text');
  })();

  const fetchData = async () => {
    const [exRes, stRes, cRes] = await Promise.all([
      supabase.from('exams').select('*, students(full_name)').eq('is_deleted', false).order('date', { ascending: false }),
      supabase.from('students').select('id, full_name, circle_id').eq('is_active', true).order('full_name'),
      supabase.from('circles').select('id, circle_name').eq('is_active', true),
    ]);
    if (exRes.error) toast({ title: 'خطأ', description: exRes.error.message, variant: 'destructive' });
    setExams(exRes.data || []);
    setStudents(stRes.data || []);
    setCircles(sortCircles(cRes.data || []));
    // Build existing exam keys
    const keys = new Set((exRes.data || []).map(e => `${e.student_id}-${e.exam_type}`));
    setExistingExams(keys);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Check for duplicate when student or exam type changes
  useEffect(() => {
    if (form.student_id && form.exam_type) {
      setDuplicateWarning(existingExams.has(`${form.student_id}-${form.exam_type}`));
    } else {
      setDuplicateWarning(false);
    }
  }, [form.student_id, form.exam_type, existingExams]);

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
    if (!form.student_id) {
      toast({ title: 'تنبيه', description: 'اختر الطالبة', variant: 'destructive' });
      return;
    }
    if (duplicateWarning) {
      toast({ title: 'تنبيه', description: 'هذه الطالبة أدت هذا الاختبار مسبقاً', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('exams').insert({
      student_id: form.student_id,
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
        toast({ title: 'تنبيه', description: 'هذه الطالبة أدت هذا الاختبار مسبقاً', variant: 'destructive' });
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
  const coverage = useMemo(() => {
    const byStudent = new Map<string, Record<string, Exam>>();
    exams.forEach(e => {
      if (!byStudent.has(e.student_id)) byStudent.set(e.student_id, {});
      byStudent.get(e.student_id)![e.exam_type] = e;
    });
    return students
      .filter(s => !coverageCircle || s.circle_id === coverageCircle)
      .map(s => ({
        id: s.id,
        full_name: s.full_name,
        circle_name: circleName(s.circle_id),
        types: byStudent.get(s.id) ?? {},
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, exams, coverageCircle, circles]);
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

  // Pagination — coverage tab and log tab paginate independently.
  const PAGE_SIZE = 25;
  const [covPage, setCovPage] = useState(1);
  const covPageCount = Math.max(1, Math.ceil(sortedCoverage.length / PAGE_SIZE));
  const covSafePage = Math.min(covPage, covPageCount);
  useEffect(() => { setCovPage(1); }, [coverageCircle, sortKey, sortDir]);
  const pagedCoverage = sortedCoverage.slice((covSafePage - 1) * PAGE_SIZE, covSafePage * PAGE_SIZE);

  const [logPage, setLogPage] = useState(1);
  const logPageCount = Math.max(1, Math.ceil(sortedExams.length / PAGE_SIZE));
  const logSafePage = Math.min(logPage, logPageCount);
  useEffect(() => { setLogPage(1); }, [sortKey, sortDir]);
  const pagedExams = sortedExams.slice((logSafePage - 1) * PAGE_SIZE, logSafePage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">الاختبارات</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل وعرض اختبارات التسميع</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={exams} columns={examCsvColumns} tableName="exams" filename="exams" onImportComplete={fetchData} />
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
              <Label>الطالبة</Label>
              <SearchableSelect
                options={students.map(s => ({ value: s.id, label: s.full_name }))}
                value={form.student_id}
                onValueChange={v => setForm(f => ({ ...f, student_id: v }))}
                placeholder="اختر الطالبة"
                searchPlaceholder="ابحث عن طالبة..."
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
              <SearchableSelect
                className="w-56"
                options={[{ value: '', label: 'كل الحلقات' }, ...circles.map(c => ({ value: c.id, label: c.circle_name }))]}
                value={coverageCircle} onValueChange={setCoverageCircle}
                placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة..." allowClear />
              <div className="flex gap-2 flex-wrap">
                {newExamTypes.map(t => (
                  <Badge key={t} variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    {examTypes[t]} — لم تُختبر: {missingCount(t)}
                  </Badge>
                ))}
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
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{r.circle_name}</TableCell>
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
              <TablePagination page={covSafePage} pageSize={PAGE_SIZE} total={coverage.length} onPageChange={setCovPage} />
            </Card>
          </TabsContent>

          <TabsContent value="log">
            {exams.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileCheck size={40} className="text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">لا توجد اختبارات بعد</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="الطالبة" sortKey="student" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="النوع" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="التاريخ" sortKey="date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="الأخطاء" sortKey="errors" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="الدرجة" sortKey="score" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="المختبرة" sortKey="examiner" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <TableHead className="text-right">سجّلها</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedExams.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.students?.full_name}</TableCell>
                        <TableCell><Badge variant="outline">{examTypes[e.exam_type]}</Badge></TableCell>
                        <TableCell dir="ltr" className="text-right">{e.date}</TableCell>
                        <TableCell>{e.total_errors}</TableCell>
                        <TableCell className={getScoreColor(e.total_score, e.max_score)}>
                          <span className="font-bold">{e.total_score}</span>
                          <span className="text-xs text-muted-foreground"> / {e.max_score}</span>
                        </TableCell>
                        <TableCell>{e.examiner_name || '-'}</TableCell>
                        <TableCell className="text-sm">{e.recorded_by || e.examiner_name || '-'}</TableCell>
                      </TableRow>
                    ))}
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
