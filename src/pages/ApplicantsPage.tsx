import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useScrollRestoration } from '@/lib/use-scroll-restoration';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, Search, UserPlus, Filter, Pencil, Trash2, Download } from 'lucide-react';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows, SortType } from '@/lib/use-table-sort';
import {
  Applicant, ApplicantStatus, AgeCategory, Branch,
  STATUS_AR, AGE_AR, BRANCH_AR, statusVariant,
} from '@/lib/applicant-labels';
import { getPaymentState, PAYMENT_STATE_AR, PaymentState, isPayableStatus } from '@/lib/payment-actions';
import { HousingAnswer } from '@/lib/interview-types';
import ApplicantFormDialog from '@/components/applicants/ApplicantFormDialog';
import DeleteApplicantDialog from '@/components/applicants/DeleteApplicantDialog';

const PAGE_SIZE = 25;

// Collator for sorting Arabic names alphabetically (أ، ب، ت …).
const arabicCollator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

// Short labels shown in the السكن المشترك column.
const HOUSING_SHORT_AR: Record<HousingAnswer, string> = {
  shared: 'مشترك',           // تقبل السكن المشترك
  private: 'خاص',            // لا تقبل السكن المشترك
  with_companions: 'خاص بالوقار', // معها مرافقات
};

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
  { key: 'acceptance_reasons', header: 'مبررات القبول' },
  { key: 'rejection_reasons', header: 'مبررات الرفض' },
  { key: 'registered_at', header: 'تاريخ التسجيل', transform: (v) => v ? new Date(v).toISOString().slice(0, 10) : '' },
  { key: 'notes', header: 'ملاحظات' },
];

