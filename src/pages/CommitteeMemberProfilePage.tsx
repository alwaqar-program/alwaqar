import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, AlertCircle, MessagesSquare, Calendar } from 'lucide-react';
import {
  CommitteeMember, Interview, ResultGrade,
  RESULT_AR, RESULT_COLOR, getScorePercentage,
} from '@/lib/interview-types';

interface ApplicantLite {
  id: string;
  full_name: string | null;
  national_id: string | null;
  desired_branch: string | null;
}

interface JoinedInterview extends Interview {
  applicant: ApplicantLite | null;
}

export default function CommitteeMemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [member, setMember] = useState<CommitteeMember | null>(null);
  const [interviews, setInterviews] = useState<JoinedInterview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [mRes, iRes, aRes] = await Promise.all([
      (supabase as any).from('interview_committee').select('*').eq('id', id).maybeSingle(),
      (supabase as any).from('interviews').select('*').eq('committee_member_id', id).order('created_at', { ascending: false }),
      (supabase as any).from('applicants').select('id,full_name,national_id,desired_branch'),
    ]);

    if (mRes.error || !mRes.data) {
      toast({ title: 'تعذّر تحميل بيانات العضوة', variant: 'destructive' });
      setLoading(false);
      return;
    }
    setMember(mRes.data as CommitteeMember);

    const apps: Record<string, ApplicantLite> = {};
    for (const a of (aRes.data ?? []) as ApplicantLite[]) apps[a.id] = a;

    const joined: JoinedInterview[] = ((iRes.data ?? []) as Interview[]).map((i) => ({
      ...i,
      applicant: apps[i.applicant_id] ?? null,
    }));
    setInterviews(joined);
    setLoading(false);
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const stats = useMemo(() => {
    const total = interviews.length;
    const byResult: Record<ResultGrade, number> = {
      excellent: 0, very_good: 0, good: 0, acceptable: 0, weak: 0,
    };
    let scoreSum = 0;
    let pctSum = 0;
    let pctCount = 0;
    for (const i of interviews) {
      if (i.result) byResult[i.result]++;
      if (i.score != null) {
        scoreSum += Number(i.score);
        const p = getScorePercentage(i.score, i.max_score);
        if (p != null) { pctSum += p; pctCount++; }
      }
    }
    return {
      total,
      byResult,
      avgScore: total > 0 ? Number((scoreSum / total).toFixed(1)) : null,
      avgPercentage: pctCount > 0 ? Number((pctSum / pctCount).toFixed(1)) : null,
    };
  }, [interviews]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (!member) {
    return (
      <div className="p-8 text-center text-destructive flex flex-col items-center gap-3">
        <AlertCircle size={32} />
        <div>لم يتم العثور على العضوة</div>
        <Button variant="outline" onClick={() => navigate('/interview-committee')}>
          ← العودة للقائمة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowRight size={16} />
        العودة للقائمة
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-2">
            <MessagesSquare size={28} className="text-primary" />
            {member.full_name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {member.is_active
              ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">نشطة</Badge>
              : <Badge variant="secondary">معطّلة</Badge>}
            <span className="text-xs text-muted-foreground">
              أُضيفت في {new Date(member.created_at).toLocaleDateString('ar-SA')}
            </span>
          </div>
          {member.notes && (
            <p className="text-sm text-muted-foreground mt-3 max-w-prose">{member.notes}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="إجمالي المقابلات" value={stats.total} />
        <Stat
          label="متوسط الدرجة"
          value={stats.avgScore ?? '—'}
        />
        <Stat
          label="متوسط النسبة"
          value={stats.avgPercentage != null ? `${stats.avgPercentage}%` : '—'}
        />
        <Stat
          label="ممتاز"
          value={stats.byResult.excellent}
          color="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="جيد جداً" value={stats.byResult.very_good} color="text-sky-600" />
        <Stat label="جيد" value={stats.byResult.good} color="text-amber-600" />
        <Stat label="مقبول" value={stats.byResult.acceptable} color="text-orange-600" />
        <Stat label="ضعيف" value={stats.byResult.weak} color="text-rose-600" />
      </div>

      {/* Interviews table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar size={18} />
            الطالبات اللواتي قابلتهن
            <Badge variant="outline" className="ms-auto tabular-nums">{interviews.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              لم تُجرِ هذه العضوة أي مقابلات بعد.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالبة</TableHead>
                    <TableHead className="text-right">الدرجة</TableHead>
                    <TableHead className="text-right">النسبة</TableHead>
                    <TableHead className="text-right">النتيجة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.map((i) => (
                    <TableRow
                      key={i.id}
                      className="cursor-pointer"
                      onClick={() => i.applicant && navigate(`/applicants/${i.applicant.id}`)}
                    >
                      <TableCell className="font-medium">
                        {i.applicant?.full_name ?? '(محذوفة)'}
                        {i.applicant?.national_id && (
                          <p className="text-xs text-muted-foreground tabular-nums">{i.applicant.national_id}</p>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {i.score ?? '—'}<span className="text-muted-foreground text-xs">/{i.max_score}</span>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {getScorePercentage(i.score, i.max_score) ?? '—'}
                        <span className="text-muted-foreground text-xs">%</span>
                      </TableCell>
                      <TableCell>
                        {i.result
                          ? <Badge className={RESULT_COLOR[i.result]}>{RESULT_AR[i.result]}</Badge>
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(i.created_at).toLocaleString('ar-SA', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); i.applicant && navigate(`/applicants/${i.applicant.id}`); }}
                        >
                          عرض الطالبة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 text-center">
        <p className={`text-2xl font-display tabular-nums ${color ?? ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
