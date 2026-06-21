import { useState, useEffect, useLayoutEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Loader2, X, Search, Info } from 'lucide-react';
import { Applicant } from '@/lib/applicant-labels';
import { findApplicantByNationalId } from '@/lib/applicant-actions';
import {
  searchApplicants, submitRoommatePreferences,
  ApplicantLite, RoommateSlot,
} from '@/lib/roommate-actions';
import logoImg from '@/assets/logo.png';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'not_found' }
  | { kind: 'found'; applicant: Applicant }
  | { kind: 'already_submitted'; applicant: Applicant }
  | { kind: 'submitted_now'; applicant: Applicant };

// A roommate slot is empty, a registered applicant, or a free-text "other".
type SlotValue =
  | { kind: 'none' }
  | { kind: 'applicant'; applicant: ApplicantLite }
  | { kind: 'other'; name: string };

const EMPTY: SlotValue = { kind: 'none' };

// Show only the first and last parts of the name (e.g. "أروى ... الشثري"),
// keeping the display compact. Search by ID still works server-side.
function shortName(full: string | null): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function slotToPayload(s: SlotValue): RoommateSlot | null {
  if (s.kind === 'applicant') return { applicantId: s.applicant.id, otherName: null };
  if (s.kind === 'other') return { applicantId: null, otherName: s.name.trim() };
  return null;
}

function slotComplete(s: SlotValue, required: boolean): boolean {
  if (s.kind === 'none') return !required; // optional empty slot is fine
  if (s.kind === 'applicant') return true;
  return s.name.trim().length > 0; // "other" needs a name
}

