import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, GraduationCap } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SortableHead } from '@/components/ui/sortable-head';
import { useTableSort, sortRows } from '@/lib/use-table-sort';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';

const teacherCsvColumns: CsvColumnDef[] = [
  { key: 'teacher_name', header: 'الاسم' },
  { key: 'national_id', header: 'رقم الهوية' },
  { key: 'phone', header: 'الهاتف' },
  { key: 'email', header: 'البريد' },
];

interface Teacher {
  id: string;
  teacher_name: string;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  registration_date: string | null;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ teacher_name: '', national_id: '', phone: '', email: '' });
  const { toast } = useToast();

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedTeachers = (() => {
    const acc: Record<string, (t: Teacher) => unknown> = {
      name: (t) => t.teacher_name,
      national_id: (t) => t.national_id,
      phone: (t) => t.phone,
      email: (t) => t.email,
      active: (t) => t.is_active,
    };
    if (!sortKey || !acc[sortKey]) return teachers;
    return sortRows(teachers, acc[sortKey], sortDir, sortKey === 'active' ? 'boolean' : 'text');
  })();

  const fetchData = async () => {
    const { data } = await supabase.from('teachers').select('*').order('created_at');
    setTeachers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ teacher_name: '', national_id: '', phone: '', email: '' });
    setDialogOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({ teacher_name: t.teacher_name, national_id: t.national_id || '', phone: t.phone || '', email: t.email || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      teacher_name: form.teacher_name,
      national_id: form.national_id || null,
      phone: form.phone || null,
      email: form.email || null,
    };
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('teachers').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: editing ? 'تم التحديث' : 'تم الإضافة' });
    setDialogOpen(false);
    fetchData();
  };

  const toggleActive = async (t: Teacher) => {
    await supabase.from('teachers').update({ is_active: !t.is_active }).eq('id', t.id);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة المعلمات</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل وإدارة المعلمات</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={teachers} columns={teacherCsvColumns} tableName="teachers" filename="teachers" onImportComplete={fetchData} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus size={18} /> إضافة معلمة</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? 'تعديل بيانات المعلمة' : 'إضافة معلمة جديدة'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>رقم الهوية</Label>
                <Input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الهاتف</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>البريد</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'حفظ' : 'إضافة'}</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-48" /></Card>
      ) : teachers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد معلمات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="الاسم" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="رقم الهوية" sortKey="national_id" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الهاتف" sortKey="phone" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="البريد" sortKey="email" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <SortableHead label="الحالة" sortKey="active" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeachers.map(t => (
                <TableRow key={t.id} className={!t.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{t.teacher_name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{t.national_id || '-'}</TableCell>
                  <TableCell dir="ltr" className="text-right">{t.phone || '-'}</TableCell>
                  <TableCell dir="ltr" className="text-right">{t.email || '-'}</TableCell>
                  <TableCell>
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
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
