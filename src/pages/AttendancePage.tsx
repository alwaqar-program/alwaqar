import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { ClipboardCheck, Save, Download, Plus } from 'lucide-react';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';
import { Cohort, COHORTS, cohortLabel, COHORT_PLURAL, cohortSubjectColumn, subjectPayload } from '@/lib/cohorts';

const statusLabels: Record<string, string> = {
  present: 'حاضرة', absent: 'غائبة', late: 'متأخرة', excused: 'مستأذنة', exempted: 'معذورة',
};
const statusColors: Record<string, string> = {
  present: 'bg-success/10 text-success border-success/20',
  absent: 'bg-destructive/10 text-destructive border-destructive/20',
  late: 'bg-warning/10 text-warning border-warning/20',
  excused: 'bg-info/10 text-info border-info/20',
  exempted: 'bg-accent/15 text-accent-foreground border-accent/30',
};
const lateReasons = [
  { value: 'illness', label: 'مرض' },
  { value: 'transport', label: 'مواصلات' },
  { value: 'sleep', label: 'نوم' },
  { value: 'other', label: 'أخرى' },
];
const lateReasonLabel = (r: string | null, other: string | null) =>
  r === 'other' ? (other || 'أخرى') : (lateReasons.find(x => x.value === r)?.label ?? '');

const overviewCsvColumns: CsvColumnDef[] = [
  { key: 'full_name', header: 'الطالبة' },
  { key: 'circle_name', header: 'الحلقة' },
  { key: 'status_label', header: 'الحالة' },
  { key: 'reason', header: 'السبب' },
  { key: 'recorded_by', header: 'سجّلها' },
];

interface Person { id: string; full_name: string; circle_id: string | null; kind: Cohort; }
interface Circle { id: string; circle_name: string; }
interface AttRow {
  student_id: string | null; companion_id: string | null; beginner_id: string | null;
  status: string; period: string;
  late_reason: string | null; late_reason_other: string | null; recorded_by: string | null;
}
interface Entry { student_id: string; status: string; late_reason: string; late_reason_other: string; }

