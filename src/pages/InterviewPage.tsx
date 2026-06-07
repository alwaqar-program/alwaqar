import { useState, useEffect, useLayoutEffect, useMemo, FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle2, AlertCircle, ChevronsUpDown, KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  Applicant, STATUS_AR, BRANCH_AR,
} from '@/lib/applicant-labels';
import {
  CommitteeMember, HousingAnswer, AbayaAnswer, SeriousnessAnswer,
  HOUSING_AR, ABAYA_AR, SERIOUSNESS_AR, RESULT_AR, RESULT_COLOR,
  getMaxScore, calculateScore, getResultGrade, getScorePercentage,
} from '@/lib/interview-types';
import logoImg from '@/assets/logo.png';

// How long an unlocked session is valid before the code is required again.
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export default function InterviewPage() {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const prev = document.title;
    document.title = 'مقابلة طالبات الوقار';
    return () => { document.title = prev; };
  }, []);

  // Gate: every fresh load (refresh, new tab) requires the code again.
  // Session resets automatically after SESSION_DURATION_MS.
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    const timer = setTimeout(() => {
      setUnlocked(false);
      toast({
        title: 'انتهت الجلسة',
        description: 'مرّت ساعتان. يرجى إدخال رمز الدخول مرة أخرى.',
      });
    }, SESSION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [unlocked, toast]);

  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [applicants, setApplicants] = useState<Pick<Applicant,
    'id' | 'full_name' | 'national_id' | 'phone' | 'age' | 'age_category' |
    'memorized_juz_count' | 'from_surah' | 'to_surah' | 'desired_branch' |
    'previously_joined' | 'previous_branch' |
    'has_companions' | 'companions_details' | 'accompanying_with' | 'status'
  >[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [committeeId, setCommitteeId] = useState<string>('');
  const [applicantId, setApplicantId] = useState<string>('');
  const [applicantSearchOpen, setApplicantSearchOpen] = useState(false);

  // Form: personal
  const [specialization, setSpecialization] = useState('');
  const [willAttendFullCourse, setWillAttendFullCourse] = useState<'yes' | 'no' | ''>('');
  const [acceptsHousing, setAcceptsHousing] = useState<HousingAnswer | ''>('');
  const [housingDetails, setHousingDetails] = useState('');
  const [companionsRegistered, setCompanionsRegistered] = useState<'yes' | 'no' | ''>('');
  const [companionsNotes, setCompanionsNotes] = useState('');
  const [abayaStatus, setAbayaStatus] = useState<AbayaAnswer | ''>('');
  const [seriousness, setSeriousness] = useState<SeriousnessAnswer | ''>('');
  const [respectsRules, setRespectsRules] = useState<'yes' | 'no' | ''>('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');

  // Form: exam
  const [priorPreparation, setPriorPreparation] = useState<'yes' | 'no' | ''>('');
  const [requestedPassageChange, setRequestedPassageChange] = useState<boolean>(false);
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [lahnCount, setLahnCount] = useState<number>(0);
  const [continuityCount, setContinuityCount] = useState<number>(0);
  const [examNotes, setExamNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!unlocked) { setLoading(false); return; }
    (async () => {
      const [cRes, aRes, iRes] = await Promise.all([
        (supabase as any)
          .from('interview_committee')
          .select('*')
          .eq('is_active', true)
          .order('full_name'),
        (supabase as any)
          .from('applicants')
          .select('id,full_name,national_id,phone,age,age_category,memorized_juz_count,from_surah,to_surah,desired_branch,previously_joined,previous_branch,has_companions,companions_details,accompanying_with,status')
          .eq('age_category', '16_to_35')
          .eq('status', 'pledged')
          .order('full_name'),
        // exclude anyone who already has at least one interview row
        (supabase as any).from('interviews').select('applicant_id'),
      ]);
      if (cRes.error) toast({ title: 'تعذّر تحميل اللجنة', description: cRes.error.message, variant: 'destructive' });
      else setCommittee(cRes.data ?? []);
      if (aRes.error) {
        toast({ title: 'تعذّر تحميل الطالبات', description: aRes.error.message, variant: 'destructive' });
      } else {
        const alreadyInterviewed = new Set(
          ((iRes.data ?? []) as { applicant_id: string }[]).map((r) => r.applicant_id)
        );
        const eligible = (aRes.data ?? []).filter((a: any) => !alreadyInterviewed.has(a.id));
        setApplicants(eligible);
      }
      setLoading(false);
    })();
  }, [toast, unlocked]);

  const selectedApplicant = useMemo(
    () => applicants.find(a => a.id === applicantId) ?? null,
    [applicants, applicantId]
  );

  const maxScore = useMemo(
    () => selectedApplicant ? getMaxScore(selectedApplicant.desired_branch) : 30,
    [selectedApplicant]
  );

  const score = useMemo(
    () => calculateScore(
      maxScore,
      errorsCount || 0,
      lahnCount || 0,
      continuityCount || 0,
      requestedPassageChange,
    ),
    [maxScore, errorsCount, lahnCount, continuityCount, requestedPassageChange]
  );

  const result = useMemo(() => getResultGrade(score, maxScore), [score, maxScore]);

  function reset() {
    setCommitteeId('');
    setApplicantId('');
    setSpecialization('');
    setWillAttendFullCourse('');
    setAcceptsHousing('');
    setHousingDetails('');
    setCompanionsRegistered('');
    setCompanionsNotes('');
    setAbayaStatus('');
    setSeriousness('');
    setRespectsRules('');
    setStrengths('');
    setWeaknesses('');
    setPersonalNotes('');
    setPriorPreparation('');
    setRequestedPassageChange(false);
    setErrorsCount(0);
    setLahnCount(0);
    setContinuityCount(0);
    setExamNotes('');
    setDone(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!committeeId) { toast({ title: 'يرجى اختيار العضوة', variant: 'destructive' }); return; }
    if (!applicantId) { toast({ title: 'يرجى اختيار الطالبة', variant: 'destructive' }); return; }

    setSubmitting(true);
    const selectedCommittee = committee.find(c => c.id === committeeId);
    const payload = {
      applicant_id: applicantId,
      committee_member_id: committeeId,
      committee_member_name: selectedCommittee?.full_name ?? null,
      specialization: specialization.trim() || null,
      will_attend_full_course: willAttendFullCourse === '' ? null : willAttendFullCourse === 'yes',
      accepts_shared_housing: acceptsHousing || null,
      shared_housing_details: housingDetails.trim() || null,
      companions_registered: companionsRegistered === '' ? null : companionsRegistered === 'yes',
      companions_notes: companionsNotes.trim() || null,
      abaya_status: abayaStatus || null,
      seriousness: seriousness || null,
      respects_rules: respectsRules === '' ? null : respectsRules === 'yes',
      strengths: strengths.trim() || null,
      weaknesses: weaknesses.trim() || null,
      personal_notes: personalNotes.trim() || null,
      prior_preparation: priorPreparation === '' ? null : priorPreparation === 'yes',
      requested_passage_change: requestedPassageChange,
      errors_count: errorsCount || 0,
      lahn_count: lahnCount || 0,
      continuity_count: continuityCount || 0,
      max_score: maxScore,
      score: score,
      result: result,
      exam_notes: examNotes.trim() || null,
    };

    const { error } = await (supabase as any).from('interviews').insert(payload);
    setSubmitting(false);

    if (error) {
      toast({ title: 'تعذّر حفظ المقابلة', description: error.message, variant: 'destructive' });
      return;
    }

    // Update applicant status to interview_completed (only forward, never backward)
    const FORWARD_STATUSES = ['registered', 'validated', 'hifz_waiting', 'hifz_step2',
      'hifz_done', 'tilawa_step', 'tilawa_done', 'pledged'];
    if (selectedApplicant && FORWARD_STATUSES.includes(selectedApplicant.status)) {
      await (supabase as any)
        .from('applicants')
        .update({ status: 'interview_completed' })
        .eq('id', applicantId);
      await (supabase as any).from('applicant_activity_log').insert({
        applicant_id: applicantId,
        action: 'status_changed',
        changes: { status: { old: selectedApplicant.status, new: 'interview_completed' } },
        notes: `إجراء مقابلة بواسطة ${selectedCommittee?.full_name ?? 'عضوة غير محددة'} (الدرجة ${score}/${maxScore} — ${RESULT_AR[result]})`,
        actor_email: 'interview_form@self',
      });
    }

    setDone(true);
    toast({ title: 'تم حفظ المقابلة بنجاح' });
  }

  if (!unlocked) {
    return <CodeGate onUnlock={() => setUnlocked(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">جارٍ التحميل…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">
            مقابلة طالبات الوقار
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex items-start justify-center">
        <div className="w-full max-w-3xl space-y-6">

          {done ? (
            <Card>
              <CardContent className="pt-8 pb-6 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="font-display text-2xl">تم حفظ المقابلة بنجاح</h2>
                <p className="text-sm text-muted-foreground">
                  تم تسجيل مقابلة <strong>{selectedApplicant?.full_name}</strong> ودرجتها{' '}
                  <strong>{score}/{maxScore}</strong> ({RESULT_AR[result]}).
                </p>
                <Button variant="outline" onClick={reset}>إجراء مقابلة جديدة</Button>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* 1) اختيار العضوة */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display">1. اختاري نفسكِ من قائمة اللجنة</CardTitle>
                </CardHeader>
                <CardContent>
                  {committee.length === 0 ? (
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle size={16} />
                      لا توجد عضوات نشطات. تواصلي مع الإدارة لإضافتكِ.
                    </p>
                  ) : (
                    <Select value={committeeId} onValueChange={setCommitteeId}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {committee.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>

              {/* 2) اختيار الطالبة */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display">2. اختاري الطالبة</CardTitle>
                </CardHeader>
                <CardContent>
                  <Popover open={applicantSearchOpen} onOpenChange={setApplicantSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedApplicant
                          ? <span>{selectedApplicant.full_name}</span>
                          : <span className="text-muted-foreground">ابحثي بالاسم أو رقم الهوية…</span>}
                        <ChevronsUpDown size={14} className="ms-2 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command>
                        <CommandInput placeholder="اكتبي الاسم أو الهوية…" />
                        <CommandList>
                          <CommandEmpty>لا توجد نتائج</CommandEmpty>
                          <CommandGroup>
                            {applicants.map(a => (
                              <CommandItem
                                key={a.id}
                                // value includes the national ID so search by ID still works,
                                // but we deliberately do NOT render it — this page is public
                                // and the ID is sensitive info.
                                value={`${a.full_name} ${a.national_id}`}
                                onSelect={() => { setApplicantId(a.id); setApplicantSearchOpen(false); }}
                              >
                                <span className="font-medium">{a.full_name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>

              {/* 3) بيانات الطالبة (للعرض) */}
              {selectedApplicant && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-display">بيانات الطالبة</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <ReadField label="الاسم الرباعي" value={selectedApplicant.full_name} />
                    <ReadField label="العمر" value={selectedApplicant.age?.toString()} mono />
                    <ReadField
                      label="الأجزاء المحفوظة"
                      value={[
                        selectedApplicant.memorized_juz_count?.toString(),
                        selectedApplicant.from_surah && selectedApplicant.to_surah
                          ? `(من ${selectedApplicant.from_surah} إلى ${selectedApplicant.to_surah})`
                          : null,
                      ].filter(Boolean).join(' ')}
                    />
                    <ReadField
                      label="الفرع لهذا العام"
                      value={selectedApplicant.desired_branch ? BRANCH_AR[selectedApplicant.desired_branch] : null}
                    />
                    <ReadField
                      label="المشاركة السابقة"
                      value={selectedApplicant.previously_joined
                        ? selectedApplicant.previous_branch || 'نعم (بدون تفصيل)'
                        : 'أول مشاركة'}
                    />
                    <ReadField
                      label="المرافقات"
                      value={selectedApplicant.has_companions
                        ? selectedApplicant.companions_details || selectedApplicant.accompanying_with || 'نعم'
                        : 'لا يوجد'}
                    />
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">حالة الإقرار بالاتفاقية</Label>
                      <div className="mt-1">
                        {selectedApplicant.status === 'pledged' || selectedApplicant.status === 'interview_completed' || selectedApplicant.status === 'accepted'
                          ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">أقرَّت ✓</Badge>
                          : <Badge variant="outline" className="bg-amber-50 text-amber-700">لم تُقرّ بعد ({STATUS_AR[selectedApplicant.status]})</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 4) المقابلة الشخصية */}
              {selectedApplicant && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-display">3. المقابلة الشخصية</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>التخصص</Label>
                      <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>هل ستحضر كامل أيام الدورة؟</Label>
                      <YesNoSelect value={willAttendFullCourse} onChange={setWillAttendFullCourse} />
                    </div>

                    <div className="space-y-2">
                      <Label>هل تقبل السكن المشترك؟</Label>
                      <Select value={acceptsHousing} onValueChange={(v) => setAcceptsHousing(v as HousingAnswer)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(HOUSING_AR) as [HousingAnswer, string][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {acceptsHousing === 'with_companions' && (
                      <>
                        <div className="space-y-2">
                          <Label>تفصيل المرافقات</Label>
                          <Textarea
                            value={housingDetails}
                            onChange={(e) => setHousingDetails(e.target.value)}
                            rows={2}
                            placeholder="الأسماء، صلة القرابة، إلخ"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>هل المرافقات مسجلات في رابط المرافقات؟</Label>
                          <YesNoSelect value={companionsRegistered} onChange={setCompanionsRegistered} />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label>ملاحظات المرافقات</Label>
                      <Textarea
                        value={companionsNotes}
                        onChange={(e) => setCompanionsNotes(e.target.value)}
                        rows={2}
                        placeholder="أي ملاحظة إضافية حول المرافقات…"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>العباءة واللباس</Label>
                      <Select value={abayaStatus} onValueChange={(v) => setAbayaStatus(v as AbayaAnswer)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ABAYA_AR) as [AbayaAnswer, string][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>الجدية</Label>
                      <Select value={seriousness} onValueChange={(v) => setSeriousness(v as SeriousnessAnswer)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(SERIOUSNESS_AR) as [SeriousnessAnswer, string][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>احترامها للضوابط والتزامها فيها</Label>
                      <YesNoSelect value={respectsRules} onChange={setRespectsRules} />
                    </div>

                    <div className="space-y-2">
                      <Label>نقاط القوة</Label>
                      <Textarea
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        rows={2}
                        placeholder="ما الذي يميّز هذه الطالبة؟"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>نقاط الضعف</Label>
                      <Textarea
                        value={weaknesses}
                        onChange={(e) => setWeaknesses(e.target.value)}
                        rows={2}
                        placeholder="ما الذي يحتاج تطويراً أو متابعة؟"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>ملاحظات</Label>
                      <Textarea value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} rows={2} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 5) اختبار القرآن */}
              {selectedApplicant && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-display">
                      4. اختبار القرآن
                      <span className="text-xs text-muted-foreground font-body ms-2">
                        (الدرجة من {maxScore})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>الاستعداد المسبق</Label>
                      <YesNoSelect value={priorPreparation} onChange={setPriorPreparation} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 py-2">
                        <Label htmlFor="passage-change" className="cursor-pointer">طلب تغيير المقطع</Label>
                        <Switch
                          id="passage-change"
                          checked={requestedPassageChange}
                          onCheckedChange={setRequestedPassageChange}
                        />
                      </div>
                      {requestedPassageChange && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2">
                          <AlertCircle size={14} className="mt-0.5 shrink-0" />
                          <span>سيُخصم نصف الدرجة القصوى تلقائياً ({maxScore / 2} درجة)</span>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <NumberField label="عدد الأخطاء" value={errorsCount} onChange={setErrorsCount} hint="−1 لكل خطأ" />
                      <NumberField label="عدد اللحون" value={lahnCount} onChange={setLahnCount} hint="−½ لكل لحن" />
                      <NumberField label="عدد الترددات" value={continuityCount} onChange={setContinuityCount} hint="−¼ لكل" />
                    </div>

                    {/* الحساب التلقائي */}
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="grid grid-cols-3 gap-3 items-end">
                        <div>
                          <p className="text-xs text-muted-foreground">الدرجة الخام</p>
                          <p className="text-3xl font-display tabular-nums mt-1">
                            {score}<span className="text-lg text-muted-foreground">/{maxScore}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">النسبة المئوية</p>
                          <p className="text-3xl font-display tabular-nums mt-1">
                            {getScorePercentage(score, maxScore)}<span className="text-lg text-muted-foreground">%</span>
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-muted-foreground">النتيجة</p>
                          <Badge className={`mt-1 text-base px-3 py-1 ${RESULT_COLOR[result]}`}>
                            {RESULT_AR[result]}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>ملاحظات الاختبار</Label>
                      <Textarea value={examNotes} onChange={(e) => setExamNotes(e.target.value)} rows={2} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Submit */}
              {selectedApplicant && (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !committeeId || !applicantId}
                >
                  {submitting ? 'جارٍ الحفظ…' : 'حفظ المقابلة'}
                </Button>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function ReadField({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className={`mt-1 ${mono ? 'tabular-nums' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function YesNoSelect({ value, onChange }: { value: 'yes' | 'no' | ''; onChange: (v: 'yes' | 'no' | '') => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as 'yes' | 'no')}>
      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">نعم</SelectItem>
        <SelectItem value="no">لا</SelectItem>
      </SelectContent>
    </Select>
  );
}

function NumberField({ label, value, onChange, hint }: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value || 0)))}
        className="tabular-nums"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Note: We import Search but didn't use it; keep linter happy.
void Search;

/* ─────────── Code Gate ─────────── */

function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('validate-interview-code', {
        body: { code: trimmed },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.ok) {
        onUnlock();
      } else {
        setError(data?.error ?? 'الرمز غير صحيح');
      }
    } catch (err: any) {
      toast({ title: 'تعذّر التحقق', description: err.message ?? 'حدث خطأ', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">
            مقابلة طالبات الوقار
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 flex items-start justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound size={22} />
            </div>
            <CardTitle className="font-display text-2xl">رمز الدخول</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              أدخلي الرمز الذي زوّدتكِ به الإدارة لبدء المقابلات.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">الرمز</Label>
                <div className="relative">
                  <Input
                    id="code"
                    type={show ? 'text' : 'password'}
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(null); }}
                    autoFocus
                    dir="ltr"
                    className="pl-10"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
                {submitting ? 'جارٍ التحقق…' : 'دخول'}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center pt-2 border-t">
                صلاحية الجلسة: ساعتان من بدء الاستخدام، وتنتهي عند تحديث الصفحة.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
