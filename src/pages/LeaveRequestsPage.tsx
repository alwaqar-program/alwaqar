import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { useUrlMultiFilter } from '@/lib/use-url-multi-filter';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import { DoorOpen, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useLeaveTypes } from '@/lib/leave';

// الفئة + الاسم لأي طلب (طالبة / مرافقة / مبتدئة).
const subjectName = (r: any): string =>
  r.students?.full_name || r.companions?.full_name || r.beginners?.full_name || '—';
const cohortTag = (r: any): string =>
  r.companion_id ? 'مرافقة' : r.beginner_id ? 'مبتدئة' : 'طالبة';
// معرّف الشخص (أياً كانت فئته) لعدّ استئذاناته.
const personKey = (r: any): string => r.student_id || r.companion_id || r.beginner_id || '';
// حدّ التمييز: 3 استئذانات فأكثر.
const FREQUENT_LEAVE_THRESHOLD = 3;

// فلتر عدد الاستئذانات: 1 / 2 / 3 / أكثر من 3.
const countBucket = (cnt: number): string => (cnt > 3 ? '3+' : String(cnt));
const countFilterOptions = [
  { value: '1', label: 'استئذان واحد' },
  { value: '2', label: 'استئذانان' },
  { value: '3', label: '3 استئذانات' },
  { value: '3+', label: 'أكثر من 3' },
];

const csvColumns: CsvColumnDef[] = [
  { key: 'student_name', header: 'الاسم' },
  { key: 'leave_type', header: 'نوع الإذن' },
  { key: 'reason', header: 'ملاحظات' },
  { key: 'start_date', header: 'التاريخ' },
];

export default function LeaveRequestsPage() {
  const { toast } = useToast();
  const { types: leaveTypes } = useLeaveTypes();
  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useUrlMultiFilter('type');
  const [filterCount, setFilterCount] = useUrlMultiFilter('count');

  const today = () => new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    student_id: '', leave_type: '', reason: '', start_date: today(), end_date: '', notes: '',
  });

  const openCreate = () => {
    setEditingId(null);
    setEditingName('');
    setForm({ student_id: '', leave_type: '', reason: '', start_date: today(), end_date: '', notes: '' });
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setEditingName(subjectName(r));
    setForm({
      student_id: personKey(r), leave_type: r.leave_type || '', reason: r.reason || '',
      start_date: r.start_date || today(), end_date: r.end_date || '', notes: r.notes || '',
    });
    setOpen(true);
  };

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

  // عدد الاستئذانات لكل شخص (كل السجلات، بغضّ النظر عن الفلاتر).
  const leaveCounts = useMemo(() => {
    const m = new Map<string, number>();
    requests.forEach(r => { const k = personKey(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (search && !subjectName(r).includes(search) && !r.reason?.includes(search)) return false;
      if (filterType.length > 0 && !filterType.includes(r.leave_type)) return false;
      if (filterCount.length > 0 && !filterCount.includes(countBucket(leaveCounts.get(personKey(r)) || 0))) return false;
      return true;
    });
  }, [requests, search, filterType, filterCount, leaveCounts]);

  const handleSubmit = async () => {
    if (!form.leave_type || (!editingId && !form.student_id)) {
      toast({ title: 'خطأ', description: editingId ? 'اختر نوع الإذن' : 'اختر الطالبة ونوع الإذن', variant: 'destructive' });
      return;
    }
    // التعديل لا يغيّر الشخص (قد يكون مرافقة/مبتدئة) — نعدّل النوع/التاريخ/الملاحظات فقط.
    const { error } = editingId
      ? await supabase.from('leave_requests').update({
          leave_type: form.leave_type,
          reason: form.reason || null,
          start_date: form.start_date,
        }).eq('id', editingId)
      : await supabase.from('leave_requests').insert({
          student_id: form.student_id,
          leave_type: form.leave_type,
          reason: form.reason || null,
          start_date: form.start_date,
          end_date: form.end_date || null,
          notes: form.notes || null,
          status: 'approved', // الاستئذان يُعتمد تلقائياً (لا مسار موافقة)
        });
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: editingId ? 'تم تعديل الاستئذان' : 'تم تسجيل الاستئذان' });
      setOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (r: any) => {
    if (!window.confirm(`حذف استئذان «${subjectName(r)}»؟`)) return;
    const { error } = await supabase.from('leave_requests').delete().eq('id', r.id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم', description: 'تم حذف الاستئذان' });
    fetchData();
  };

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sorted = useMemo(() => {
    const acc: Record<string, (r: any) => unknown> = {
      student: (r) => subjectName(r),
      type: (r) => r.leave_type,
      reason: (r) => r.reason,
      start: (r) => r.start_date,
    };
    const types: Record<string, 'date'> = { start: 'date' };
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
          <Button onClick={openCreate}><Plus size={16} /> تسجيل استئذان</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'تعديل استئذان' : 'تسجيل استئذان'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {editingId ? (
                  <div>
                    <Label>الاسم</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm">{editingName}</div>
                  </div>
                ) : (
                  <div>
                    <Label>الطالبة *</Label>
                    <SearchableSelect
                      options={students.map(s => ({ value: s.id, label: s.full_name }))}
                      value={form.student_id}
                      onValueChange={v => setForm({ ...form, student_id: v })}
                      placeholder="اختر الطالبة"
                    />
                  </div>
                )}
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
                  <Label>التاريخ</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full">{editingId ? 'حفظ التعديلات' : 'تسجيل'}</Button>
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
              className="w-[160px]"
              options={countFilterOptions}
              values={filterCount}
              onValuesChange={setFilterCount}
              placeholder="عدد الاستئذانات"
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
                <SortableHead label="ملاحظات" sortKey="reason" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="التاريخ" sortKey="start" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <TableHead>إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
              ) : sorted.map(r => {
                const cnt = leaveCounts.get(personKey(r)) || 0;
                const frequent = cnt >= FREQUENT_LEAVE_THRESHOLD;
                return (
                <TableRow key={r.id} className={frequent ? 'bg-warning/5 hover:bg-warning/10' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{subjectName(r)}</span>
                      <Badge variant="secondary" className="text-[10px]">{cohortTag(r)}</Badge>
                      {frequent && (
                        <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">
                          {cnt} استئذانات
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.leave_type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.reason || '—'}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
