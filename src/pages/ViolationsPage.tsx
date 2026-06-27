import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import { AlertTriangle, Plus, Search } from 'lucide-react';

const violationTypes = ['غياب متكرر', 'مخالفة سلوكية', 'إخلال بالنظام', 'تأخر متكرر', 'أخرى'];
const actionTypes = ['إنذار شفهي', 'إنذار كتابي', 'تعهد', 'إشعار ولي الأمر', 'إيقاف مؤقت', 'فصل'];

const csvColumns: CsvColumnDef[] = [
  { key: 'student_name', header: 'الطالبة' },
  { key: 'violation_type', header: 'نوع المخالفة' },
  { key: 'description', header: 'الوصف' },
  { key: 'action_taken', header: 'الإجراء' },
  { key: 'violation_date', header: 'التاريخ' },
  { key: 'notes', header: 'ملاحظات' },
];

export default function ViolationsPage() {
  const { toast } = useToast();
  const [violations, setViolations] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [form, setForm] = useState({
    student_id: '', violation_type: '', description: '', action_taken: '', violation_date: new Date().toISOString().split('T')[0], notes: '', recorded_by: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: v }, { data: s }] = await Promise.all([
      supabase.from('violations').select('*, students(full_name)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);
    setViolations(v || []);
    setStudents(s || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return violations.filter(v => {
      if (search && !v.students?.full_name?.includes(search) && !v.description?.includes(search)) return false;
      if (filterType !== 'all' && v.violation_type !== filterType) return false;
      return true;
    });
  }, [violations, search, filterType]);

  const handleSubmit = async () => {
    if (!form.student_id || !form.violation_type) {
      toast({ title: 'خطأ', description: 'اختر الطالبة ونوع المخالفة', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('violations').insert({
      student_id: form.student_id,
      violation_type: form.violation_type,
      description: form.description || null,
      action_taken: form.action_taken || null,
      violation_date: form.violation_date,
      notes: form.notes || null,
      recorded_by: form.recorded_by || null,
    });
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: 'تم تسجيل المخالفة' });
      setOpen(false);
      setForm({ student_id: '', violation_type: '', description: '', action_taken: '', violation_date: new Date().toISOString().split('T')[0], notes: '', recorded_by: '' });
      fetchData();
    }
  };

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sorted = useMemo(() => {
    const acc: Record<string, (v: any) => unknown> = {
      student: (v) => v.students?.full_name,
      type: (v) => v.violation_type,
      description: (v) => v.description,
      action: (v) => v.action_taken,
      date: (v) => v.violation_date,
    };
    if (!sortKey || !acc[sortKey]) return filtered;
    return sortRows(filtered, acc[sortKey], sortDir, sortKey === 'date' ? 'date' : 'text');
  }, [filtered, sortKey, sortDir]);

  const csvData = filtered.map(v => ({ ...v, student_name: v.students?.full_name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-2xl font-display">المخالفات</h1>
            <p className="text-sm text-muted-foreground">تسجيل ومتابعة مخالفات الطالبات</p>
          </div>
        </div>
        <div className="flex gap-2">
          <CsvActions tableName="violations" columns={csvColumns} data={csvData} filename="المخالفات" onImportComplete={fetchData} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive"><Plus size={16} /> تسجيل مخالفة</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>تسجيل مخالفة جديدة</DialogTitle></DialogHeader>
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
                  <Label>نوع المخالفة *</Label>
                  <SearchableSelect
                    options={violationTypes.map(t => ({ value: t, label: t }))}
                    value={form.violation_type}
                    onValueChange={v => setForm({ ...form, violation_type: v })}
                    placeholder="اختر النوع"
                    searchPlaceholder="ابحث..."
                  />
                </div>
                <div>
                  <Label>وصف المخالفة</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <Label>الإجراء المتخذ</Label>
                  <SearchableSelect
                    options={actionTypes.map(t => ({ value: t, label: t }))}
                    value={form.action_taken}
                    onValueChange={v => setForm({ ...form, action_taken: v })}
                    placeholder="اختر الإجراء"
                    searchPlaceholder="ابحث..."
                  />
                </div>
                <div>
                  <Label>تاريخ المخالفة</Label>
                  <Input type="date" value={form.violation_date} onChange={e => setForm({ ...form, violation_date: e.target.value })} />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full">حفظ المخالفة</Button>
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
            <SearchableSelect
              className="w-[180px]"
              options={[{ value: 'all', label: 'كل الأنواع' }, ...violationTypes.map(t => ({ value: t, label: t }))]}
              value={filterType}
              onValueChange={v => setFilterType(v || 'all')}
              placeholder="كل الأنواع"
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
                <SortableHead label="الطالبة" sortKey="student" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="نوع المخالفة" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الوصف" sortKey="description" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الإجراء" sortKey="action" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="التاريخ" sortKey="date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد مخالفات</TableCell></TableRow>
              ) : sorted.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.students?.full_name}</TableCell>
                  <TableCell><Badge variant="destructive">{v.violation_type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{v.description || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{v.action_taken || '—'}</Badge></TableCell>
                  <TableCell>{v.violation_date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
