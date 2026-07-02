import CircleGate from '@/components/teacher/CircleGate';
import { AttendanceForm } from '@/pages/teacher/TeacherAttendancePage';

/**
 * Like /teacher/attendance but with NO teacher login: lists all active circles
 * so a supervisor picks a circle and records attendance for its students.
 * Attribution goes to the optional «اسم المسجِّلة» field (recorded_by).
 */
export default function PublicAttendancePage() {
  return (
    <CircleGate title="تسجيل الحضور" subtitle="اختاري الحلقة لعرض طالباتها وتسجيل حضورهن" needsPeriod dateLabel="تاريخ الحضور">
      {session => <AttendanceForm session={session} />}
    </CircleGate>
  );
}
