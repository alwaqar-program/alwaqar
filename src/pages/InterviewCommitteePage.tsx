import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, Pencil, Trash2, Eye } from 'lucide-react';
import { CommitteeMember } from '@/lib/interview-types';

export default function InterviewCommitteePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CommitteeMember | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('interview_committee')
      .select('*')
      .order('full_name');
    if (error) {
      toast({ title: 'تعذّر تحميل اللجنة', description: error.message, variant: 'destructive' });
    } else {
      setMembers(data as CommitteeMember[]);
    }
    setLoading(false);
  }

  async function toggleActive(m: CommitteeMember) {
    const { error } = await (supabase as any)
      .from('interview_committee')
      .update({ is_active: !m.is_active })
      .eq('id', m.id);
    if (error) {
      toast({ title: 'تعذّر التحديث', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: m.is_active ? 'تم التعطيل' : 'تم التفعيل' });
      load();
    }
  }

  async function removeMember(m: CommitteeMember) {
    if (!confirm(`حذف ${m.full_name}؟`)) return;
    const { error } = await (supabase as any)
      .from('interview_committee')
      .delete()
      .eq('id', m.id);
    if (error) {
      toast({ title: 'تعذّر الحذف', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم الحذف' });
      load();
    }
  }

  const activeCount = members.filter(m => m.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display">لجنة المقابلات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة أعضاء اللجنة التي تقابل وتختبر الطالبات
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <UserPlus size={18} />
          إضافة عضوة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-display tabular-nums">{members.length}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي العضوات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-display tabular-nums text-emerald-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">نشطات</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users size={20} />
            العضوات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
          ) : members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              لا توجد عضوات بعد. اضغطي "إضافة عضوة" للبدء.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead className="text-right w-[160px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/interview-committee/${m.id}`)}
                  >
                    <TableCell className="font-medium">{m.full_name}</TableCell>
                    <TableCell>
                      {m.is_active
                        ? <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">نشطة</Badge>
                        : <Badge variant="secondary">معطّلة</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {m.notes || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {new Date(m.created_at).toLocaleDateString('ar-SA')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => navigate(`/interview-committee/${m.id}`)}
                          title="عرض المقابلات"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditTarget(m)} title="تعديل">
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => toggleActive(m)}
                          title={m.is_active ? 'تعطيل' : 'تفعيل'}
                          className="text-xs"
                        >
                          {m.is_active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => removeMember(m)}
                          title="حذف"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MemberFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => { load(); setAddOpen(false); }}
      />
      {editTarget && (
        <MemberFormDialog
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          member={editTarget}
          onSaved={() => { load(); setEditTarget(null); }}
        />
      )}
    </div>
  );
}

function MemberFormDialog({ open, onOpenChange, member, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member?: CommitteeMember;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(member?.full_name ?? '');
  const [notes, setNotes] = useState(member?.notes ?? '');
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(member?.full_name ?? '');
      setNotes(member?.notes ?? '');
      setIsActive(member?.is_active ?? true);
    }
  }, [open, member]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: 'يرجى إدخال الاسم', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    if (member) {
      const { error } = await (supabase as any)
        .from('interview_committee')
        .update({ full_name: fullName.trim(), notes: notes.trim() || null, is_active: isActive })
        .eq('id', member.id);
      setSubmitting(false);
      if (error) {
        toast({ title: 'تعذّر الحفظ', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'تم التحديث' });
    } else {
      const { error } = await (supabase as any)
        .from('interview_committee')
        .insert({ full_name: fullName.trim(), notes: notes.trim() || null, is_active: isActive });
      setSubmitting(false);
      if (error) {
        toast({ title: 'تعذّر الإضافة', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'تمت الإضافة' });
    }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {member ? 'تعديل بيانات العضوة' : 'إضافة عضوة جديدة'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>الاسم الكامل *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <Label className="text-sm">نشطة</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'جارٍ الحفظ…' : (member ? 'حفظ التعديلات' : 'إضافة')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
