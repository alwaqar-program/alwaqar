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
];

interface Circle {
  id: string;
  circle_name: string;
  branch_id: string;
  is_active: boolean;
  branches?: { branch_name: string } | null;
}

interface Branch {
  id: string;
  branch_name: string;
}

interface Teacher {
  id: string;
  teacher_name: string;
}

interface Assignment {
  teacher_id: string;
  circle_id: string;
  period: string; // 'morning' | 'evening' | 'both'
}

// Per-circle assigned teachers, resolved to a morning + evening teacher id.
interface CircleTeachers { morning: string; evening: string; }

export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Record<string, CircleTeachers>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Circle | null>(null);
  const [form, setForm] = useState({ circle_name: '', branch_id: '', morning: '', evening: '' });
  const { toast } = useToast();

  const teacherName = (id: string) => teachers.find(t => t.id === id)?.teacher_name || '';

  const fetch = async () => {
    const [circlesRes, branchesRes, teachersRes, assignRes] = await Promise.all([
      supabase.from('circles').select('*, branches(branch_name)').order('created_at'),
      supabase.from('branches').select('id, branch_name').eq('is_active', true),
      supabase.from('teachers').select('id, teacher_name').eq('is_active', true).order('teacher_name'),
      supabase.from('teacher_assignments').select('teacher_id, circle_id, period').eq('is_active', true),
    ]);
    setCircles(circlesRes.data || []);
    setBranches(branchesRes.data || []);
    setTeachers(teachersRes.data || []);

    // Resolve each circle's assignments to a morning + evening teacher.
    const map: Record<string, CircleTeachers> = {};
    (assignRes.data as Assignment[] | null || []).forEach(a => {
      if (!map[a.circle_id]) map[a.circle_id] = { morning: '', evening: '' };
      if (a.period === 'morning') map[a.circle_id].morning = a.teacher_id;
      else if (a.period === 'evening') map[a.circle_id].evening = a.teacher_id;
      else { map[a.circle_id].morning = a.teacher_id; map[a.circle_id].evening = a.teacher_id; } // 'both'
    });
    setAssignments(map);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ circle_name: '', branch_id: branches[0]?.id || '', morning: '', evening: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Circle) => {
    setEditing(c);
    const a = assignments[c.id];
    setForm({ circle_name: c.circle_name, branch_id: c.branch_id, morning: a?.morning || '', evening: a?.evening || '' });
    setDialogOpen(true);
  };

  // Replace a circle's teacher_assignments with the current morning/evening picks.
  const saveAssignments = async (circleId: string) => {
    await supabase.from('teacher_assignments').delete().eq('circle_id', circleId);
    const rows: { teacher_id: string; circle_id: string; period: string }[] = [];
    if (form.morning && form.morning === form.evening) {
      rows.push({ teacher_id: form.morning, circle_id: circleId, period: 'both' });
    } else {
      if (form.morning) rows.push({ teacher_id: form.morning, circle_id: circleId, period: 'morning' });
      if (form.evening) rows.push({ teacher_id: form.evening, circle_id: circleId, period: 'evening' });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('teacher_assignments').insert(rows);
      if (error) toast({ title: 'تعذّر حفظ التكليف', description: error.message, variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    // `period` is vestigial: a circle runs both periods, the period is chosen at
    // recitation/attendance time. Sent only to satisfy the legacy NOT NULL column
    // until 19_tasmee_exams.sql makes it nullable.
    const payload = { circle_name: form.circle_name, branch_id: form.branch_id, period: 'morning' };
    let circleId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('circles').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { data, error } = await supabase.from('circles').insert(payload).select('id').single();
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
      circleId = data.id;
    }
    if (circleId) await saveAssignments(circleId);
    toast({ title: editing ? 'تم تحديث الحلقة' : 'تم إضافة الحلقة' });
    setDialogOpen(false);
    fetch();
  };

  const toggleActive = async (c: Circle) => {
    await supabase.from('circles').update({ is_active: !c.is_active }).eq('id', c.id);
    fetch();
  };

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
              <p className="text-xs text-muted-foreground">
                الحلقة تعمل في الفترتين الصباحية والمسائية؛ تُحدَّد الفترة عند تسجيل التسميع أو الحضور.
              </p>

              <div className="border-t pt-3 space-y-3">
                <Label className="text-sm font-medium">تكليف المعلمات</Label>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">معلمة الفترة الصباحية</Label>
                  <SearchableSelect
                    options={[{ value: '', label: '— بدون —' }, ...teachers.map(t => ({ value: t.id, label: t.teacher_name }))]}
                    value={form.morning}
                    onValueChange={v => setForm(f => ({ ...f, morning: v }))}
                    placeholder="اختر المعلمة"
                    searchPlaceholder="ابحث عن معلمة..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">معلمة الفترة المسائية</Label>
                  <SearchableSelect
                    options={[{ value: '', label: '— بدون —' }, ...teachers.map(t => ({ value: t.id, label: t.teacher_name }))]}
                    value={form.evening}
                    onValueChange={v => setForm(f => ({ ...f, evening: v }))}
                    placeholder="اختر المعلمة"
                    searchPlaceholder="ابحث عن معلمة..."
                  />
                </div>
                {form.morning && form.morning === form.evening && (
                  <p className="text-xs text-muted-foreground">نفس المعلمة للفترتين.</p>
                )}
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForm(f => ({ ...f, evening: f.morning }))}
                >
                  نسخ معلمة الصباح للمساء
                </button>
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
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{c.branches?.branch_name}</Badge>
                  <Badge variant="outline">صباحي ومسائي</Badge>
                </div>
                {(() => {
                  const a = assignments[c.id];
                  const m = a?.morning ? teacherName(a.morning) : '';
                  const e = a?.evening ? teacherName(a.evening) : '';
                  if (!m && !e) return <p className="text-xs text-muted-foreground">لا توجد معلمة مكلّفة</p>;
                  if (m && m === e) return <p className="text-xs text-muted-foreground">المعلمة: <span className="text-foreground">{m}</span> (الفترتان)</p>;
                  return (
                    <p className="text-xs text-muted-foreground">
                      صباحي: <span className="text-foreground">{m || '—'}</span> · مسائي: <span className="text-foreground">{e || '—'}</span>
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
