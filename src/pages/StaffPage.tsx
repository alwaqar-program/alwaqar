import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, UserCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';

// Arabic labels kept only to display any legacy rows that still carry one of
// the old fixed role keys. New titles are entered as free text.
const TITLE_AR: Record<string, string> = {
  housing_supervisor: 'مشرفة سكن',
  student_affairs: 'شؤون طالبات',
  admin_staff: 'إدارية',
};

const staffCsvColumns: CsvColumnDef[] = [
  { key: 'staff_name', header: 'الاسم الكامل' },
  { key: 'title', header: 'المسمى الوظيفي' },
  { key: 'national_id', header: 'رقم الهوية' },
  { key: 'phone', header: 'الهاتف' },
  { key: 'email', header: 'البريد الإلكتروني' },
];

interface Staff {
  id: string;
  staff_name: string;
  title: string | null;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  has_companions: boolean;
  companions_details: string | null;
  notes: string | null;
  is_active: boolean;
}

const EMPTY_FORM = {
  staff_name: '',
  title: '',
  national_id: '',
  phone: '',
  email: '',
  has_companions: false,
  companions_details: '',
  notes: '',
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedStaff = (() => {
    const acc: Record<string, (s: Staff) => unknown> = {
      name: (s) => s.staff_name,
      title: (s) => (s.title ? TITLE_AR[s.title] ?? s.title : ''),
      phone: (s) => s.phone,
      active: (s) => s.is_active,
    };
    if (!sortKey || !acc[sortKey]) return staff;
    return sortRows(staff, acc[sortKey], sortDir, sortKey === 'active' ? 'boolean' : 'text');
  })();
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
    setStaff((data as Staff[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      staff_name: s.staff_name,
      title: s.title || '',
      national_id: s.national_id || '',
      phone: s.phone || '',
      email: s.email || '',
      has_companions: s.has_companions,
      companions_details: s.companions_details || '',
      notes: s.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      staff_name: form.staff_name,
      // `title` is NOT NULL in the DB; keep an empty title as '' (renders as
      // "غير محدد") rather than null.
      title: form.title.trim(),
      national_id: form.national_id || null,
      phone: form.phone || null,
      email: form.email || null,
      has_companions: form.has_companions,
      companions_details: form.has_companions ? (form.companions_details || null) : null,
      notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from('staff').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('staff').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: editing ? 'تم التحديث' : 'تم الإضافة' });
    setDialogOpen(false);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة المشرفات</h1>
          <p className="text-sm text-muted-foreground mt-1">مشرفات السكن ومسؤولات الشؤون</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={staff} columns={staffCsvColumns} tableName="staff" filename="staff" onImportComplete={fetchData} />
          <Button onClick={openCreate}><Plus size={18} /> إضافة مشرفة</Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'تعديل بيانات المشرفة' : 'إضافة مشرفة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>المسمى الوظيفي</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: مشرفة سكن"
              />
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
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" type="email" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="cursor-pointer">هل معها مرافقات؟</Label>
              <Switch
                checked={form.has_companions}
                onCheckedChange={v => setForm(f => ({ ...f, has_companions: v }))}
              />
            </div>
            {form.has_companions && (
              <div className="space-y-2">
                <Label>بيانات المرافقين</Label>
                <Textarea
                  value={form.companions_details}
                  onChange={e => setForm(f => ({ ...f, companions_details: e.target.value }))}
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? 'حفظ' : 'إضافة'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : staff.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserCheck size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد مشرفات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="الاسم" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="المسمى" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الهاتف" sortKey="phone" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الحالة" sortKey="active" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStaff.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.staff_name}</TableCell>
                  <TableCell>
                    {s.title ? (
                      TITLE_AR[s.title] ?? s.title
                    ) : (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        غير محدد
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell dir="ltr">{s.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={s.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {s.is_active ? 'نشطة' : 'غير نشطة'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                      <Pencil size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
