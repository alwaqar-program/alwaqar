import CircleGate from '@/components/teacher/CircleGate';
import { RecitationForm } from '@/pages/teacher/TeacherRecitationPage';
import { CircleType } from '@/lib/circle-type';

/**
 * Like /teacher/recitation but with NO teacher login: lists active circles
 * (of the given `circleType`) so a supervisor picks a circle and records for
 * its students. Attribution goes to the optional «اسم المسجِّلة» field
 * (teacher_id is null). `circleType="sponsor"` powers the الحرم link.
 */
export default function PublicRecitationPage({ circleType = 'regular' }: { circleType?: CircleType }) {
  return (
    <CircleGate title="تسجيل التسميع" subtitle="اختاري الحلقة لعرض طالباتها والتسجيل لهن" needsPeriod dateLabel="تاريخ التسميع" circleType={circleType}>
      {session => <RecitationForm session={session} />}
    </CircleGate>
  );
}
