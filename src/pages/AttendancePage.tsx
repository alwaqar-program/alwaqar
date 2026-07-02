import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Save, Download, Upload } from 'lucide-react';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';

const attendanceCsvColumns: CsvColumnDef[] = [
  { key: 'full_name', header: 'الطالبة' },
  { key: 'status', header: 'الحالة', transform: v => ({ present: 'حاضرة', absent: 'غائبة', late: 'متأخرة', excused: 'مستأذنة' }[v as string] || v) },
  { key: 'late_reason', header: 'سبب التأخير' },
  { key: 'late_reason_other', header: 'سبب آخر' },
];

interface Student {
  id: string;
  full_name: string;
}

interface AttendanceEntry {
  student_id: string;
  status: string;
  late_reason: string;
  late_reason_other: string;
}

const statusOptions = [
  { value: 'present', label: 'حاضرة', color: 'bg-success/10 text-success' },
  { value: 'absent', label: 'غائبة', color: 'bg-destructive/10 text-destructive' },
  { value: 'late', label: 'متأخرة', color: 'bg-warning/10 text-warning' },
  { value: 'excused', label: 'مستأذنة', color: 'bg-info/10 text-info' },
];

const lateReasons = [
  { value: 'illness', label: 'مرض' },
  { value: 'transport', label: 'مواصلات' },
  { value: 'sleep', label: 'نوم' },
  { value: 'other', label: 'أخرى' },
];

export default function AttendancePage() {
  const { toast } = useToast();
  const [circles, setCircles] = useState<{ id: string; circle_name: string }[]>([]);
  const [selectedCircle, setSelectedCircle] = useState('');
  const [period, setPeriod] = useState('morning');
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>({});
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [date] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    supabase.from('circles').select('id, circle_name').eq('is_active', true)
      .then(({ data }) => setCircles(data || []));
  }, []);

  useEffect(() => {
    if (!selectedCircle) return;
    const load = async () => {
      const { data: studData } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('circle_id', selectedCircle)
        .eq('is_active', true);
      setStudents(studData || []);

      // Check existing attendance
      const { data: attData } = await supabase
        .from('attendance')
        .select('student_id, status, late_reason, late_reason_other')
        .eq('date', date)
        .eq('period', period)
        .in('student_id', (studData || []).map(s => s.id));

      const newEntries: Record<string, AttendanceEntry> = {};
      const existing = new Set<string>();
      (attData || []).forEach(a => {
        newEntries[a.student_id] = {
          student_id: a.student_id,
          status: a.status,
          late_reason: a.late_reason || '',
          late_reason_other: a.late_reason_other || '',
        };
        existing.add(a.student_id);
      });
      // Default: present for all
      (studData || []).forEach(s => {
        if (!newEntries[s.id]) {
          newEntries[s.id] = { student_id: s.id, status: 'present', late_reason: '', late_reason_other: '' };
        }
      });
      setEntries(newEntries);
      setExistingIds(existing);
    };
    load();
  }, [selectedCircle, date, period]);

  const updateEntry = (studentId: string, field: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const toInsert = Object.values(entries).filter(e => !existingIds.has(e.student_id));

    if (toInsert.length === 0) {
      toast({ title: 'تم تسجيل الحضور مسبقاً لهذه الفترة' });
      setSaving(false);
      return;
    }

    // Validate: late_reason required if late
    for (const e of toInsert) {
      if (e.status === 'late' && !e.late_reason) {
        toast({ title: 'تنبيه', description: 'سبب التأخير مطلوب لكل طالبة متأخرة', variant: 'destructive' });
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from('attendance').insert(
      toInsert.map(e => ({
        student_id: e.student_id,
        date,
        period,
        status: e.status,
        late_reason: e.status === 'late' ? e.late_reason : null,
        late_reason_other: e.status === 'late' && e.late_reason === 'other' ? e.late_reason_other : null,
      }))
    );

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `تم تسجيل حضور ${toInsert.length} طالبة بنجاح` });
      setExistingIds(new Set(Object.keys(entries)));
    }
    setSaving(false);
  };

  const stats = Object.values(entries);
  const presentCount = stats.filter(e => e.status === 'present').length;
  const absentCount = stats.filter(e => e.status === 'absent').length;
  const lateCount = stats.filter(e => e.status === 'late').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-foreground">تسجيل الحضور</h1>
        <p className="text-sm text-muted-foreground mt-1">تسجيل الحضور اليومي للطالبات</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label>الحلقة</Label>
              <SearchableSelect
                options={circles.map(c => ({ value: c.id, label: c.circle_name }))}
                value={selectedCircle}
                onValueChange={setSelectedCircle}
                placeholder="اختر الحلقة"
                searchPlaceholder="ابحث عن حلقة..."
              />
            </div>
            <div className="space-y-2 min-w-[150px]">
              <Label>الفترة</Label>
              <SearchableSelect
                options={[{ value: 'morning', label: 'صباحي' }, { value: 'evening', label: 'مسائي' }]}
                value={period}
                onValueChange={setPeriod}
                placeholder="الفترة"
                searchPlaceholder="ابحث..."
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm" dir="ltr">{date}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCircle && students.length > 0 && (
        <>
          {/* Stats */}
          <div className="flex gap-3">
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">حاضرة: {presentCount}</Badge>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">غائبة: {absentCount}</Badge>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">متأخرة: {lateCount}</Badge>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-3">
              {students.map(s => {
                const entry = entries[s.id];
                if (!entry) return null;
                const isExisting = existingIds.has(s.id);
                return (
                  <div key={s.id} className={`p-3 rounded-lg border space-y-2 ${isExisting ? 'bg-muted/30 opacity-70' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.full_name}</span>
                      {isExisting && <Badge variant="outline" className="text-xs">مسجّل</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map(opt => (
                        <button
                          key={opt.value}
                          disabled={isExisting}
                          onClick={() => updateEntry(s.id, 'status', opt.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            entry.status === opt.value ? opt.color + ' border-current' : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {entry.status === 'late' && !isExisting && (
                      <div className="flex gap-2 pt-1">
                        <SearchableSelect
                          className="h-8 text-xs w-32"
                          options={lateReasons.map(r => ({ value: r.value, label: r.label }))}
                          value={entry.late_reason}
                          onValueChange={v => updateEntry(s.id, 'late_reason', v)}
                          placeholder="السبب"
                          searchPlaceholder="ابحث..."
                        />
                        {entry.late_reason === 'other' && (
                          <Input
                            className="h-8 text-xs"
                            placeholder="حدد السبب"
                            value={entry.late_reason_other}
                            onChange={e => updateEntry(s.id, 'late_reason_other', e.target.value)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="sm:w-auto">
              <Save size={18} />
              {saving ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
            </Button>
            <Button variant="outline" size="default" className="gap-1.5" onClick={() => {
              const exportData = students.map(s => ({
                full_name: s.full_name,
                status: entries[s.id]?.status || '',
                late_reason: entries[s.id]?.late_reason || '',
                late_reason_other: entries[s.id]?.late_reason_other || '',
              }));
              exportToCsv(exportData, attendanceCsvColumns, `attendance_${date}_${period}`);
            }}>
              <Download size={14} /> تصدير CSV
            </Button>
          </div>
        </>
      )}

      {selectedCircle && students.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">لا توجد طالبات مسجلات في هذه الحلقة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
