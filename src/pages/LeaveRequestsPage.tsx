import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { useUrlMultiFilter } from '@/lib/use-url-multi-filter';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import { DoorOpen, Plus, Search, Check, X } from 'lucide-react';
import { leaveTypes, leaveStatusLabels as statusLabels } from '@/lib/leave';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = { pending: 'secondary', approved: 'default', rejected: 'destructive' };

// الفئة + الاسم لأي طلب (طالبة / مرافقة / مبتدئة).
const subjectName = (r: any): string =>
  r.students?.full_name || r.companions?.full_name || r.beginners?.full_name || '—';
const cohortTag = (r: any): string =>
  r.companion_id ? 'مرافقة' : r.beginner_id ? 'مبتدئة' : 'طالبة';

const csvColumns: CsvColumnDef[] = [
  { key: 'student_name', header: 'الاسم' },
  { key: 'leave_type', header: 'نوع الإذن' },
  { key: 'reason', header: 'السبب' },
  { key: 'start_date', header: 'من' },
  { key: 'end_date', header: 'إلى' },
  { key: 'status', header: 'الحالة', transform: v => statusLabels[v as string] || v },
  { key: 'approved_by', header: 'الموافق' },
];

export default function LeaveRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useUrlMultiFilter('status');
  const [filterType, setFilterType] = useUrlMultiFilter('type');

  const [form, setForm] = useState({
    student_id: '', leave_type: '', reason: '', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from('leave_requests').select('*, students(full_name), companions(full_name), beginners(full_name)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);
    setRequests(r || []);
    setStudents(s || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (search && !subjectName(r).includes(search) && !r.reason?.includes(search)) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(r.status)) return false;
      if (filterType.length > 0 && !filterType.includes(r.leave_type)) return false;
      return true;
    });
  }, [requests, search, filterStatus, filterType]);

  const handleSubmit = async () => {
    if (!form.student_id || !form.leave_type) {
      toast({ title: 'خطأ', description: 'اختر الطالبة ونوع الإذن', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('leave_requests').insert({
      student_id: form.student_id,
      leave_type: form.leave_type,
      reason: form.reason || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes || null,
    });
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: 'تم تسجيل الاستئذان' });
      setOpen(false);
      setForm({ student_id: '', leave_type: '', reason: '', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' });
      fetchData();
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('leave_requests').update({
      status,
      approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: status === 'approved' ? 'تمت الموافقة' : 'تم الرفض' });
      fetchData();
    }
  };

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sorted = useMemo(() => {
    const acc: Record<string, (r: any) => unknown> = {
      student: (r) => subjectName(r),
      type: (r) => r.leave_type,
      reason: (r) => r.reason,
      start: (r) => r.start_date,
      end: (r) => r.end_date,
      status: (r) => statusLabels[r.status] || r.status,
    };
    const types: Record<string, 'date'> = { start: 'date', end: 'date' };
    if (!sortKey || !acc[sortKey]) return filtered;
    return sortRows(filtered, acc[sortKey], sortDir, types[sortKey] ?? 'text');
  }, [filtered, sortKey, sortDir]);

  const csvData = filtered.map(r => ({ ...r, student_name: subjectName(r) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DoorOpen className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display">الاستئذان</h1>
            <p className="text-sm text-muted-foreground">تسجيل وإدارة الاستئذان والإجازات</p>
          </div>
        </div>
        <div className="flex gap-2">
          <CsvActions tableName="leave_requests" columns={csvColumns} data={csvData} filename="الاستئذان" onImportComplete={fetchData} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus size={16} /> تسجيل استئذان</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>تسجيل استئذان</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>الطالبة *</Label>
                  <SearchableSelect
                    options={students.map(s => ({ value: s.id, label: s.full_name }))}
                    value={form.student_id}
                    onValueChange={v => setForm({ ...form, student_id: v })}
                    placeholder="اختر الطالبة"
                  />
                </div>
                <div>
                  <Label>نوع الإذن *</Label>
                  <SearchableSelect
                    options={leaveTypes.map(t => ({ value: t, label: t }))}
                    value={form.leave_type}
                    onValueChange={v => setForm({ ...form, leave_type: v })}
                    placeholder="اختر النوع"
                    searchPlaceholder="ابحث..."
                  />
                </div>
                <div>
                  <Label>السبب</Label>
                  <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>من تاريخ</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>إلى تاريخ</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full">تسجيل</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
              </div>
            </div>
            <MultiSearchableSelect
              className="w-[160px]"
              options={leaveTypes.map(t => ({ value: t, label: t }))}
              values={filterType}
              onValuesChange={setFilterType}
              placeholder="كل الأنواع"
              searchPlaceholder="ابحث..."
            />
            <MultiSearchableSelect
              className="w-[150px]"
              options={[
                { value: 'pending', label: 'قيد الانتظار' },
                { value: 'approved', label: 'مقبول' },
                { value: 'rejected', label: 'مرفوض' },
              ]}
              values={filterStatus}
              onValuesChange={setFilterStatus}
              placeholder="كل الحالات"
              searchPlaceholder="ابحث..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="الاسم" sortKey="student" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="نوع الإذن" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="السبب" sortKey="reason" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="من" sortKey="start" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="إلى" sortKey="end" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الحالة" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <TableHead>إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
              ) : sorted.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{subjectName(r)}</span>
                      <Badge variant="secondary" className="text-[10px]">{cohortTag(r)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.leave_type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.reason || '—'}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>{r.end_date || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[r.status] || 'secondary'}>{statusLabels[r.status] || r.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => updateStatus(r.id, 'approved')}>
                          <Check size={16} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => updateStatus(r.id, 'rejected')}>
                          <X size={16} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
