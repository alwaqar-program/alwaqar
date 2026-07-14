import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, Pencil, Trash2, DoorOpen } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

interface LeaveType {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState({ label: '', sort_order: 0 });

  const fetchTypes = async () => {
    const { data, error } = await supabase.from('leave_types').select('*').order('sort_order').order('label');
    if (error) toast({ title: 'خطأ في جلب أنواع الاستئذان', description: error.message, variant: 'destructive' });
    else setTypes(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchTypes(); }, []);

  const openCreate = () => {
    setEditing(null);
    // الترتيب الافتراضي = آخر رقم + 1
    const nextOrder = types.length ? Math.max(...types.map(t => t.sort_order)) + 1 : 1;
    setForm({ label: '', sort_order: nextOrder });
    setDialogOpen(true);
  };

  const openEdit = (t: LeaveType) => {
    setEditing(t);
    setForm({ label: t.label, sort_order: t.sort_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const label = form.label.trim();
    if (!label) { toast({ title: 'تنبيه', description: 'اكتبي اسم النوع', variant: 'destructive' }); return; }
    if (editing) {
      const { error } = await supabase.from('leave_types')
        .update({ label, sort_order: form.sort_order, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'تم تحديث النوع' });
    } else {
      const { error } = await supabase.from('leave_types').insert({ label, sort_order: form.sort_order });
      if (error) {
        const msg = error.code === '23505' ? 'هذا النوع موجود مسبقاً' : error.message;
        toast({ title: 'خطأ', description: msg, variant: 'destructive' });
        return;
      }
      toast({ title: 'تمت إضافة النوع' });
    }
    setDialogOpen(false);
    fetchTypes();
  };

  const toggleActive = async (t: LeaveType) => {
    await supabase.from('leave_types').update({ is_active: !t.is_active, updated_at: new Date().toISOString() }).eq('id', t.id);
    fetchTypes();
  };

  const remove = async (t: LeaveType) => {
    if (!window.confirm(`حذف النوع «${t.label}»؟ لن يؤثر على السجلات السابقة.`)) return;
    const { error } = await supabase.from('leave_types').delete().eq('id', t.id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم حذف النوع' });
    fetchTypes();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إعدادات النظام</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen size={20} className="text-primary" />
              <CardTitle className="font-display text-lg">أنواع الاستئذان</CardTitle>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreate}><Plus size={16} /> إضافة نوع</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display">{editing ? 'تعديل النوع' : 'إضافة نوع'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="مثال: إذن خروج" />
                  </div>
                  <div className="space-y-2">
                    <Label>الترتيب</Label>
                    <Input type="number" min={0} value={form.sort_order}
                      onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} dir="ltr" />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editing ? 'حفظ التعديلات' : 'إضافة'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-muted-foreground">تظهر هذه الأنواع في تسجيل الاستئذان وفي صفحة الحضور.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل…</p>
          ) : types.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد أنواع بعد — أضيفي نوعاً.</p>
          ) : (
            <div className="divide-y divide-border">
              {types.map(t => (
                <div key={t.id} className={`flex items-center justify-between py-2.5 ${!t.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6 text-center" dir="ltr">{t.sort_order}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(t)}>
                      <Trash2 size={14} />
                    </Button>
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Settings size={36} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground/60">مزيد من الإعدادات قريباً — مستهدفات الإنجاز، معايير التقدير</p>
        </CardContent>
      </Card>
    </div>
  );
}
