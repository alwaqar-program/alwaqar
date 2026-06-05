import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Award } from 'lucide-react';
import {
  Interview, RESULT_AR, RESULT_COLOR,
  HOUSING_AR, ABAYA_AR, SERIOUSNESS_AR, getScorePercentage,
} from '@/lib/interview-types';

interface Props {
  interview: Interview;
  committeeMemberName?: string;
  showApplicantName?: string;     // when used in the global list
}

export default function InterviewCard({ interview: i, committeeMemberName, showApplicantName }: Props) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header bar */}
        <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b">
          <div className="space-y-1">
            {showApplicantName && (
              <p className="font-semibold">{showApplicantName}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(i.created_at).toLocaleString('ar-SA', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {committeeMemberName && (
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {committeeMemberName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground">الدرجة</p>
              <p className="text-xl font-display tabular-nums">
                {i.score ?? '—'}<span className="text-xs text-muted-foreground">/{i.max_score}</span>
              </p>
            </div>
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground">النسبة</p>
              <p className="text-xl font-display tabular-nums">
                {getScorePercentage(i.score, i.max_score) ?? '—'}<span className="text-xs text-muted-foreground">%</span>
              </p>
            </div>
            {i.result && (
              <Badge className={`text-sm px-3 py-1 ${RESULT_COLOR[i.result]}`}>
                <Award size={12} className="ms-1" />
                {RESULT_AR[i.result]}
              </Badge>
            )}
          </div>
        </div>

        {/* Two columns: personal + exam */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">المقابلة الشخصية</h4>
            <Field label="التخصص" value={i.specialization} />
            <Field
              label="السكن المشترك"
              value={i.accepts_shared_housing ? HOUSING_AR[i.accepts_shared_housing] : null}
            />
            {i.accepts_shared_housing === 'with_companions' && (
              <>
                <Field label="تفصيل المرافقات" value={i.shared_housing_details} />
                <Field
                  label="مسجلات في رابط المرافقات"
                  value={i.companions_registered === null ? null : i.companions_registered ? 'نعم' : 'لا'}
                />
              </>
            )}
            <Field
              label="العباءة واللباس"
              value={i.abaya_status ? ABAYA_AR[i.abaya_status] : null}
            />
            <Field
              label="الجدية"
              value={i.seriousness ? SERIOUSNESS_AR[i.seriousness] : null}
            />
            <Field
              label="احترام الضوابط"
              value={i.respects_rules === null ? null : i.respects_rules ? 'نعم' : 'لا'}
            />
            {i.personal_notes && (
              <Field label="ملاحظات" value={i.personal_notes} multiline />
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">اختبار القرآن</h4>
            <Field
              label="الاستعداد المسبق"
              value={i.prior_preparation === null ? null : i.prior_preparation ? 'نعم' : 'لا'}
            />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Stat label="أخطاء" value={i.errors_count} />
              <Stat label="لحون" value={i.lahn_count} />
              <Stat label="استرسال" value={i.continuity_count} />
            </div>
            {i.exam_notes && (
              <Field label="ملاحظات الاختبار" value={i.exam_notes} multiline />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, multiline = false }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  if (!value) return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-muted-foreground">—</span>
    </div>
  );
  return (
    <div className={multiline ? 'space-y-1' : 'flex justify-between gap-2'}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={multiline ? 'block text-sm whitespace-pre-wrap' : 'text-end'}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-2 text-center bg-muted/30">
      <p className="text-lg font-display tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
