import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { User, BookOpen, ClipboardCheck, FileCheck } from 'lucide-react';

const statusLabels: Record<string, string> = {
  candidate: 'مرشحة', interview_scheduled: 'مقابلة مجدولة', preliminary_accepted: 'قبول مبدئي',
  preliminary_evaluation: 'تقييم مبدئي', conditionally_accepted: 'مقبولة مشروطة', on_hold: 'معلقة',
  final_accepted: 'قبول نهائي', final_evaluation: 'تقييم نهائي', registered: 'مسجلة',
  withdrawn: 'منسحبة', expelled: 'مفصولة', rejected: 'مرفوضة',
};

const attendanceLabels: Record<string, string> = {
  present: 'حاضرة', absent: 'غائبة', late: 'متأخرة', excused: 'مستأذنة',
};

const examTypes: Record<string, string> = {
  weekly_1: 'الأسبوع الأول', weekly_2: 'الأسبوع الثاني', final: 'النهائي',
  quarter: 'ربع', half: 'نصف', complete: 'ختم',
};

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<any>(null);
  const [recitations, setRecitations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [sRes, rRes, aRes, eRes] = await Promise.all([
        supabase.from('students').select('*, circles(circle_name, branches(branch_name)), rooms(room_number)').eq('id', id).single(),
        supabase.from('recitation_log').select('*').eq('student_id', id).eq('is_deleted', false).order('date', { ascending: false }).limit(50),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false }).limit(50),
        supabase.from('exams').select('*').eq('student_id', id).eq('is_deleted', false),
      ]);
      setStudent(sRes.data);
      setRecitations(rRes.data || []);
      setAttendance(aRes.data || []);
      setExams(eRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;
  if (!student) return <div className="text-center py-12 text-destructive">الطالبة غير موجودة</div>;

  const totalPages = recitations.reduce((sum, r) => sum + (r.pages_recited || 0), 0);
  const presentDays = attendance.filter(a => a.status === 'present').length;
  const totalDays = attendance.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display text-foreground">{student.full_name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="outline">{statusLabels[student.admission_status]}</Badge>
            {student.circles && <Badge variant="secondary">{student.circles.circle_name}</Badge>}
            {student.circles?.branches && <Badge variant="secondary">{student.circles.branches.branch_name}</Badge>}
            {student.rooms && <Badge variant="outline">غرفة {student.rooms.room_number}</Badge>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{exams.length}</p>
            <p className="text-xs text-muted-foreground">اختبارات</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">الملف الشخصي</TabsTrigger>
          <TabsTrigger value="recitation">التسميع</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
          <TabsTrigger value="exams">الاختبارات</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-4 grid grid-cols-2 gap-4 text-sm">
              {[
                ['رقم الهوية', student.national_id],
                ['الهاتف', student.phone],
                ['البريد', student.email],
                ['هاتف ولي الأمر', student.guardian_phone],
                ['الجنسية', student.nationality],
                ['المؤهل', student.qualification],
                ['من سورة', student.from_surah],
                ['إلى سورة', student.to_surah],
                ['تاريخ التسجيل', student.registration_date],
                ['التعهد', student.agreement_signed ? 'تم التوقيع' : 'لم يتم'],
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
                          {attendanceLabels[a.status]}
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

        <TabsContent value="exams">
          {exams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileCheck size={32} className="mx-auto mb-2 opacity-30" />
                لا توجد اختبارات
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الأخطاء</TableHead>
                    <TableHead>اللحون</TableHead>
                    <TableHead>تغيير المقطع</TableHead>
                    <TableHead>المجموع</TableHead>
                    <TableHead>الدرجة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map(e => (
                    <TableRow key={e.id}>
                      <TableCell><Badge variant="outline">{examTypes[e.exam_type] ?? e.exam_type}</Badge></TableCell>
                      <TableCell dir="ltr">{e.date}</TableCell>
                      <TableCell>{e.errors_section_1}</TableCell>
                      <TableCell>{e.errors_section_2}</TableCell>
                      <TableCell>{e.segment_changes ?? 0}</TableCell>
                      <TableCell>{e.total_errors}</TableCell>
                      <TableCell className="font-bold">{e.total_score} / {e.max_score}</TableCell>
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
