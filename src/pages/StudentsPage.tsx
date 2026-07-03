import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Users, Search, Trash2, X, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { useUrlMultiFilter } from '@/lib/use-url-multi-filter';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import { SURAHS } from '@/lib/quran-verses';
import { HOUSING_AR, HousingAnswer } from '@/lib/interview-types';

// نوع السكن مطابق لإجابة المقابلة (تقبل السكن المشترك / لا تقبل / معها مرافقات).
const housingOptions = (Object.keys(HOUSING_AR) as HousingAnswer[]).map(k => ({ value: k, label: HOUSING_AR[k] }));
const housingLabel = (v: string | null | undefined) =>
  v && HOUSING_AR[v as HousingAnswer] ? HOUSING_AR[v as HousingAnswer] : 'غير محدد';
const housingFromLabel = (s: string) =>
  (Object.keys(HOUSING_AR) as HousingAnswer[]).find(k => HOUSING_AR[k] === s?.trim()) ?? null;

const studentCsvColumns: CsvColumnDef[] = [
  { key: 'full_name', header: 'الاسم الكامل' },
  { key: 'national_id', header: 'رقم الهوية' },
  { key: 'phone', header: 'الهاتف' },
  { key: 'email', header: 'البريد الإلكتروني' },
  { key: 'guardian_phone', header: 'هاتف ولي الأمر' },
  { key: 'nationality', header: 'الجنسية' },
  { key: 'qualification', header: 'المؤهل' },
  { key: 'housing_type', header: 'نوع السكن', transform: housingLabel, importTransform: housingFromLabel },
  { key: 'admission_status', header: 'حالة القبول' },
];

interface Student {
  id: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  admission_status: string;
  circle_id: string | null;
  housing_type: string | null;
  is_active: boolean;
  email: string | null;
  guardian_phone: string | null;
  nationality: string | null;
  qualification: string | null;
  from_surah: string | null; // نطاق حفظ الطالبة (من ملف المتقدمة)
  to_surah: string | null;
  circles?: { circle_name: string; branch_id: string; branches?: { branch_name: string; id: string } | null } | null;
}

const statusLabels: Record<string, string> = {
  candidate: 'مرشحة',
  interview_scheduled: 'مقابلة مجدولة',
  preliminary_accepted: 'قبول مبدئي',
  preliminary_evaluation: 'تقييم مبدئي',
  conditionally_accepted: 'مقبولة مشروطة',
  on_hold: 'معلقة',
  final_accepted: 'قبول نهائي',
  final_evaluation: 'تقييم نهائي',
  registered: 'مسجلة',
  withdrawn: 'منسحبة',
  expelled: 'مفصولة',
  rejected: 'مرفوضة',
};

