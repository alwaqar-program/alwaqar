import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { HeartHandshake, BookOpen, ClipboardCheck } from 'lucide-react';

const attendanceLabels: Record<string, string> = {
  present: 'حاضرة', absent: 'غائبة', late: 'متأخرة', excused: 'مستأذنة', exempted: 'معفاة',
};

const ageCategoryLabel: Record<string, string> = {
  under_16: 'أقل من 16', over_35: 'أكثر من 35',
};

export default function CompanionProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [companion, setCompanion] = useState<any>(null);
  const [recitations, setRecitations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      // companions/recitation_log(companion_id) خارج الأنواع المولّدة — نفس نمط بقية الصفحات
      const [cRes, rRes, aRes] = await Promise.all([
        (supabase as any).from('companions').select('*, circles(circle_name, branches(branch_name))').eq('id', id).single(),
        (supabase as any).from('recitation_log').select('*').eq('companion_id', id).eq('is_deleted', false).order('date', { ascending: false }).limit(50),
        (supabase as any).from('attendance').select('*').eq('companion_id', id).order('date', { ascending: false }).limit(50),
      ]);
      setCompanion(cRes.data);
      setRecitations(rRes.data || []);
      setAttendance(aRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;
  if (!companion) return <div className="text-center py-12 text-destructive">المرافِقة غير موجودة</div>;

  const totalPages = recitations.reduce((sum, r) => sum + (r.pages_recited || 0), 0);
  const presentDays = attendance.filter(a => a.status === 'present').length;
  const totalDays = attendance.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <HeartHandshake size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display text-foreground">{companion.full_name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="outline">مرافِقة</Badge>
            {companion.age_category && <Badge variant="secondary">{ageCategoryLabel[companion.age_category] ?? companion.age_category}</Badge>}
            {companion.circles && <Badge variant="secondary">{companion.circles.circle_name}</Badge>}
            {companion.circles?.branches && <Badge variant="secondary">{companion.circles.branches.branch_name}</Badge>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{totalPages}</p>
            <p className="text-xs text-muted-foreground">صفحات مسمّعة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{recitations.length}</p>
            <p className="text-xs text-muted-foreground">جلسات تسميع</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">نسبة الحضور</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">الملف الشخصي</TabsTrigger>
          <TabsTrigger value="recitation">التسميع</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-4 grid grid-cols-2 gap-4 text-sm">
              {[
                ['رقم الهوية', companion.national_id],
                ['الهاتف', companion.phone],
                ['هاتف ولي الأمر', companion.guardian_phone],
                ['الجنسية', companion.nationality],
                ['من سورة', companion.from_surah],
                ['إلى سورة', companion.to_surah],
                ['تاريخ الانتقال', companion.moved_at ? String(companion.moved_at).slice(0, 10) : null],
                ['سبب الانتقال', companion.move_reason],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-medium mr-2">{value || '-'}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recitation">
          {recitations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                لا توجد سجلات تسميع
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>من</TableHead>
                    <TableHead>إلى</TableHead>
                    <TableHead>الصفحات</TableHead>
                    <TableHead>الأخطاء</TableHead>
                    <TableHead>اللحون</TableHead>
                    <TableHead>الدرجة /20</TableHead>
                    <TableHead>التقدير</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recitations.map(r => (
                    <TableRow key={r.id}>
                      <TableCell dir="ltr">{r.date}</TableCell>
                      <TableCell>{r.from_surah} ص{r.from_page}</TableCell>
                      <TableCell>{r.to_surah} ص{r.to_page}</TableCell>
                      <TableCell>{r.pages_recited}</TableCell>
                      <TableCell>{r.error_count}</TableCell>
                      <TableCell>{r.lahn_count ?? 0}</TableCell>
                      <TableCell className="font-bold">{r.score}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.grade}</Badge>
                        {r.is_extra_memorization && <Badge variant="secondary" className="mr-1 text-xs">زيادة</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          {attendance.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardCheck size={32} className="mx-auto mb-2 opacity-30" />
                لا توجد سجلات حضور
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الفترة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>سبب التأخير</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map(a => (
                    <TableRow key={a.id}>
                      <TableCell dir="ltr">{a.date}</TableCell>
                      <TableCell>{a.period === 'morning' ? 'صباحي' : 'مسائي'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          a.status === 'present' ? 'bg-success/10 text-success' :
                          a.status === 'absent' ? 'bg-destructive/10 text-destructive' :
                          a.status === 'late' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
                        }>
                          {attendanceLabels[a.status] ?? a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{a.late_reason || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
