import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { CsvActions } from '@/components/CsvActions';
import { CsvColumnDef } from '@/lib/csv-utils';
import {
  fetchJuzPageCounts, pagesForJuz, studyDaysExcludingFridays, dailyPageTarget,
} from '@/lib/program-target';

const branchCsvColumns: CsvColumnDef[] = [
  { key: 'branch_name', header: 'اسم الفرع' },
  { key: 'juz_count', header: 'عدد الأجزاء', importTransform: v => parseInt(v) || 0 },
  { key: 'total_pages', header: 'إجمالي الصفحات' },
  { key: 'daily_target', header: 'المستهدف اليومي (محسوب)' },
  { key: 'program_start_date', header: 'تاريخ البداية' },
  { key: 'program_end_date', header: 'تاريخ النهاية' },
];

interface Branch {
  id: string;
  branch_name: string;
  juz_count: number;
  expected_daily_pages: number;
  program_start_date: string | null;
  program_end_date: string | null;
  is_active: boolean;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [juzPages, setJuzPages] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({
    branch_name: '',
    juz_count: 5,
    program_start_date: '',
    program_end_date: '',
  });
  const { toast } = useToast();

  const fetchBranches = async () => {
    const [{ data, error }, jp] = await Promise.all([
      supabase.from('branches').select('*').order('created_at'),
      fetchJuzPageCounts(),
    ]);
    if (error) {
      toast({ title: 'خطأ في جلب الفروع', description: error.message, variant: 'destructive' });
    } else {
      setBranches(data || []);
    }
    setJuzPages(jp);
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); }, []);

  // المستهدف اليومي المحسوب لكل فرع (صفحات الفرع ÷ أيام الدراسة بلا جمعة).
  const targetFor = (b: Branch) => {
    const pages = pagesForJuz(juzPages, b.juz_count);
    const days = studyDaysExcludingFridays(b.program_start_date, b.program_end_date);
    const daily = dailyPageTarget(juzPages, b.juz_count, b.program_start_date, b.program_end_date);
    return { pages, days, daily };
  };
  const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString();

  const openCreate = () => {
    setEditing(null);
    setForm({ branch_name: '', juz_count: 5, program_start_date: '', program_end_date: '' });
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      branch_name: b.branch_name,
      juz_count: b.juz_count,
      program_start_date: b.program_start_date || '',
      program_end_date: b.program_end_date || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // المستهدف اليومي محسوب من النظام؛ نخزّنه أيضاً في expected_daily_pages للتوافق.
    const computed = dailyPageTarget(juzPages, form.juz_count, form.program_start_date || null, form.program_end_date || null);
    const payload = {
      branch_name: form.branch_name,
      juz_count: form.juz_count,
      expected_daily_pages: computed ?? 0,
      program_start_date: form.program_start_date || null,
      program_end_date: form.program_end_date || null,
    };

    if (editing) {
      const { error } = await supabase.from('branches').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'تم تحديث الفرع بنجاح' });
    } else {
      const { error } = await supabase.from('branches').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'تم إضافة الفرع بنجاح' });
    }
    setDialogOpen(false);
    fetchBranches();
  };

  const toggleActive = async (b: Branch) => {
    await supabase.from('branches').update({ is_active: !b.is_active }).eq('id', b.id);
    fetchBranches();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة الفروع</h1>
          <p className="text-sm text-muted-foreground mt-1">إضافة وتعديل فروع التحفيظ</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvActions
            data={branches.map(b => {
              const { pages, daily } = targetFor(b);
              return { ...b, total_pages: pages, daily_target: daily != null ? fmt1(daily) : '' };
            })}
            columns={branchCsvColumns} tableName="branches" filename="branches" onImportComplete={fetchBranches} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus size={18} />
                إضافة فرع
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? 'تعديل الفرع' : 'إضافة فرع جديد'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>اسم الفرع</Label>
                <Input value={form.branch_name} onChange={e => setForm(f => ({ ...f, branch_name: e.target.value }))} placeholder="مثال: فرع 5 أجزاء" />
              </div>
              <div className="space-y-2">
                <Label>عدد الأجزاء <span className="text-muted-foreground font-normal">(0 = غير محدد، لا يُحتسب)</span></Label>
                <Input type="number" min={0} max={30} value={form.juz_count} onChange={e => setForm(f => ({ ...f, juz_count: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>تاريخ بداية البرنامج</Label>
                  <Input type="date" value={form.program_start_date} onChange={e => setForm(f => ({ ...f, program_start_date: e.target.value }))} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ نهاية البرنامج</Label>
                  <Input type="date" value={form.program_end_date} onChange={e => setForm(f => ({ ...f, program_end_date: e.target.value }))} dir="ltr" />
                </div>
              </div>
              {(() => {
                const pages = pagesForJuz(juzPages, form.juz_count);
                const daily = dailyPageTarget(juzPages, form.juz_count, form.program_start_date || null, form.program_end_date || null);
                return (
                  <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">إجمالي الصفحات ({form.juz_count} جزء)</span><span className="font-medium">{pages || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المستهدف اليومي (محسوب)</span><span className="font-medium text-primary">{form.juz_count <= 0 ? 'لا يُحتسب (غير محدد)' : daily != null ? `${fmt1(daily)} صفحة/يوم` : 'حدّد التواريخ'}</span></div>
                  </div>
                );
              })()}
              <Button onClick={handleSave} className="w-full">{editing ? 'حفظ التعديلات' : 'إضافة'}</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد فروع بعد</p>
            <p className="text-sm text-muted-foreground/70">ابدأ بإضافة فرع جديد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <Card key={b.id} className={!b.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-display text-lg">{b.branch_name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                      <Pencil size={14} />
                    </Button>
                    <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(() => {
                  const { pages, daily } = targetFor(b);
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">عدد الأجزاء</span>
                        <span className="font-medium">{b.juz_count} ({pages || '—'} صفحة)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المستهدف اليومي</span>
                        <span className="font-medium text-primary">
                          {b.juz_count <= 0 ? 'لا يُحتسب (غير محدد)' : daily != null ? `${fmt1(daily)} صفحة/يوم` : 'حدّد التواريخ'}
                        </span>
                      </div>
                    </>
                  );
                })()}
                {b.program_start_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المدة</span>
                    <span className="font-medium" dir="ltr">{b.program_start_date} → {b.program_end_date || '…'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
