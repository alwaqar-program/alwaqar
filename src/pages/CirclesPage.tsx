import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';

const circleCsvColumns: CsvColumnDef[] = [
  { key: 'circle_name', header: 'اسم الحلقة' },
  { key: 'period', header: 'الفترة', transform: v => v === 'morning' ? 'صباحي' : 'مسائي', importTransform: v => v === 'صباحي' ? 'morning' : 'evening' },
];

interface Circle {
  id: string;
  circle_name: string;
  branch_id: string;
  period: string;
  is_active: boolean;
  branches?: { branch_name: string } | null;
}

interface Branch {
  id: string;
  branch_name: string;
}

export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Circle | null>(null);
  const [form, setForm] = useState({ circle_name: '', branch_id: '', period: 'morning' as string });
  const { toast } = useToast();

  const fetch = async () => {
    const [circlesRes, branchesRes] = await Promise.all([
      supabase.from('circles').select('*, branches(branch_name)').order('created_at'),
      supabase.from('branches').select('id, branch_name').eq('is_active', true),
    ]);
    setCircles(circlesRes.data || []);
    setBranches(branchesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ circle_name: '', branch_id: branches[0]?.id || '', period: 'morning' });
    setDialogOpen(true);
  };

  const openEdit = (c: Circle) => {
    setEditing(c);
    setForm({ circle_name: c.circle_name, branch_id: c.branch_id, period: c.period });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { circle_name: form.circle_name, branch_id: form.branch_id, period: form.period };
    if (editing) {
      const { error } = await supabase.from('circles').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { error } = await supabase.from('circles').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: editing ? 'تم تحديث الحلقة' : 'تم إضافة الحلقة' });
    setDialogOpen(false);
    fetch();
  };

  const toggleActive = async (c: Circle) => {
    await supabase.from('circles').update({ is_active: !c.is_active }).eq('id', c.id);
    fetch();
  };

  const periodLabel = (p: string) => p === 'morning' ? 'صباحي' : 'مسائي';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة الحلقات</h1>
          <p className="text-sm text-muted-foreground mt-1">إضافة وتعديل الحلقات</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions data={circles} columns={circleCsvColumns} tableName="circles" filename="circles" onImportComplete={fetch} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus size={18} /> إضافة حلقة</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? 'تعديل الحلقة' : 'إضافة حلقة جديدة'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>اسم الحلقة</Label>
                <Input value={form.circle_name} onChange={e => setForm(f => ({ ...f, circle_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>الفرع</Label>
                <SearchableSelect
                  options={branches.map(b => ({ value: b.id, label: b.branch_name }))}
                  value={form.branch_id}
                  onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}
                  placeholder="اختر الفرع"
                  searchPlaceholder="ابحث عن فرع..."
                />
              </div>
              <div className="space-y-2">
                <Label>الفترة</Label>
                <SearchableSelect
                  options={[{ value: 'morning', label: 'صباحي' }, { value: 'evening', label: 'مسائي' }]}
                  value={form.period}
                  onValueChange={v => setForm(f => ({ ...f, period: v }))}
                  placeholder="الفترة"
                  searchPlaceholder="ابحث..."
                />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'حفظ' : 'إضافة'}</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-24" /></Card>)}
        </div>
      ) : circles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد حلقات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {circles.map(c => (
            <Card key={c.id} className={!c.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-display text-lg">{c.circle_name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil size={14} />
                    </Button>
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge variant="secondary">{c.branches?.branch_name}</Badge>
                <Badge variant="outline">{periodLabel(c.period)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
