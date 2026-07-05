import CircleGate from '@/components/teacher/CircleGate';
import { AttendanceForm } from '@/pages/teacher/TeacherAttendancePage';
import { CircleType } from '@/lib/circle-type';

/**
 * Like /teacher/attendance but with NO teacher login: lists active circles
 * (of the given `circleType`) so a supervisor picks a circle and records
 * attendance for its students, companions (المرافقات) and beginners (المبتدئات)
 * via the cohort switch. Attribution goes to the optional «اسم المسجِّلة» field
 * (recorded_by). `circleType="sponsor"` powers the الحرم link.
 */
export default function PublicAttendancePage({ circleType = 'regular' }: { circleType?: CircleType }) {
  return (
    <CircleGate title="تسجيل الحضور" subtitle="اختاري الحلقة لتسجيل حضور الطالبات والمرافقات والمبتدئات" needsPeriod dateLabel="تاريخ الحضور" circleType={circleType}>
      {session => <AttendanceForm session={session} />}
    </CircleGate>
  );
}
