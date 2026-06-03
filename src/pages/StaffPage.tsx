import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';

const staffCsvColumns: CsvColumnDef[] = [
  { key: 'staff_name', header: 'الاسم الكامل' },
  { key: 'title', header: 'المسمى الوظيفي' },
  { key: 'national_id', header: 'رقم الهوية' },
  { key: 'phone', header: 'الهاتف' },
];

interface Staff {
  id: string;
  staff_name: string;
  title: string;
  national_id: string | null;
  phone: string | null;
  is_active: boolean;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ staff_name: '', title: '', national_id: '', phone: '' });
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ staff_name: '', title: '', national_id: '', phone: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ staff_name: s.staff_name, title: s.title, national_id: s.national_id || '', phone: s.phone || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      staff_name: form.staff_name,
      title: form.title,
      national_id: form.national_id || null,
      phone: form.phone || null,
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
          <h1 className="text-2xl font-display text-foreground">إدارة المنسوبات</h1>
          <p className="text-sm text-muted-foreground mt-1">مشرفات السكن ومسؤولات الشؤون</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={staff} columns={staffCsvColumns} tableName="staff" filename="staff" onImportComplete={fetchData} />
          <Button onClick={openCreate}><Plus size={18} /> إضافة منسوبة</Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'تعديل بيانات المنسوبة' : 'إضافة منسوبة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>المسمى الوظيفي</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مشرفة سكن / مسؤولة شؤون..." />
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
            <p className="text-muted-foreground">لا توجد منسوبات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>المسمى</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.staff_name}</TableCell>
                  <TableCell>{s.title}</TableCell>
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