export default function AttendancePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  // من أدخل السجل — يظهر في اللوق أنه مدير النظام
  const adminName = user?.email ? `مدير النظام (${user.email})` : 'مدير النظام';

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState('morning');
  const [filterCircle, setFilterCircle] = useState('');
  const [filterCohort, setFilterCohort] = useState<'' | Cohort>('');
  const [search, setSearch] = useState('');

  const [people, setPeople] = useState<Person[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ----- Entry dialog (إدخال تحضير) -----
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryCohort, setEntryCohort] = useState<Cohort>('student');
  const [entryCircle, setEntryCircle] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadStatic = async () => {
      const [stRes, coRes, beRes, cRes] = await Promise.all([
        supabase.from('students').select('id, full_name, circle_id, is_active').eq('is_active', true).order('full_name'),
        supabase.from('companions').select('id, full_name, circle_id, is_active').order('full_name'),
        supabase.from('beginners').select('id, full_name, circle_id, is_active').order('full_name'),
        supabase.from('circles').select('id, circle_name').eq('is_active', true),
      ]);
      if (stRes.error) toast({ title: 'خطأ', description: stRes.error.message, variant: 'destructive' });
      const merge = (rows: any[] | null, kind: Cohort): Person[] =>
        (rows || []).filter(r => r.is_active !== false)
          .map(r => ({ id: r.id, full_name: r.full_name, circle_id: r.circle_id, kind }));
      setPeople([
        ...merge(stRes.data, 'student'),
        ...merge(coRes.data, 'companion'),
        ...merge(beRes.data, 'beginner'),
      ]);
      setCircles(cRes.data || []);
    };
    loadStatic();
  }, [toast]);

  const loadDay = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, companion_id, beginner_id, status, period, late_reason, late_reason_other, recorded_by')
      .eq('date', date)
      .eq('is_deleted', false);
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    setAttRows(data || []);
    setLoading(false);
  };
  useEffect(() => { loadDay(); }, [date]); // eslint-disable-line

  const circleName = (id: string | null) => circles.find(c => c.id === id)?.circle_name || '-';
  const attFor = (p: Person) =>
    attRows.find(a => (a as any)[cohortSubjectColumn(p.kind)] === p.id && a.period === period);

  // Overview rows: every person (filtered) with her status for date+period.
  const overview = useMemo(() => {
    return people
      .filter(p => !filterCohort || p.kind === filterCohort)
      .filter(p => !filterCircle || p.circle_id === filterCircle)
      .filter(p => !search || p.full_name.includes(search))
      .map(p => {
        const a = attFor(p);
        return {
          id: p.id,
          kind: p.kind,
          kind_label: cohortLabel(p.kind),
          full_name: p.full_name,
          circle_name: circleName(p.circle_id),
          status: a?.status ?? null,
          status_label: a ? (statusLabels[a.status] ?? a.status) : 'لم يُسجّل',
          reason: a?.status === 'late' ? lateReasonLabel(a.late_reason, a.late_reason_other) : '',
          recorded_by: a ? (a.recorded_by || '—') : '',
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, attRows, period, filterCircle, filterCohort, search, circles]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, exempted: 0, none: 0 };
    overview.forEach(r => {
      if (!r.status) c.none++;
      else (c as Record<string, number>)[r.status] = ((c as Record<string, number>)[r.status] || 0) + 1;
    });
    return c;
  }, [overview]);

  // Pagination for the overview table.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(overview.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  useEffect(() => { setPage(1); }, [date, period, filterCircle, filterCohort, search]);
  const pagedOverview = overview.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ----- Entry dialog logic -----
  const entryPeople = useMemo(
    () => people.filter(p => p.kind === entryCohort && p.circle_id === entryCircle),
    [people, entryCohort, entryCircle],
  );

  useEffect(() => {
    // Prepare defaults for people without a record this date+period.
    const next: Record<string, Entry> = {};
    entryPeople.forEach(p => {
      if (!attFor(p)) next[p.id] = { student_id: p.id, status: 'present', late_reason: '', late_reason_other: '' };
    });
    setEntries(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryCohort, entryCircle, entryPeople, attRows, period]);

  const updateEntry = (studentId: string, field: keyof Entry, value: string) =>
    setEntries(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));

  const handleSaveEntries = async () => {
    const toInsert = Object.values(entries);
    if (toInsert.length === 0) {
      toast({ title: 'تنبيه', description: 'كل طالبات هذه الحلقة مسجّلات لهذه الفترة' });
      return;
    }
    for (const e of toInsert) {
      if (e.status === 'late' && !e.late_reason) {
        toast({ title: 'تنبيه', description: 'سبب التأخير مطلوب لكل طالبة متأخرة', variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from('attendance').insert(
      toInsert.map(e => ({
        ...subjectPayload(entryCohort, e.student_id), // e.student_id holds the person id
        date,
        period,
        status: e.status,
        late_reason: e.status === 'late' ? e.late_reason : null,
        late_reason_other: e.status === 'late' && e.late_reason === 'other' ? e.late_reason_other : null,
        recorded_by: adminName, // اللوق: أدخلها مدير النظام
      }))
    );
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `تم تسجيل حضور ${toInsert.length} طالبة` });
      setEntryOpen(false);
      loadDay();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display text-foreground">الحضور</h1>
          <p className="text-sm text-muted-foreground mt-1">استعراض الحضور المسجّل لكل الحلقات — ومن سجّله</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() =>
            exportToCsv(overview, overviewCsvColumns, `attendance_${date}_${period}`)
          }>
            <Download size={14} /> تصدير CSV
          </Button>
          <Button onClick={() => { setEntryCohort('student'); setEntryCircle(''); setEntryOpen(true); }}>
            <Plus size={18} /> إدخال تحضير
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
          <div className="space-y-1.5 min-w-[180px]">
            <Label className="text-xs">الحلقة</Label>
            <SearchableSelect
              options={[{ value: '', label: 'كل الحلقات' }, ...circles.map(c => ({ value: c.id, label: c.circle_name }))]}
              value={filterCircle} onValueChange={setFilterCircle}
              placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة..." allowClear />
          </div>
          <div className="space-y-1.5 min-w-[180px] flex-1 max-w-xs">
            <Label className="text-xs">بحث</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="اسم الطالبة..." />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className={statusColors.present}>حاضرة: {counts.present}</Badge>
        <Badge variant="outline" className={statusColors.absent}>غائبة: {counts.absent}</Badge>
        <Badge variant="outline" className={statusColors.late}>متأخرة: {counts.late}</Badge>
        <Badge variant="outline" className={statusColors.excused}>مستأذنة: {counts.excused}</Badge>
        <Badge variant="outline" className={statusColors.exempted}>معذورة: {counts.exempted}</Badge>
        <Badge variant="outline">لم يُسجّل: {counts.none}</Badge>
      </div>

      {/* Overview table */}
      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : overview.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد طالبات مطابقات</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالبة</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>الحلقة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>سجّلها</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedOverview.map(r => (
                <TableRow key={r.id} className={!r.status ? 'bg-muted/20' : ''}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>
                    {r.kind !== 'student' && <Badge variant="secondary">{r.kind_label}</Badge>}
                  </TableCell>
                  <TableCell>{r.circle_name}</TableCell>
                  <TableCell>
                    {r.status
                      ? <Badge variant="outline" className={statusColors[r.status] || ''}>{r.status_label}</Badge>
                      : <span className="text-muted-foreground text-sm">لم يُسجّل</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.reason || '-'}</TableCell>
                  <TableCell className="text-sm">{r.recorded_by || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={safePage} pageSize={PAGE_SIZE} total={overview.length} onPageChange={setPage} />
        </Card>
      )}

      {/* إدخال تحضير */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              إدخال تحضير — {date} ({period === 'morning' ? 'صباحي' : 'مسائي'})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>الفئة</Label>
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {COHORTS.map(k => (
                  <button key={k} type="button" onClick={() => setEntryCohort(k)}
                    className={`flex-1 px-3 h-10 transition-colors ${entryCohort === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    {COHORT_PLURAL[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>الحلقة</Label>
              <SearchableSelect
                options={circles.map(c => ({ value: c.id, label: c.circle_name }))}
                value={entryCircle} onValueChange={setEntryCircle}
                placeholder="اختر الحلقة" searchPlaceholder="ابحث عن حلقة..." />
            </div>

            {entryCircle && Object.keys(entries).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                كل طالبات هذه الحلقة مسجّلات لهذه الفترة
              </p>
            )}

            {entryCircle && Object.keys(entries).length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">
                  تظهر فقط الطالبات غير المسجّلات لهذا اليوم والفترة. سيُسجَّل في اللوق أن المدخِل: {adminName}
                </p>
                <div className="space-y-3">
                  {entryPeople.filter(s => entries[s.id]).map(s => {
                    const entry = entries[s.id];
                    return (
                      <div key={s.id} className="p-3 rounded-lg border space-y-2">
                        <span className="font-medium text-sm">{s.full_name}</span>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <button key={value} onClick={() => updateEntry(s.id, 'status', value)}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                entry.status === value ? statusColors[value] + ' border-current' : 'bg-background border-border hover:bg-muted'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {entry.status === 'late' && (
                          <div className="flex gap-2 pt-1">
                            <SearchableSelect className="h-8 text-xs w-32" options={lateReasons}
                              value={entry.late_reason} onValueChange={v => updateEntry(s.id, 'late_reason', v)}
                              placeholder="السبب" searchPlaceholder="ابحث..." />
                            {entry.late_reason === 'other' && (
                              <Input className="h-8 text-xs" placeholder="حدد السبب" value={entry.late_reason_other}
                                onChange={e => updateEntry(s.id, 'late_reason_other', e.target.value)} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button onClick={handleSaveEntries} disabled={saving} className="w-full">
                  <Save size={18} /> {saving ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
