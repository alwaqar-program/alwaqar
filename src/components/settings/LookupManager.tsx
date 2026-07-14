import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// جدول بحث بسيط (label / is_active / sort_order) قابل للإدارة، مع دعم اختياري
// لخيار «يتطلب ملاحظة» (requires_note) — يُعاد استخدامه لأنواع الاستئذان وأسباب التأخير.
interface LookupItem {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  requires_note?: boolean;
}

interface Props {
  table: 'leave_types' | 'late_reasons';
  title: string;
  description: string;
  icon: ReactNode;
  placeholder: string;
  /** يعرض مفتاح «يتطلب ملاحظة» لكل عنصر (لأسباب التأخير مثل «أخرى»). */
  hasNoteFlag?: boolean;
}

export function LookupManager({ table, title, description, icon, placeholder, hasNoteFlag }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [form, setForm] = useState({ label: '', sort_order: 0, requires_note: false });

  const fetchItems = async () => {
    const { data, error } = await supabase.from(table).select('*').order('sort_order').order('label');
    if (error) toast({ title: `خطأ في جلب ${title}`, description: error.message, variant: 'destructive' });
    else setItems((data || []) as unknown as LookupItem[]);
    setLoading(false);
  };
  useEffect(() => { fetchItems(); /* eslint-disable-line */ }, []);

  const openCreate = () => {
    setEditing(null);
    const nextOrder = items.length ? Math.max(...items.map(i => i.sort_order)) + 1 : 1;
    setForm({ label: '', sort_order: nextOrder, requires_note: false });
    setDialogOpen(true);
  };

  const openEdit = (it: LookupItem) => {
    setEditing(it);
    setForm({ label: it.label, sort_order: it.sort_order, requires_note: !!it.requires_note });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const label = form.label.trim();
    if (!label) { toast({ title: 'تنبيه', description: 'اكتبي الاسم', variant: 'destructive' }); return; }
    const payload: Record<string, unknown> = { label, sort_order: form.sort_order };
    if (hasNoteFlag) payload.requires_note = form.requires_note;

    if (editing) {
      const { error } = await (supabase.from(table) as any)
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'تم التحديث' });
    } else {
      const { error } = await (supabase.from(table) as any).insert(payload);
      if (error) {
        toast({ title: 'خطأ', description: error.code === '23505' ? 'موجود مسبقاً' : error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'تمت الإضافة' });
    }
    setDialogOpen(false);
    fetchItems();
  };

  const toggleActive = async (it: LookupItem) => {
    await (supabase.from(table) as any).update({ is_active: !it.is_active, updated_at: new Date().toISOString() }).eq('id', it.id);
    fetchItems();
  };

  const remove = async (it: LookupItem) => {
    if (!window.confirm(`حذف «${it.label}»؟ لن يؤثر على السجلات السابقة.`)) return;
    const { error } = await (supabase.from(table) as any).delete().eq('id', it.id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم الحذف' });
    fetchItems();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="font-display text-lg">{title}</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus size={16} /> إضافة</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">{editing ? 'تعديل' : 'إضافة'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>الاسم</Label>
                  <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={placeholder} />
                </div>
                <div className="space-y-2">
                  <Label>الترتيب</Label>
                  <Input type="number" min={0} value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} dir="ltr" />
                </div>
                {hasNoteFlag && (
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <Label>يتطلب ملاحظة</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">يظهر حقل نص حرّ عند اختيار هذا السبب (مثل «أخرى»).</p>
                    </div>
                    <Switch checked={form.requires_note} onCheckedChange={v => setForm(f => ({ ...f, requires_note: v }))} />
                  </div>
                )}
                <Button onClick={handleSave} className="w-full">{editing ? 'حفظ التعديلات' : 'إضافة'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">لا توجد عناصر بعد — أضيفي عنصراً.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map(it => (
              <div key={it.id} className={`flex items-center justify-between py-2.5 ${!it.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-center" dir="ltr">{it.sort_order}</span>
                  <span className="text-sm font-medium">{it.label}</span>
                  {hasNoteFlag && it.requires_note && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+ ملاحظة</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(it)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(it)}>
                    <Trash2 size={14} />
                  </Button>
                  <Switch checked={it.is_active} onCheckedChange={() => toggleActive(it)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
