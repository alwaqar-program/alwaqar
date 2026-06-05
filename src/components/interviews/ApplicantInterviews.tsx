import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessagesSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Interview, CommitteeMember } from '@/lib/interview-types';
import InterviewCard from './InterviewCard';

interface Props {
  applicantId: string;
}

export default function ApplicantInterviews({ applicantId }: Props) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [members, setMembers] = useState<Record<string, CommitteeMember>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [iRes, cRes] = await Promise.all([
        (supabase as any)
          .from('interviews')
          .select('*')
          .eq('applicant_id', applicantId)
          .order('created_at', { ascending: false }),
        (supabase as any).from('interview_committee').select('id,full_name,is_active,notes,created_at'),
      ]);
      const list = (iRes.data ?? []) as Interview[];
      setInterviews(list);
      const memberMap: Record<string, CommitteeMember> = {};
      for (const m of (cRes.data ?? []) as CommitteeMember[]) memberMap[m.id] = m;
      setMembers(memberMap);
      setLoading(false);
    })();
  }, [applicantId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessagesSquare size={18} />
          المقابلات
          {!loading && (
            <Badge variant="outline" className="ms-auto tabular-nums">
              {interviews.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : interviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            لم تُجرَ مقابلة لهذه المتقدمة بعد.
          </p>
        ) : (
          <div className="space-y-4">
            {interviews.map((i) => (
              <InterviewCard
                key={i.id}
                interview={i}
                committeeMemberName={
                  i.committee_member_name
                  ?? (i.committee_member_id ? members[i.committee_member_id]?.full_name : undefined)
                  ?? undefined
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