export default function ApplicantsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Pagination state lives in the URL so going back from the detail page
  // restores the exact page the user was on.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const setPage = (newPage: number) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (newPage <= 1) p.delete('page');
      else p.set('page', String(newPage));
      return p;
    });
  };

  const { saveScroll, attemptRestore } = useScrollRestoration('applicants');

  const [data, setData] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  // السكن المشترك is recorded on the interview, not the applicant row, so we
  // load interviews separately and map the latest answer to each applicant.
  const [housingByApplicant, setHousingByApplicant] = useState<Record<string, HousingAnswer>>({});

  // Filters live in the URL (like `page`) so returning from a detail page
  // restores the exact filtered view — and therefore its saved scroll
  // position, since the scroll key is derived from the URL.
  const search = searchParams.get('q') ?? '';
  const statusFilter = (searchParams.get('status') as ApplicantStatus | 'all') || 'all';
  const ageFilter = (searchParams.get('age') as AgeCategory | 'all') || 'all';
  const branchFilter = (searchParams.get('branch') as Branch | 'all') || 'all';
  const paymentFilter = (searchParams.get('pay') as PaymentState | 'all') || 'all';

  // Update one filter param and reset back to the first page. Uses `replace`
  // so typing/filtering doesn't flood the browser history (a single Back
  // press from a detail page still returns to this filtered view).
  const setFilterParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (!value || value === 'all') p.delete(key);
      else p.set(key, value);
      p.delete('page');
      return p;
    }, { replace: true });
  };
  const setSearch = (v: string) => setFilterParam('q', v);
  const setStatusFilter = (v: ApplicantStatus | 'all') => setFilterParam('status', v);
  const setAgeFilter = (v: AgeCategory | 'all') => setFilterParam('age', v);
  const setBranchFilter = (v: Branch | 'all') => setFilterParam('branch', v);
  const setPaymentFilter = (v: PaymentState | 'all') => setFilterParam('pay', v);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Applicant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Applicant | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Restore scroll position once the data has been rendered.
  useEffect(() => {
    if (!loading) attemptRestore();
  }, [loading, attemptRestore]);

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

    // Load the shared-housing answer for each applicant from their interview.
    // Ordered oldest→newest so the last write into the map wins (latest answer).
    const { data: interviews } = await (supabase as any)
      .from('interviews')
      .select('applicant_id, accepts_shared_housing, created_at')
      .order('created_at', { ascending: true });
    if (interviews) {
      const map: Record<string, HousingAnswer> = {};
      for (const iv of interviews as Array<{ applicant_id: string; accepts_shared_housing: HousingAnswer | null }>) {
        if (iv.applicant_id && iv.accepts_shared_housing) {
          map[iv.applicant_id] = iv.accepts_shared_housing;
        }
      }
      setHousingByApplicant(map);
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    return data
      .filter((r) => {
        // Hide deleted unless filter explicitly selects them
        if (statusFilter === 'all' && r.status === 'deleted') return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (ageFilter !== 'all' && r.age_category !== ageFilter) return false;
        if (branchFilter !== 'all' && r.desired_branch !== branchFilter) return false;
        if (paymentFilter !== 'all' && getPaymentState(r) !== paymentFilter) return false;
        if (search) {
          const q = search.trim().toLowerCase();
          const hay = `${r.full_name || ''} ${r.national_id || ''} ${r.phone || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      // Sort by name in Arabic alphabetical order; blank names go last.
      .sort((a, b) => {
        const an = (a.full_name || '').trim();
        const bn = (b.full_name || '').trim();
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return arabicCollator.compare(an, bn);
      });
  }, [data, search, statusFilter, ageFilter, branchFilter, paymentFilter]);

  // Column sorting (URL-persisted). When no column is chosen the default
  // Arabic-name order from `filtered` is kept.
  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const accessors: Record<string, (r: Applicant) => unknown> = {
      name: (r) => r.full_name,
      national_id: (r) => r.national_id,
      phone: (r) => r.phone,
      city: (r) => r.city,
      age: (r) => r.age,
      branch: (r) => (r.desired_branch ? parseInt(r.desired_branch, 10) : null),
      juz: (r) => r.memorized_juz_count,
      status: (r) => STATUS_AR[r.status],
      payment: (r) => PAYMENT_STATE_AR[getPaymentState(r)],
      housing: (r) => (housingByApplicant[r.id] ? HOUSING_SHORT_AR[housingByApplicant[r.id]] : ''),
    };
    const types: Record<string, SortType> = {
      age: 'number', branch: 'number', juz: 'number',
    };
    const acc = accessors[sortKey];
    if (!acc) return filtered;
    return sortRows(filtered, acc, sortDir, types[sortKey] ?? 'text');
  }, [filtered, sortKey, sortDir, housingByApplicant]);

  const deletedCount = data.filter((r) => r.status === 'deleted').length;

  // Statuses that actually occur in the data — the filter dropdown lists only
  // these (so an empty status never shows). The currently-selected status is
  // kept even if it has no rows, so the Select never shows a blank value.
  const presentStatuses = useMemo(() => {
    const s = new Set<ApplicantStatus>();
    for (const r of data) if (r.status) s.add(r.status);
    return s;
  }, [data]);

  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

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

            <SearchableSelect
              options={[
                { value: 'all', label: 'جميع الحالات (عدا المحذوفة)' },
                ...Object.entries(STATUS_AR)
                  .filter(([k]) => presentStatuses.has(k as ApplicantStatus) || statusFilter === k)
                  .map(([k, v]) => ({ value: k, label: v as string })),
              ]}
              value={statusFilter}
              onValueChange={(v) => setStatusFilter((v || 'all') as ApplicantStatus | 'all')}
              placeholder="الحالة"
              searchPlaceholder="ابحث..."
            />

            <div className="grid grid-cols-3 gap-2">
              <SearchableSelect
                options={[
                  { value: 'all', label: 'كل الأعمار' },
                  ...Object.entries(AGE_AR).map(([k, v]) => ({ value: k, label: v as string })),
                ]}
                value={ageFilter}
                onValueChange={(v) => setAgeFilter((v || 'all') as AgeCategory | 'all')}
                placeholder="الفئة العمرية"
                searchPlaceholder="ابحث..."
              />

              <SearchableSelect
                options={[
                  { value: 'all', label: 'كل الفروع' },
                  ...Object.entries(BRANCH_AR).map(([k, v]) => ({ value: k, label: v as string })),
                ]}
                value={branchFilter}
                onValueChange={(v) => setBranchFilter((v || 'all') as Branch | 'all')}
                placeholder="الفرع"
                searchPlaceholder="ابحث..."
              />

              <SearchableSelect
                options={[
                  { value: 'all', label: 'كل حالات السداد' },
                  ...Object.entries(PAYMENT_STATE_AR).map(([k, v]) => ({ value: k, label: v as string })),
                ]}
                value={paymentFilter}
                onValueChange={(v) => setPaymentFilter((v || 'all') as PaymentState | 'all')}
                placeholder="السداد"
                searchPlaceholder="ابحث..."
              />
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
                    {(() => {
                      const sp = { currentKey: sortKey, currentDir: sortDir, onSort: toggleSort };
                      return (
                        <>
                          <SortableHead label="الاسم" sortKey="name" {...sp} />
                          <SortableHead label="الهوية" sortKey="national_id" {...sp} />
                          <SortableHead label="الجوال" sortKey="phone" {...sp} />
                          <SortableHead label="المدينة" sortKey="city" {...sp} />
                          <SortableHead label="الفئة العمرية" sortKey="age" {...sp} />
                          <SortableHead label="الفرع" sortKey="branch" {...sp} />
                          <SortableHead label="الأجزاء" sortKey="juz" {...sp} />
                          <SortableHead label="الحالة" sortKey="status" {...sp} />
                          <SortableHead label="السداد" sortKey="payment" {...sp} />
                          <SortableHead label="السكن المشترك" sortKey="housing" {...sp} />
                          <TableHead className="text-right w-[150px]"></TableHead>
                        </>
                      );
                    })()}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${r.status === 'deleted' ? 'opacity-60' : ''}`}
                      onClick={() => { saveScroll(); navigate(`/applicants/${r.id}`); }}
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
                        {isPayableStatus(r.status) ? (
                          (() => {
                            const ps = getPaymentState(r);
                            if (ps === 'none') return <span className="text-muted-foreground text-xs">—</span>;
                            if (ps === 'pending_review')
                              return <Badge className="bg-amber-500 hover:bg-amber-500 whitespace-nowrap">{PAYMENT_STATE_AR.pending_review}</Badge>;
                            if (ps === 'verified')
                              return <Badge className="bg-emerald-600 hover:bg-emerald-600">{PAYMENT_STATE_AR.verified}</Badge>;
                            if (ps === 'special_waqar' || ps === 'special_non_waqar')
                              return <Badge className="bg-indigo-600 hover:bg-indigo-600 whitespace-nowrap">{PAYMENT_STATE_AR[ps]}</Badge>;
                            return <Badge variant="destructive" className="whitespace-nowrap">{PAYMENT_STATE_AR.receipt_rejected}</Badge>;
                          })()
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {housingByApplicant[r.id]
                          ? HOUSING_SHORT_AR[housingByApplicant[r.id]]
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => { saveScroll(); navigate(`/applicants/${r.id}`); }} title="عرض">
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
            <div className="border-t p-2">
              <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
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