const statusColors: Record<string, string> = {
  registered: 'bg-success/10 text-success border-success/20',
  candidate: 'bg-info/10 text-info border-info/20',
  withdrawn: 'bg-destructive/10 text-destructive border-destructive/20',
  expelled: 'bg-destructive/10 text-destructive border-destructive/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [circles, setCircles] = useState<{ id: string; circle_name: string; branch_id: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCircle, setFilterCircle] = useUrlMultiFilter('circle');
  const [filterBranch, setFilterBranch] = useUrlMultiFilter('branch');
  const [filterStatus, setFilterStatus] = useUrlMultiFilter('status');
  const [filterHousing, setFilterHousing] = useUrlMultiFilter('housing');

  const [form, setForm] = useState({
    full_name: '', national_id: '', phone: '', circle_id: '', housing_type: '',
    admission_status: 'candidate', email: '', guardian_phone: '', nationality: '', qualification: '',
    from_surah: '', to_surah: '',
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    const [sRes, cRes, bRes] = await Promise.all([
      supabase.from('students').select('*, circles(circle_name, branch_id, branches(branch_name, id))').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('circles').select('id, circle_name, branch_id').eq('is_active', true),
      supabase.from('branches').select('id, branch_name').eq('is_active', true),
    ]);
    setStudents(sRes.data || []);
    setCircles(cRes.data || []);
    setBranches(bRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (searchQuery && !s.full_name.includes(searchQuery) && !s.national_id?.includes(searchQuery) && !s.phone?.includes(searchQuery)) return false;
      if (filterCircle.length > 0 && !filterCircle.includes(s.circle_id ?? '')) return false;
      if (filterBranch.length > 0 && !filterBranch.includes(s.circles?.branches?.id ?? '')) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(s.admission_status ?? '')) return false;
      if (filterHousing.length > 0 && !filterHousing.includes(s.housing_type ?? '')) return false;
      return true;
    });
  }, [students, searchQuery, filterCircle, filterBranch, filterStatus, filterHousing]);

  const hasActiveFilters =
    !!searchQuery ||
    filterCircle.length > 0 ||
    filterBranch.length > 0 ||
    filterStatus.length > 0 ||
    filterHousing.length > 0;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCircle([]);
    setFilterBranch([]);
    setFilterStatus([]);
    setFilterHousing([]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', national_id: '', phone: '', circle_id: '', housing_type: '', admission_status: 'candidate', email: '', guardian_phone: '', nationality: '', qualification: '', from_surah: '', to_surah: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({
      full_name: s.full_name, national_id: s.national_id || '', phone: s.phone || '',
      circle_id: s.circle_id || '', housing_type: s.housing_type || '',
      admission_status: s.admission_status, email: s.email || '',
      guardian_phone: s.guardian_phone || '', nationality: s.nationality || '',
      qualification: s.qualification || '',
      from_surah: s.from_surah || '', to_surah: s.to_surah || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    // نطاق الحفظ: إن تُرك فارغاً عند إنشاء طالبة جديدة، يُجلب تلقائياً من
    // ملف المتقدمة المطابق برقم الهوية (اختيارها عند التسجيل).
    let fromSurah = form.from_surah || null;
    let toSurah = form.to_surah || null;
    if (!editing && !fromSurah && !toSurah && form.national_id) {
      // applicants is not in the generated types (same cast as InterviewPage)
      const { data: app } = await (supabase as any)
        .from('applicants')
        .select('from_surah, to_surah')
        .eq('national_id', form.national_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1);
      if (app?.[0]) { fromSurah = app[0].from_surah; toSurah = app[0].to_surah; }
    }
    const payload = {
      full_name: form.full_name, national_id: form.national_id || null,
      phone: form.phone || null, circle_id: form.circle_id || null,
      housing_type: form.housing_type || null, admission_status: form.admission_status,
      email: form.email || null, guardian_phone: form.guardian_phone || null,
      nationality: form.nationality || null, qualification: form.qualification || null,
      from_surah: fromSurah, to_surah: toSurah,
    };
    if (editing) {
      const { error } = await supabase.from('students').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('students').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: editing ? 'تم التحديث' : 'تم الإضافة' });
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('students').update({ is_active: false }).eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم حذف الطالبة بنجاح' });
      fetchData();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedStudents = useMemo(() => {
    const acc: Record<string, (s: Student) => unknown> = {
      name: (s) => s.full_name,
      circle: (s) => s.circles?.circle_name,
      branch: (s) => s.circles?.branches?.branch_name,
      status: (s) => statusLabels[s.admission_status] || s.admission_status,
      housing: (s) => housingLabel(s.housing_type),
    };
    if (!sortKey || !acc[sortKey]) return filteredStudents;
    return sortRows(filteredStudents, acc[sortKey], sortDir, 'text');
  }, [filteredStudents, sortKey, sortDir]);

  // Pagination (client-side)
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(sortedStudents.length / PAGE_SIZE));
  // Back to page 1 whenever the visible set changes (filters/search/sort).
  useEffect(() => { setPage(1); }, [searchQuery, filterCircle, filterBranch, filterStatus, filterHousing, sortKey, sortDir]);
  const safePage = Math.min(page, pageCount);
  const pagedStudents = useMemo(
    () => sortedStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedStudents, safePage],
  );

  // Options for searchable selects
  const circleOptions = circles.map(c => ({ value: c.id, label: c.circle_name }));
  const branchOptions = branches.map(b => ({ value: b.id, label: b.branch_name }));
  const statusOptions = Object.entries(statusLabels).map(([k, v]) => ({ value: k, label: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة الطالبات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? `عرض ${filteredStudents.length} من ${students.length} طالبة`
              : `${students.length} طالبة`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={students} columns={studentCsvColumns} tableName="students" filename="students" onImportComplete={fetchData} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2"><Plus size={18} /> إضافة طالبة</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? 'تعديل بيانات الطالبة' : 'إضافة طالبة جديدة'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>رقم الهوية</Label>
                  <Input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الهاتف</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>هاتف ولي الأمر</Label>
                  <Input value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الجنسية</Label>
                  <Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>المؤهل</Label>
                  <Input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الحلقة</Label>
                  <SearchableSelect
                    options={circleOptions}
                    value={form.circle_id}
                    onValueChange={v => setForm(f => ({ ...f, circle_id: v }))}
                    placeholder="اختر الحلقة"
                    searchPlaceholder="ابحث عن حلقة..."
                    allowClear
                  />
                </div>
                <div className="space-y-2">
                  <Label>نوع السكن</Label>
                  <SearchableSelect
                    options={housingOptions}
                    value={form.housing_type}
                    onValueChange={v => setForm(f => ({ ...f, housing_type: v }))}
                    placeholder="نوع السكن"
                    searchPlaceholder="ابحث..."
                    allowClear
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>من سورة (نطاق التسميع)</Label>
                  <SearchableSelect
                    options={SURAHS.map(s => ({ value: s.name, label: s.name }))}
                    value={form.from_surah}
                    onValueChange={v => setForm(f => ({ ...f, from_surah: v }))}
                    placeholder="تُجلب من ملف المتقدمة إن تُركت"
                    searchPlaceholder="ابحث عن سورة..."
                    allowClear
                  />
                </div>
                <div className="space-y-2">
                  <Label>إلى سورة (نطاق التسميع)</Label>
                  <SearchableSelect
                    options={SURAHS.map(s => ({ value: s.name, label: s.name }))}
                    value={form.to_surah}
                    onValueChange={v => setForm(f => ({ ...f, to_surah: v }))}
                    placeholder="تُجلب من ملف المتقدمة إن تُركت"
                    searchPlaceholder="ابحث عن سورة..."
                    allowClear
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>حالة القبول</Label>
                <SearchableSelect
                  options={statusOptions}
                  value={form.admission_status}
                  onValueChange={v => setForm(f => ({ ...f, admission_status: v || 'candidate' }))}
                  placeholder="اختر الحالة"
                  searchPlaceholder="ابحث عن حالة..."
                />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'حفظ' : 'إضافة'}</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهوية أو الهاتف..."
                className="pr-9"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground shrink-0">
                <X size={14} />
                مسح الفلاتر
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MultiSearchableSelect
              options={branchOptions}
              values={filterBranch}
              onValuesChange={setFilterBranch}
              placeholder="كل الفروع"
              searchPlaceholder="ابحث عن فرع..."
            />
            <MultiSearchableSelect
              options={circleOptions}
              values={filterCircle}
              onValuesChange={setFilterCircle}
              placeholder="كل الحلقات"
              searchPlaceholder="ابحث عن حلقة..."
            />
            <MultiSearchableSelect
              options={statusOptions}
              values={filterStatus}
              onValuesChange={setFilterStatus}
              placeholder="كل الحالات"
              searchPlaceholder="ابحث عن حالة..."
            />
            <MultiSearchableSelect
              options={housingOptions}
              values={filterHousing}
              onValuesChange={setFilterHousing}
              placeholder="كل أنواع السكن"
              searchPlaceholder="ابحث..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : filteredStudents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {hasActiveFilters ? 'لا توجد نتائج مطابقة للفلاتر' : 'لا توجد طالبات بعد'}
            </p>
            {hasActiveFilters && (
              <Button variant="link" onClick={clearFilters} className="mt-2">مسح الفلاتر</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="الاسم" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="الحلقة" sortKey="circle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="الفرع" sortKey="branch" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="حالة القبول" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="السكن" sortKey="housing" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedStudents.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/students/${s.id}`)}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>{s.circles?.circle_name || '-'}</TableCell>
                    <TableCell>{s.circles?.branches?.branch_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[s.admission_status] || ''}>
                        {statusLabels[s.admission_status] || s.admission_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{housingLabel(s.housing_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-muted-foreground">
                عرض {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedStudents.length)} من {sortedStudents.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  السابق
                </Button>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === pageCount || Math.abs(n - safePage) <= 2)
                  .map((n, idx, arr) => (
                    <span key={n} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-muted-foreground">…</span>}
                      <Button
                        variant={n === safePage ? 'default' : 'ghost'}
                        size="sm"
                        className="w-8 px-0"
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </Button>
                    </span>
                  ))}
                <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>
                  التالي
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">تأكيد حذف الطالبة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الطالبة <strong>{deleteTarget?.full_name}</strong>؟ سيتم إلغاء تفعيل حسابها ولن تظهر في القوائم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'جارٍ الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
