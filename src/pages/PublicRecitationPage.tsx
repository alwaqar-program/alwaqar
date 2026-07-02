import CircleGate from '@/components/teacher/CircleGate';
import { RecitationForm } from '@/pages/teacher/TeacherRecitationPage';

/**
 * Like /teacher/recitation but with NO teacher login: lists all active circles
 * so a supervisor picks a circle and records for its students. Attribution goes
 * to the optional «اسم المسجِّلة» field (teacher_id is null).
 */
export default function PublicRecitationPage() {
  return (
    <CircleGate title="تسجيل التسميع" subtitle="اختاري الحلقة لعرض طالباتها والتسجيل لهن" needsPeriod dateLabel="تاريخ التسميع">
      {session => <RecitationForm session={session} />}
    </CircleGate>
  );
}
