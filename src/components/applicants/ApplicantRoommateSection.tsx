import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Applicant } from '@/lib/applicant-labels';

/**
 * Staff view of the applicant's roommate preferences collected via the public
 * /roommates page. Resolves linked applicant picks to clickable names.
 */
export default function ApplicantRoommateSection({ applicant }: { applicant: Applicant }) {
  const [names, setNames] = useState<Record<string, string>>({});

  const linkedIds = [applicant.roommate_1_applicant_id, applicant.roommate_2_applicant_id]
    .filter((x): x is string => !!x);

  useEffect(() => {
    if (linkedIds.length === 0) { setNames({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('applicants')
        .select('id, full_name')
        .in('id', linkedIds);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      for (const r of data as Array<{ id: string; full_name: string | null }>) {
        map[r.id] = r.full_name ?? '—';
      }
      setNames(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant.roommate_1_applicant_id, applicant.roommate_2_applicant_id]);

  // Not submitted yet → quiet placeholder so staff know it's still pending.
  if (!applicant.roommate_submitted_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">زميلات السكن</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">لم تُرسل الطالبة تفضيلات السكن بعد.</p>
        </CardContent>
      </Card>
    );
  }

  const renderSlot = (id: string | null, other: string | null) => {
    if (id) {
      return (
        <Link to={`/applicants/${id}`} className="text-primary hover:underline">
          {names[id] ?? '…'}
        </Link>
      );
    }
    if (other) return <span>{other} <span className="text-xs text-muted-foreground">(غير مسجَّلة)</span></span>;
    return <span className="text-muted-foreground">—</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">زميلات السكن</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">ترغب بزميلات محددات</dt>
            <dd>
              {applicant.roommate_wants_specific
                ? <Badge className="bg-emerald-600 hover:bg-emerald-600">نعم</Badge>
                : <Badge variant="outline">لا</Badge>}
            </dd>
          </div>

          {applicant.roommate_wants_specific && (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground shrink-0">الزميلة الأولى</dt>
                <dd className="text-left">{renderSlot(applicant.roommate_1_applicant_id, applicant.roommate_1_other_name)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground shrink-0">الزميلة الثانية</dt>
                <dd className="text-left">{renderSlot(applicant.roommate_2_applicant_id, applicant.roommate_2_other_name)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground shrink-0">أقرّت بالتنسيق المسبق</dt>
                <dd>{applicant.roommate_arranged_confirmed ? 'نعم' : 'لا'}</dd>
              </div>
            </>
          )}

          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">تاريخ الإرسال</dt>
            <dd className="text-left tabular-nums">
              {new Date(applicant.roommate_submitted_at).toLocaleString('ar-SA', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
