import CircleGate from '@/components/teacher/CircleGate';
import { RecitationForm } from '@/pages/teacher/TeacherRecitationPage';
import { CircleType } from '@/lib/circle-type';

/**
 * Like /teacher/recitation but with NO teacher login: lists active circles
 * (of the given `circleType`) so a supervisor picks a circle and records for
 * its students. Attribution goes to the optional «اسم المسجِّلة» field
 * (teacher_id is null). `circleType="sponsor"` powers the الحرم link.
 *
 * `enableExam` adds, after a student is picked, a تسميع/اختبار choice; on a
 * scheduled exam day (see exam-schedule.ts) اختبار records into `exams` with
 * the day's fixed type. Recitation flow is otherwise unchanged.
 */
export default function PublicRecitationPage({ circleType = 'regular' }: { circleType?: CircleType }) {
  return (
    <CircleGate title="تسجيل التسميع" subtitle="اختاري الحلقة لعرض طالباتها والتسجيل لهن" needsPeriod dateLabel="تاريخ التسميع" circleType={circleType}>
      {session => <RecitationForm session={session} enableExam />}
    </CircleGate>
  );
}
