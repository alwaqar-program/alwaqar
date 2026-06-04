import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, Search, UserPlus, Filter, Pencil, Trash2, Download } from 'lucide-react';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Applicant, ApplicantStatus, AgeCategory, Branch,
  STATUS_AR, AGE_AR, BRANCH_AR, statusVariant,
} from '@/lib/applicant-labels';
import ApplicantFormDialog from '@/components/applicants/ApplicantFormDialog';
import DeleteApplicantDialog from '@/components/applicants/DeleteApplicantDialog';

const PAGE_SIZE = 25;

const APPLICANT_CSV_COLUMNS: CsvColumnDef[] = [
  { key: 'submission_number', header: 'رقم الطلب' },
  { key: 'full_name', header: 'الاسم الرباعي' },
  { key: 'national_id', header: 'رقم الهوية' },
  { key: 'nationality', header: 'الجنسية' },
  { key: 'date_of_birth', header: 'تاريخ الميلاد' },
  { key: 'age', header: 'العمر' },
  { key: 'age_category', header: 'الفئة العمرية', transform: (v) =>
    v === 'under_16' ? 'أقل من 16' : v === '16_to_35' ? '16 - 35' : v === 'over_35' ? 'أعلى من 35' : '' },
  { key: 'phone', header: 'الجوال' },
  { key: 'guardian_phone', header: 'جوال ولي الأمر' },
  { key: 'email', header: 'البريد الإلكتروني' },
  { key: 'city', header: 'المدينة' },
  { key: 'qualification', header: 'المؤهل' },
  { key: 'institute_name', header: 'المعهد' },
  { key: 'memorized_juz_count', header: 'الأجزاء المحفوظة' },
  { key: 'from_surah', header: 'من سورة' },
  { key: 'to_surah', header: 'إلى سورة' },
  { key: 'desired_branch', header: 'الفرع المراد', transform: (v) =>
    ({ '5_juz': '5 أجزاء', '10_juz': '10 أجزاء', '20_juz': '20 جزء', '30_juz': '30 جزء' } as Record<string, string>)[v] ?? '' },
  { key: 'previously_joined', header: 'سبق الالتحاق', transform: (v) => v === true ? 'نعم' : v === false ? 'لا' : '' },
  { key: 'has_chronic_illness', header: 'مرض مزمن', transform: (v) => v === true ? 'نعم' : v === false ? 'لا' : '' },
  { key: 'has_companions', header: 'معها مرافقات', transform: (v) => v === true ? 'نعم' : v === false ? 'لا' : '' },
  { key: 'status', header: 'الحالة', transform: (v) => STATUS_AR[v as ApplicantStatus] ?? v },
  { key: 'notes', header: 'ملاحظات' },
];

export default function ApplicantsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicantStatus | 'all'>('all');
  const [ageFilter, setAgeFilter] = useState<AgeCategory | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<Branch | 'all'>('all');
  const [page, setPage] = useState(1);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Applicant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Applicant | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('applicants')
      .select('*')
      .order('submission_number', { ascending: false });
    if (error) {
      toast({
        title: 'تعذّر تحميل المتقدمات',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setData(data as Applicant[]);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return data.filter((r) => {
      // Hide deleted unless filter explicitly selects them
      if (statusFilter === 'all' && r.status === 'deleted') return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (ageFilter !== 'all' && r.age_category !== ageFilter) return false;
      if (branchFilter !== 'all' && r.desired_branch !== branchFilter) return false;
      if (search) {
        const q = search.trim().toLowerCase();
        const hay = `${r.full_name || ''} ${r.national_id || ''} ${r.phone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, ageFilter, branchFilter]);

  const deletedCount = data.filter((r) => r.status === 'deleted').length;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, ageFilter, branchFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display">المتقدمات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة طلبات الانضمام لدورة الوقار</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => exportToCsv(filtered, APPLICANT_CSV_COLUMNS, 'متقدمات')}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Download size={16} />
            تصدير CSV ({filtered.length})
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <UserPlus size={18} />
            إضافة متقدمة
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-2">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder="بحث بالاسم أو الهوية أو الجوال…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ApplicantStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات (عدا المحذوفة)</SelectItem>
                {Object.entries(STATUS_AR).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <Select value={ageFilter} onValueChange={(v) => setAgeFilter(v as AgeCategory | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="الفئة العمرية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأعمار</SelectItem>
                  {Object.entries(AGE_AR).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={branchFilter} onValueChange={(v) => setBranchFilter(v as Branch | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="الفرع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفروع</SelectItem>
                  {Object.entries(BRANCH_AR).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-3 flex items-center gap-2 flex-wrap">
            <Filter size={12} />
            عرض {filtered.length} من إجمالي {data.length}
            {deletedCount > 0 && statusFilter === 'all' && (
              <span className="text-rose-600">
                ({deletedCount} محذوفة مخفية — استخدم فلتر الحالة لإظهارها)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">جارٍ التحميل…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد نتائج</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الهوية</TableHead>
                    <TableHead className="text-right">الجوال</TableHead>
                    <TableHead className="text-right">المدينة</TableHead>
                    <TableHead className="text-right">الفئة العمرية</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الأجزاء</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right w-[150px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${r.status === 'deleted' ? 'opacity-60' : ''}`}
                      onClick={() => navigate(`/applicants/${r.id}`)}
                    >
                      <TableCell className="font-medium">{r.full_name || '—'}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.national_id || '—'}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.phone || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.city || '—'}</TableCell>
                      <TableCell>
                        {r.age_category ? (
                          <Badge variant="outline">{AGE_AR[r.age_category]}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {r.desired_branch ? (
                          <Badge variant="outline">{BRANCH_AR[r.desired_branch]}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.memorized_juz_count ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{STATUS_AR[r.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/applicants/${r.id}`)} title="عرض">
                            <Eye size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditTarget(r)} title="تعديل">
                            <Pencil size={14} />
                          </Button>
                          {r.status !== 'deleted' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(r)}
                              title="حذف"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground tabular-nums">
                صفحة {page} من {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ApplicantFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => loadData()}
      />
      <ApplicantFormDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        applicant={editTarget ?? undefined}
        onSaved={() => { loadData(); setEditTarget(null); }}
      />
      {deleteTarget && (
        <DeleteApplicantDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          applicantId={deleteTarget.id}
          applicantName={deleteTarget.full_name ?? '—'}
          onDeleted={() => { loadData(); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
