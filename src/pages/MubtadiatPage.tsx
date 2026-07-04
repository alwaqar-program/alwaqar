import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Search, X, Baby, Download } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { sortCircles } from '@/lib/circle-order';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';

interface Beginner {
  id: string;
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
];

export default function MubtadiatPage() {
  const { toast } = useToast();
  const [beginners, setBeginners] = useState<Beginner[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCircle, setFilterCircle] = useState('');

  useEffect(() => {
    const load = async () => {
      // beginners ليس ضمن الأنواع المولّدة — نفس نمط companions/applicants
      const [bRes, cRes] = await Promise.all([
        (supabase as any).from('beginners')
          .select('id, full_name, national_id, phone, guardian_phone, nationality, circle_id')
          .eq('is_active', true)
          .order('full_name'),
        supabase.from('circles').select('id, circle_name'),
      ]);
      if (bRes.error) toast({ title: 'خطأ', description: bRes.error.message, variant: 'destructive' });
      setBeginners((bRes.data as Beginner[]) || []);
      setCircles(sortCircles((cRes.data as Circle[]) || []));
      setLoading(false);
    };
    load();
  }, [toast]);

  const circleName = (id: string | null) => circles.find(c => c.id === id)?.circle_name || '-';

  const filtered = useMemo(() => beginners.filter(b => {
    if (search && !b.full_name.includes(search) && !b.national_id?.includes(search) && !b.phone?.includes(search)) return false;
    if (filterCircle && (b.circle_id ?? '') !== filterCircle) return false;
    return true;
  }), [beginners, search, filterCircle]);

  const hasFilters = !!search || !!filterCircle;
  const clearFilters = () => { setSearch(''); setFilterCircle(''); };

  // Sortable columns (same behaviour as the students table).
  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sorted = useMemo(() => {
    const acc: Record<string, (b: Beginner) => unknown> = {
      name: (b) => b.full_name,
      national_id: (b) => b.national_id,
      phone: (b) => b.phone,
      guardian_phone: (b) => b.guardian_phone,
      circle: (b) => circleName(b.circle_id),
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
  useEffect(() => { setPage(1); }, [search, filterCircle, sortKey, sortDir]);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleExport = () => exportToCsv(
    filtered.map(b => ({ ...b, circle_name: circleName(b.circle_id) })),
    csvColumns,
    'mubtadiat',
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display text-foreground">المبتدئات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? `عرض ${filtered.length} من ${beginners.length}` : `${beginners.length} مبتدئة`}
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
              options={[{ value: '', label: 'كل الحلقات' }, ...circles.map(c => ({ value: c.id, label: c.circle_name }))]}
              value={filterCircle} onValueChange={setFilterCircle}
              placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة..." allowClear />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Baby size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {hasFilters ? 'لا توجد نتائج مطابقة للفلاتر' : 'لا توجد مبتدئات'}
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
                  <SortableHead label="هاتف ولي الأمر" sortKey="guardian_phone" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="الحلقة" sortKey="circle" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.full_name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{b.national_id || '-'}</TableCell>
                    <TableCell dir="ltr" className="text-right">{b.phone || '-'}</TableCell>
                    <TableCell dir="ltr" className="text-right">{b.guardian_phone || '-'}</TableCell>
                    <TableCell>{circleName(b.circle_id)}</TableCell>
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
