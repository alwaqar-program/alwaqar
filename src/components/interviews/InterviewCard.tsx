import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Award, ThumbsUp, ThumbsDown, FileText } from 'lucide-react';
import {
  Interview, RESULT_AR, RESULT_COLOR,
  HOUSING_AR, ABAYA_AR, SERIOUSNESS_AR, getScorePercentage,
} from '@/lib/interview-types';

interface Props {
  interview: Interview;
  committeeMemberName?: string;
  showApplicantName?: string;
}

export default function InterviewCard({ interview: i, committeeMemberName, showApplicantName }: Props) {
  const hasTextBlocks = i.strengths || i.weaknesses || i.personal_notes;

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-5">
        {/* Header bar */}
        <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b">
          <div className="space-y-1">
            {showApplicantName && (
              <p className="font-semibold">{showApplicantName}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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

        {/* SECTION: المقابلة الشخصية */}
        <section>
          <h4 className="text-xs font-bold text-primary uppercase mb-3 pb-1.5 border-b border-primary/20">
            المقابلة الشخصية
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            <Row label="التخصص" value={i.specialization} />
            <Row
              label="السكن المشترك"
              value={i.accepts_shared_housing ? HOUSING_AR[i.accepts_shared_housing] : null}
            />
            {i.accepts_shared_housing === 'with_companions' && (
              <>
                <Row label="تفصيل المرافقات" value={i.shared_housing_details} />
                <Row
                  label="مسجلات في رابط المرافقات"
                  value={i.companions_registered === null ? null : i.companions_registered ? 'نعم' : 'لا'}
                />
              </>
            )}
            <Row
              label="العباءة واللباس"
              value={i.abaya_status ? ABAYA_AR[i.abaya_status] : null}
            />
            <Row
              label="الجدية"
              value={i.seriousness ? SERIOUSNESS_AR[i.seriousness] : null}
            />
            <Row
              label="احترام الضوابط"
              value={i.respects_rules === null ? null : i.respects_rules ? 'نعم' : 'لا'}
            />
          </div>
        </section>

        {/* Text blocks: strengths / weaknesses / notes */}
        {hasTextBlocks && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {i.strengths && (
              <TextBlock
                label="نقاط القوة"
                value={i.strengths}
                icon={<ThumbsUp size={13} />}
                tone="positive"
              />
            )}
            {i.weaknesses && (
              <TextBlock
                label="نقاط الضعف"
                value={i.weaknesses}
                icon={<ThumbsDown size={13} />}
                tone="negative"
              />
            )}
            {i.personal_notes && (
              <TextBlock
                label="ملاحظات"
                value={i.personal_notes}
                icon={<FileText size={13} />}
                tone="neutral"
                fullWidth={!(i.strengths && i.weaknesses)}
              />
            )}
          </section>
        )}

        {/* SECTION: اختبار القرآن */}
        <section className="pt-2">
          <h4 className="text-xs font-bold text-primary uppercase mb-3 pb-1.5 border-b border-primary/20">
            اختبار القرآن
          </h4>

          <Row
            label="الاستعداد المسبق"
            value={i.prior_preparation === null ? null : i.prior_preparation ? 'نعم' : 'لا'}
          />

          <div className="grid grid-cols-3 gap-2 mt-3">
            <Stat label="أخطاء" value={i.errors_count} />
            <Stat label="لحون" value={i.lahn_count} />
            <Stat label="استرسال" value={i.continuity_count} />
          </div>

          {i.exam_notes && (
            <div className="mt-3">
              <TextBlock
                label="ملاحظات الاختبار"
                value={i.exam_notes}
                icon={<FileText size={13} />}
                tone="neutral"
                fullWidth
              />
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/* ────────── Sub-components ────────── */

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-dashed border-border/60 last:border-b-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-sm ${value ? 'font-medium' : 'text-muted-foreground'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function TextBlock({
  label, value, icon, tone, fullWidth = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'positive' | 'negative' | 'neutral';
  fullWidth?: boolean;
}) {
  const toneClass = {
    positive: 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20',
    negative: 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/20',
    neutral:  'border-border bg-muted/40',
  }[tone];
  const iconColor = {
    positive: 'text-emerald-600',
    negative: 'text-amber-600',
    neutral:  'text-muted-foreground',
  }[tone];

  return (
    <div className={`rounded-lg border ${toneClass} p-3 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={iconColor}>{icon}</span>
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>
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
