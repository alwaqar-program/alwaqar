import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import { FileSignature, Plus, Search } from 'lucide-react';

const pledgeTypes = ['تعهد سلوكي', 'تعهد حضور', 'تعهد التزام بالنظام', 'تعهد أداء', 'أخرى'];

const csvColumns: CsvColumnDef[] = [
  { key: 'student_name', header: 'الطالبة' },
  { key: 'pledge_type', header: 'نوع التعهد' },
  { key: 'pledge_text', header: 'النص' },
  { key: 'signed', header: 'موقّع', transform: v => v ? 'نعم' : 'لا' },
  { key: 'signed_date', header: 'تاريخ التوقيع' },
  { key: 'notes', header: 'ملاحظات' },
];

export default function PledgesPage() {
  const { toast } = useToast();
  const [pledges, setPledges] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSigned, setFilterSigned] = useState('all');

  const [form, setForm] = useState({
    student_id: '', pledge_type: '', pledge_text: '', signed: false, signed_date: '', notes: '', created_by: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('pledges').select('*, students(full_name)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);
    setPledges(p || []);
    setStudents(s || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return pledges.filter(p => {
      if (search && !p.students?.full_name?.includes(search) && !p.pledge_type?.includes(search)) return false;
      if (filterType !== 'all' && p.pledge_type !== filterType) return false;
      if (filterSigned === 'signed' && !p.signed) return false;
      if (filterSigned === 'unsigned' && p.signed) return false;
      return true;
    });
  }, [pledges, search, filterType, filterSigned]);

  const handleSubmit = async () => {
    if (!form.student_id || !form.pledge_type) {
      toast({ title: 'خطأ', description: 'اختر الطالبة ونوع التعهد', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('pledges').insert({
      student_id: form.student_id,
      pledge_type: form.pledge_type,
      pledge_text: form.pledge_text || null,
      signed: form.signed,
      signed_date: form.signed_date || null,
      notes: form.notes || null,
      created_by: form.created_by || null,
    });
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: 'تمت إضافة التعهد بنجاح' });
      setOpen(false);
      setForm({ student_id: '', pledge_type: '', pledge_text: '', signed: false, signed_date: '', notes: '', created_by: '' });
      fetchData();
    }
  };

  const csvData = filtered.map(p => ({ ...p, student_name: p.students?.full_name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSignature className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display">التعهدات</h1>
            <p className="text-sm text-muted-foreground">إدارة تعهدات الطالبات</p>
          </div>
        </div>
        <div className="flex gap-2">
          <CsvActions tableName="pledges" columns={csvColumns} data={csvData} filename="التعهدات" onImportComplete={fetchData} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus size={16} /> إضافة تعهد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>إضافة تعهد جديد</DialogTitle></DialogHeader>
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
                  <Label>نوع التعهد *</Label>
                  <Select value={form.pledge_type} onValueChange={v => setForm({ ...form, pledge_type: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                    <SelectContent>
                      {pledgeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نص التعهد</Label>
                  <Textarea value={form.pledge_text} onChange={e => setForm({ ...form, pledge_text: e.target.value })} />
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={form.signed} onChange={e => setForm({ ...form, signed: e.target.checked })} className="rounded" />
                    <Label>تم التوقيع</Label>
                  </div>
                  <div className="flex-1">
                    <Label>تاريخ التوقيع</Label>
                    <Input type="date" value={form.signed_date} onChange={e => setForm({ ...form, signed_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={handleSubmit} className="w-full">حفظ التعهد</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم أو النوع..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {pledgeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSigned} onValueChange={setFilterSigned}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="signed">موقّع</SelectItem>
                <SelectItem value="unsigned">غير موقّع</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالبة</TableHead>
                <TableHead>نوع التعهد</TableHead>
                <TableHead>التوقيع</TableHead>
                <TableHead>تاريخ التوقيع</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد تعهدات</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.students?.full_name}</TableCell>
                  <TableCell><Badge variant="outline">{p.pledge_type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={p.signed ? 'default' : 'secondary'}>{p.signed ? 'موقّع' : 'غير موقّع'}</Badge>
                  </TableCell>
                  <TableCell>{p.signed_date || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{p.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