/** Search-and-pick control for one roommate slot. */
function RoommatePicker({
  label, value, onChange, excludeId, excludeApplicantId, required,
}: {
  label: string;
  value: SlotValue;
  onChange: (v: SlotValue) => void;
  excludeId: string;            // the applicant filling the form
  excludeApplicantId?: string;  // the other slot's pick, to avoid duplicates
  required: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApplicantLite[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (value.kind !== 'none') return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await searchApplicants(q, excludeId);
      if (cancelled) return;
      setResults(data.filter((r) => r.id !== excludeApplicantId));
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, value.kind, excludeId, excludeApplicantId]);

  function reset() { onChange(EMPTY); setQuery(''); setResults([]); }

  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>

      {/* Selected registered applicant */}
      {value.kind === 'applicant' && (
        <div className="flex items-center justify-between gap-2 border rounded-md p-3 bg-muted/30">
          <div className="min-w-0">
            <p className="font-medium truncate">{shortName(value.applicant.full_name)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset} title="تغيير">
            <X size={16} />
          </Button>
        </div>
      )}

      {/* "Other" free-text name */}
      {value.kind === 'other' && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              value={value.name}
              onChange={(e) => onChange({ kind: 'other', name: e.target.value })}
              placeholder="اسم الزميلة (غير مسجَّلة)"
              autoFocus
            />
            <Button type="button" variant="ghost" size="sm" onClick={reset} title="تغيير">
              <X size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">زميلة غير مسجّلة في النظام — اكتبي اسمها كاملاً.</p>
        </div>
      )}

      {/* Search box + results */}
      {value.kind === 'none' && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحثي بالاسم أو رقم الهوية…"
              className="pr-9"
            />
            {searching && (
              <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {query.trim().length >= 2 && (
            <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChange({ kind: 'applicant', applicant: r })}
                  className="w-full text-right px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium">{shortName(r.full_name)}</span>
                </button>
              ))}
              {!searching && results.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div>
              )}
              <button
                type="button"
                onClick={() => onChange({ kind: 'other', name: '' })}
                className="w-full text-right px-3 py-2 hover:bg-muted/50 transition-colors text-sm text-primary font-medium"
              >
                أخرى (غير مسجَّلة) — إدخال الاسم يدوياً
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoommatesPage() {
  const { toast } = useToast();

  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'بيانات زميلات السكن';
    return () => { document.title = previous; };
  }, []);

  const [nationalId, setNationalId] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });

  const [wantsSpecific, setWantsSpecific] = useState<boolean | null>(null);
  const [slot1, setSlot1] = useState<SlotValue>(EMPTY);
  const [slot2, setSlot2] = useState<SlotValue>(EMPTY);
  const [arranged, setArranged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-lookup when ID reaches 10 digits
  useEffect(() => {
    const trimmed = nationalId.trim();
    if (trimmed.length !== 10) {
      setLookup({ kind: 'idle' });
      setWantsSpecific(null);
      setSlot1(EMPTY); setSlot2(EMPTY); setArranged(false);
      return;
    }
    let cancelled = false;
    setLookup({ kind: 'searching' });
    (async () => {
      const { data, error } = await findApplicantByNationalId(trimmed);
      if (cancelled) return;
      if (error) {
        toast({ title: 'تعذّر التحقق', description: error, variant: 'destructive' });
        setLookup({ kind: 'idle' });
        return;
      }
      if (!data || data.status === 'deleted' || data.status === 'rejected') {
        setLookup({ kind: 'not_found' });
        return;
      }
      if (data.roommate_submitted_at) {
        setLookup({ kind: 'already_submitted', applicant: data });
        return;
      }
      setLookup({ kind: 'found', applicant: data });
    })();
    return () => { cancelled = true; };
  }, [nationalId, toast]);

  const fullName =
    lookup.kind === 'found' || lookup.kind === 'already_submitted' || lookup.kind === 'submitted_now'
      ? lookup.applicant.full_name ?? ''
      : '';

  const isAlreadyDone = lookup.kind === 'already_submitted' || lookup.kind === 'submitted_now';

  // Submit gating
  const slot1Applicant = slot1.kind === 'applicant' ? slot1.applicant.id : undefined;
  const slot2Applicant = slot2.kind === 'applicant' ? slot2.applicant.id : undefined;
  const duplicatePick = !!slot1Applicant && slot1Applicant === slot2Applicant;

  const canSubmit = (() => {
    if (lookup.kind !== 'found' || submitting) return false;
    if (wantsSpecific === null) return false;
    if (wantsSpecific === false) return true;
    // wants specific roommates:
    if (!slotComplete(slot1, true)) return false;
    if (!slotComplete(slot2, false)) return false;
    if (duplicatePick) return false;
    if (!arranged) return false;
    return true;
  })();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || lookup.kind !== 'found') return;
    setSubmitting(true);
    const { error } = await submitRoommatePreferences(lookup.applicant.id, {
      wantsSpecific: wantsSpecific === true,
      arrangedConfirmed: arranged,
      slot1: wantsSpecific ? slotToPayload(slot1) : null,
      slot2: wantsSpecific ? slotToPayload(slot2) : null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'تعذّر حفظ البيانات', description: error, variant: 'destructive' });
      return;
    }
    setLookup({ kind: 'submitted_now', applicant: lookup.applicant });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoImg} alt="شعار تمام" className="w-10 h-10 object-contain shrink-0" />
          <h1 className="font-display text-lg sm:text-xl leading-tight">بيانات زميلات السكن</h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 lg:py-12 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1 border-b pb-2">
                <h2 className="font-display text-lg">تفضيلات السكن المشترك</h2>
                <p className="text-sm text-muted-foreground">لمساعدتنا في ترتيب سكنكِ بما يناسبكِ.</p>
              </div>

              {/* الهوية + الاسم */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="national_id">رقم الهوية</Label>
                  <Input
                    id="national_id"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10 أرقام"
                    dir="ltr"
                    inputMode="numeric"
                    autoFocus
                    required
                    disabled={isAlreadyDone}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">الاسم الرباعي</Label>
                  <div className="relative">
                    <Input
                      id="full_name"
                      value={fullName}
                      readOnly
                      placeholder={lookup.kind === 'searching' ? 'جارٍ التحقق…' : '—'}
                      className="bg-muted/30"
                    />
                    {lookup.kind === 'searching' && (
                      <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {lookup.kind === 'not_found' && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>لم نعثر على تسجيلكِ. تأكدي من رقم الهوية، أو تواصلي مع إدارة الدورة.</span>
                </div>
              )}

              {isAlreadyDone && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {lookup.kind === 'submitted_now'
                      ? 'تم استلام بياناتكِ بنجاح. شكراً لكِ.'
                      : 'سبق إرسال بيانات السكن لهذه الهوية. لا حاجة لإعادتها.'}
                  </span>
                </div>
              )}

              {/* السؤال + الحقول تظهر فقط بعد التعرف على الطالبة */}
              {lookup.kind === 'found' && (
                <>
                  <div className="space-y-3">
                    <Label>هل ترغبين بزميلات سكن محددات؟</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={wantsSpecific === true ? 'default' : 'outline'}
                        onClick={() => setWantsSpecific(true)}
                      >
                        نعم
                      </Button>
                      <Button
                        type="button"
                        variant={wantsSpecific === false ? 'default' : 'outline'}
                        onClick={() => { setWantsSpecific(false); setSlot1(EMPTY); setSlot2(EMPTY); setArranged(false); }}
                      >
                        لا
                      </Button>
                    </div>
                  </div>

                  {wantsSpecific === true && (
                    <div className="space-y-5 border rounded-lg p-4 bg-muted/20">
                      <p className="text-sm text-muted-foreground">
                        اختاري زميلة واحدة على الأقل (ويمكنكِ اختيار زميلتين).
                      </p>

                      <RoommatePicker
                        label="الزميلة الأولى"
                        value={slot1}
                        onChange={setSlot1}
                        excludeId={lookup.applicant.id}
                        excludeApplicantId={slot2Applicant}
                        required
                      />
                      <RoommatePicker
                        label="الزميلة الثانية (اختياري)"
                        value={slot2}
                        onChange={setSlot2}
                        excludeId={lookup.applicant.id}
                        excludeApplicantId={slot1Applicant}
                        required={false}
                      />

                      {duplicatePick && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <span>لا يمكن اختيار الزميلة نفسها مرتين.</span>
                        </div>
                      )}

                      {/* ملاحظة بذل المستطاع */}
                      <div className="flex items-start gap-2 text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-md p-3">
                        <Info size={16} className="mt-0.5 shrink-0" />
                        <span>سنحرص على تلبية رغبتكِ في السكن قدر الإمكان، بما يتاح من الإمكانات.</span>
                      </div>

                      {/* إقرار التنسيق المسبق */}
                      <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted/30 transition-colors bg-card">
                        <Checkbox
                          checked={arranged}
                          onCheckedChange={(v) => setArranged(!!v)}
                          className="mt-1 shrink-0"
                        />
                        <span className="text-sm leading-loose">
                          أُقِرّ بأنني تواصلتُ مع من اخترتُهنّ مسبقاً واتفقنا على السكن معاً.
                        </span>
                      </label>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={!canSubmit}>
                    {submitting ? 'جارٍ الحفظ…' : 'إرسال'}
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
