import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Applicant } from '@/lib/applicant-labels';
import { HousingAnswer, HOUSING_AR } from '@/lib/interview-types';

const HOUSING_UNSET = 'unset';

/**
 * Staff view of the applicant's roommate preferences collected via the public
 * /roommates page. Resolves linked applicant picks to clickable names. Also
 * surfaces the "السكن المشترك" answer recorded on her interview, editable
 * here so staff don't need to reopen the interview form to change it.
 */
export default function ApplicantRoommateSection({ applicant }: { applicant: Applicant }) {
  const { toast } = useToast();
  const [names, setNames] = useState<Record<string, string>>({});

  const [housingInterviewId, setHousingInterviewId] = useState<string | null>(null);
  const [housingValue, setHousingValue] = useState<HousingAnswer | null>(null);
  const [housingLoading, setHousingLoading] = useState(true);
  const [savingHousing, setSavingHousing] = useState(false);

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

  // Pull the latest interview's housing answer (the field lives on
  // `interviews`, not on the applicant row).
  useEffect(() => {
    let cancelled = false;
    setHousingLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('interviews')
        .select('id, accepts_shared_housing')
        .eq('applicant_id', applicant.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setHousingInterviewId(data?.id ?? null);
      setHousingValue(data?.accepts_shared_housing ?? null);
      setHousingLoading(false);
    })();
    return () => { cancelled = true; };
  }, [applicant.id]);

  async function handleHousingChange(v: string) {
    if (!housingInterviewId) return;
    const next = v === HOUSING_UNSET ? null : (v as HousingAnswer);
    setSavingHousing(true);
    const { error } = await (supabase as any)
      .from('interviews')
      .update({ accepts_shared_housing: next })
      .eq('id', housingInterviewId);
    setSavingHousing(false);
    if (error) {
      toast({ title: 'تعذّر حفظ السكن المشترك', description: error.message, variant: 'destructive' });
      return;
    }
    setHousingValue(next);
  }

  const housingField = (
    <div className="flex justify-between items-center gap-4">
      <dt className="text-muted-foreground shrink-0">السكن المشترك</dt>
      <dd>
        {housingLoading ? (
          <span className="text-muted-foreground text-xs">جارٍ التحميل…</span>
        ) : !housingInterviewId ? (
          <span className="text-muted-foreground text-xs">لم تُجرَ مقابلة بعد</span>
        ) : (
          <Select
            value={housingValue ?? HOUSING_UNSET}
            onValueChange={handleHousingChange}
            disabled={savingHousing}
          >
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={HOUSING_UNSET}>غير محدد</SelectItem>
              {(Object.entries(HOUSING_AR) as [HousingAnswer, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </dd>
    </div>
  );

  // Not submitted yet → quiet placeholder so staff know it's still pending,
  // but the housing field (independent of the roommate form) still shows.
  if (!applicant.roommate_submitted_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">زميلات السكن</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            {housingField}
          </dl>
          <p className="text-sm text-muted-foreground mt-3">لم تُرسل الطالبة تفضيلات السكن بعد.</p>
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
          {housingField}

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
