import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// سجل التدقيق لصف واحد (حضور/تسميع) — يُقرأ من recording_activity_log.
interface LogRow {
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'restored';
  changes: Record<string, { old: unknown; new: unknown }> | null;
  actor: string | null;
  created_at: string;
}

const ACTION_AR: Record<string, string> = {
  created: 'أُنشئ', updated: 'عُدّل', deleted: 'حُذف', restored: 'استُرجع',
};
const ACTION_COLOR: Record<string, string> = {
  created: 'bg-success/10 text-success border-success/20',
  updated: 'bg-info/10 text-info border-info/20',
  deleted: 'bg-destructive/10 text-destructive border-destructive/20',
  restored: 'bg-accent/10 text-accent border-accent/20',
};

const FIELD_AR: Record<string, string> = {
  status: 'الحالة', late_reason: 'سبب التأخير', late_reason_other: 'سبب آخر',
  error_count: 'الأخطاء', lahn_count: 'اللحون', from_surah: 'من سورة', to_surah: 'إلى سورة',
  from_verse: 'من آية', to_verse: 'إلى آية', from_page: 'من صفحة', to_page: 'إلى صفحة',
  is_extra_memorization: 'حفظ زائد', thabit_confirmed: 'نصاب التثبيت', hifz_confirmed: 'نصاب الحفظ',
  is_deleted: 'محذوف', recorded_by: 'سجّلها', period: 'الفترة', date: 'التاريخ',
  score: 'الدرجة', grade: 'التقدير', pages_recited: 'الصفحات',
};
const STATUS_AR: Record<string, string> = {
  present: 'حاضرة', absent: 'غائبة', late: 'متأخرة', excused: 'مستأذنة', exempted: 'معفاة',
};
// حقول داخلية لا تهمّ العرض
const HIDE = new Set(['id', 'created_at', 'updated_at', 'student_id', 'companion_id', 'beginner_id',
  'teacher_id', 'circle_id', 'from_sort_order', 'to_sort_order', 'deleted_by', 'deleted_at']);

const fmtVal = (field: string, v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'فارغ';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (field === 'status') return STATUS_AR[String(v)] ?? String(v);
  return String(v);
};
const fmtWhen = (iso: string) => {
  try { return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
};

export function RecordHistoryButton({
  tableName, rowId, title,
}: { tableName: 'attendance' | 'recitation_log'; rowId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('recording_activity_log')
      .select('id, action, changes, actor, created_at')
      .eq('table_name', tableName)
      .eq('row_id', rowId)
      .order('created_at', { ascending: true });
    setRows((data as LogRow[]) || []);
    setLoading(false);
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="السجل"
        onClick={() => { setOpen(true); load(); }}>
        <History size={14} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">سجل التغييرات — {title}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا يوجد سجل لهذا الإدخال</p>
          ) : (
            <div className="space-y-3 pt-2">
              {rows.map(r => (
                <div key={r.id} className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className={ACTION_COLOR[r.action] || ''}>{ACTION_AR[r.action] ?? r.action}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtWhen(r.created_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">بواسطة: {r.actor || '—'}</div>
                  {r.changes && Object.keys(r.changes).filter(k => !HIDE.has(k)).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(r.changes).filter(([k]) => !HIDE.has(k)).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground min-w-[5rem]">{FIELD_AR[k] ?? k}</span>
                          <span className="line-through text-destructive/70">{fmtVal(k, v.old)}</span>
                          <span>←</span>
                          <span className="text-success font-medium">{fmtVal(k, v.new)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
