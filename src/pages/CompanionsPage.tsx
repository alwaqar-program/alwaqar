import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Search, X, HeartHandshake, Download } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';

// الفئة العمرية — 16_to_35 لا تظهر هنا (تلك تبقى طالبات)
const ageCategoryLabel: Record<string, string> = {
  under_16: 'أقل من 16',
  over_35: 'أكثر من 35',
};
const ageCategoryColor: Record<string, string> = {
  under_16: 'bg-info/10 text-info border-info/20',
  over_35: 'bg-accent/10 text-accent border-accent/20',
};
interface Companion {
  id: string;
  original_student_id: string | null;
  age_category: string | null;
  move_reason: string;
  moved_at: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  guardian_phone: string | null;
  nationality: string | null;
  circle_id: string | null;
}
interface Circle { id: string; circle_name: string; }

const csvColumns: CsvColumnDef[] = [
  { key: 'full_name', header: 'الاسم الكامل' },
  { key: 'national_id', header: 'رقم الهوية' },
  { key: 'phone', header: 'الهاتف' },
  { key: 'guardian_phone', header: 'هاتف ولي الأمر' },
  { key: 'nationality', header: 'الجنسية' },
  { key: 'circle_name', header: 'الحلقة' },
  { key: 'age_category_label', header: 'الفئة العمرية' },
];

export default function CompanionsPage() {
  const { toast } = useToast();
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    const load = async () => {
      // companions ليس ضمن الأنواع المولّدة — نفس نمط applicants في بقية الصفحات
      const [coRes, cRes] = await Promise.all([
        (supabase as any).from('companions')
          .select('id, original_student_id, age_category, move_reason, moved_at, full_name, national_id, phone, guardian_phone, nationality, circle_id')
          .order('moved_at', { ascending: false }),
        supabase.from('circles').select('id, circle_name'),
      ]);
      if (coRes.error) toast({ title: 'خطأ', description: coRes.error.message, variant: 'destructive' });
      setCompanions((coRes.data as Companion[]) || []);
      setCircles((cRes.data as Circle[]) || []);
      setLoading(false);
    };
    load();
  }, [toast]);

  const circleName = (id: string | null) => circles.find(c => c.id === id)?.circle_name || '-';

  const filtered = useMemo(() => companions.filter(c => {
    if (search && !c.full_name.includes(search) && !c.national_id?.includes(search) && !c.phone?.includes(search)) return false;
    if (filterCategory && (c.age_category ?? '') !== filterCategory) return false;
    return true;
  }), [companions, search, filterCategory]);

  const hasFilters = !!search || !!filterCategory;
  const clearFilters = () => { setSearch(''); setFilterCategory(''); };

  // Sortable columns (same behaviour as the students table).
  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sorted = useMemo(() => {
    const acc: Record<string, (c: Companion) => unknown> = {
      name: (c) => c.full_name,
      national_id: (c) => c.national_id,
      phone: (c) => c.phone,
      circle: (c) => circleName(c.circle_id),
      category: (c) => (c.age_category ? (ageCategoryLabel[c.age_category] ?? c.age_category) : ''),
    };
    if (!sortKey || !acc[sortKey]) return filtered;
    return sortRows(filtered, acc[sortKey], sortDir, 'text');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, circles]);

  // Pagination
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  useEffect(() => { setPage(1); }, [search, filterCategory, sortKey, sortDir]);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleExport = () => exportToCsv(
    filtered.map(c => ({
      ...c,
      circle_name: circleName(c.circle_id),
      age_category_label: c.age_category ? (ageCategoryLabel[c.age_category] ?? c.age_category) : 'غير معروفة',
    })),
    csvColumns,
    'companions',
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display text-foreground">المرافقات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? `عرض ${filtered.length} من ${companions.length}` : `${companions.length} مرافِقة`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
          <Download size={14} /> تصدير CSV
        </Button>
      </div>

      {/* Search & filters */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهوية أو الهاتف..." className="pr-9" />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground shrink-0">
                <X size={14} /> مسح الفلاتر
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SearchableSelect
              options={[{ value: '', label: 'كل الفئات' }, ...Object.entries(ageCategoryLabel).map(([v, l]) => ({ value: v, label: l }))]}
              value={filterCategory} onValueChange={setFilterCategory}
              placeholder="كل الفئات" searchPlaceholder="ابحث..." allowClear />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HeartHandshake size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {hasFilters ? 'لا توجد نتائج مطابقة للفلاتر' : 'لا توجد مرافقات'}
            </p>
            {hasFilters && <Button variant="link" onClick={clearFilters} className="mt-2">مسح الفلاتر</Button>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="الاسم" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="رقم الهوية" sortKey="national_id" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="الهاتف" sortKey="phone" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="الحلقة" sortKey="circle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="الفئة العمرية" sortKey="category" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{c.national_id || '-'}</TableCell>
                    <TableCell dir="ltr" className="text-right">{c.phone || '-'}</TableCell>
                    <TableCell>{circleName(c.circle_id)}</TableCell>
                    <TableCell>
                      {c.age_category
                        ? <Badge variant="outline" className={ageCategoryColor[c.age_category] || ''}>{ageCategoryLabel[c.age_category] ?? c.age_category}</Badge>
                        : <span className="text-muted-foreground text-sm">غير معروفة</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}
