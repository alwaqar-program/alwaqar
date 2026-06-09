import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Applicant, ApplicantStatus, AgeCategory, Branch,
  STATUS_AR, AGE_AR, BRANCH_AR,
} from '@/lib/applicant-labels';

export type ApplicantFormValues = Partial<Omit<Applicant, 'id' | 'created_at' | 'updated_at'>>;

interface Props {
  initial?: Applicant;
  onSubmit: (values: ApplicantFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

const empty: ApplicantFormValues = {
  full_name: '',
  national_id: '',
  phone: '',
  nationality: 'سعودية',
  status: 'registered',
};

export default function ApplicantForm({ initial, onSubmit, onCancel, submitting, submitLabel = 'حفظ' }: Props) {
  const [values, setValues] = useState<ApplicantFormValues>(initial ?? empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);

  function set<K extends keyof ApplicantFormValues>(key: K, val: ApplicantFormValues[K]) {
    setValues((p) => ({ ...p, [key]: val }));
    if (errors[key as string]) setErrors((p) => ({ ...p, [key as string]: '' }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.full_name?.trim()) e.full_name = 'الاسم مطلوب';
    if (!values.national_id?.trim()) e.national_id = 'الهوية مطلوبة';
    if (!values.phone?.trim()) e.phone = 'الجوال مطلوب';

    // مبررات القبول مطلوبة عند القبول أو القبول بشرط
    if ((values.status === 'accepted' || values.status === 'conditionally_accepted')
        && !values.acceptance_reasons?.trim()) {
      e.acceptance_reasons = 'مبررات القبول مطلوبة';
    }
    // مبررات الرفض مطلوبة عند الرفض
    if (values.status === 'rejected' && !values.rejection_reasons?.trim()) {
      e.rejection_reasons = 'مبررات الرفض مطلوبة';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="الهوية الشخصية">
          <FormRow label="الاسم الرباعي *" error={errors.full_name}>
            <Input value={values.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
          </FormRow>
          <FormRow label="الاسم بالإنجليزية">
            <Input value={values.name_en ?? ''} onChange={(e) => set('name_en', e.target.value)} dir="ltr" />
          </FormRow>
          <FormRow label="رقم الهوية *" error={errors.national_id}>
            <Input value={values.national_id ?? ''} onChange={(e) => set('national_id', e.target.value)} dir="ltr" />
          </FormRow>
          <FormRow label="الجنسية">
            <Input value={values.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} />
          </FormRow>
          <FormRow label="تاريخ الميلاد">
            <Input type="date" value={values.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value)} />
          </FormRow>
          <FormRow label="العمر">
            <Input type="number" min={0} value={values.age ?? ''} onChange={(e) => set('age', e.target.value ? Number(e.target.value) : null)} />
          </FormRow>
          <FormRow label="الفئة العمرية">
            <Select value={values.age_category ?? ''} onValueChange={(v) => set('age_category', (v || null) as AgeCategory | null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {Object.entries(AGE_AR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormRow>
        </Section>

        <Section title="التواصل والموقع">
          <FormRow label="الجوال *" error={errors.phone}>
            <Input value={values.phone ?? ''} onChange={(e) => set('phone', e.target.value)} dir="ltr" />
          </FormRow>
          <FormRow label="جوال ولي الأمر">
            <Input value={values.guardian_phone ?? ''} onChange={(e) => set('guardian_phone', e.target.value)} dir="ltr" />
          </FormRow>
          <FormRow label="البريد الإلكتروني">
            <Input type="email" value={values.email ?? ''} onChange={(e) => set('email', e.target.value)} dir="ltr" />
          </FormRow>
          <FormRow label="المدينة">
            <Input value={values.city ?? ''} onChange={(e) => set('city', e.target.value)} />
          </FormRow>
        </Section>

        <Section title="الخلفية الأكاديمية والحفظ">
          <FormRow label="المؤهل العلمي">
            <Input value={values.qualification ?? ''} onChange={(e) => set('qualification', e.target.value)} />
          </FormRow>
          <FormRow label="المعهد / دار التحفيظ">
            <Input value={values.institute_name ?? ''} onChange={(e) => set('institute_name', e.target.value)} />
          </FormRow>
          <FormRow label="تابع لتعلَّم">
            <SwitchYesNo value={values.institute_is_taallam} onChange={(v) => set('institute_is_taallam', v)} />
          </FormRow>
          <FormRow label="اسم المُرشِّحة">
            <Input value={values.nominator ?? ''} onChange={(e) => set('nominator', e.target.value)} />
          </FormRow>
          <FormRow label="الأجزاء المحفوظة">
            <Input type="number" min={0} max={30} value={values.memorized_juz_count ?? ''} onChange={(e) => set('memorized_juz_count', e.target.value ? Number(e.target.value) : null)} />
          </FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="من سورة">
              <Input value={values.from_surah ?? ''} onChange={(e) => set('from_surah', e.target.value)} />
            </FormRow>
            <FormRow label="إلى سورة">
              <Input value={values.to_surah ?? ''} onChange={(e) => set('to_surah', e.target.value)} />
            </FormRow>
          </div>
          <FormRow label="الفرع المراد">
            <Select value={values.desired_branch ?? ''} onValueChange={(v) => set('desired_branch', (v || null) as Branch | null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {Object.entries(BRANCH_AR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="المقرر المحدد">
            <Input value={values.curriculum_spec ?? ''} onChange={(e) => set('curriculum_spec', e.target.value)} />
          </FormRow>
        </Section>

        <Section title="السابقة، الصحة، المرافقات">
          <FormRow label="سبق الالتحاق بدورة الوقار">
            <SwitchYesNo value={values.previously_joined} onChange={(v) => set('previously_joined', v)} />
          </FormRow>
          <FormRow label="الفرع السابق">
            <Input value={values.previous_branch ?? ''} onChange={(e) => set('previous_branch', e.target.value)} />
          </FormRow>
          <FormRow label="نوع المشاركة">
            <Input value={values.participation_type ?? ''} onChange={(e) => set('participation_type', e.target.value)} />
          </FormRow>
          <FormRow label="مرض مزمن">
            <SwitchYesNo value={values.has_chronic_illness} onChange={(v) => set('has_chronic_illness', v)} />
          </FormRow>
          <FormRow label="نوع المرض">
            <Input value={values.illness_type ?? ''} onChange={(e) => set('illness_type', e.target.value)} />
          </FormRow>
          <FormRow label="معها مرافقات">
            <SwitchYesNo value={values.has_companions} onChange={(v) => set('has_companions', v)} />
          </FormRow>
          <FormRow label="بيانات المرافقات">
            <Textarea value={values.companions_details ?? ''} onChange={(e) => set('companions_details', e.target.value)} rows={2} />
          </FormRow>
          <FormRow label="ترافق مع">
            <Input value={values.accompanying_with ?? ''} onChange={(e) => set('accompanying_with', e.target.value)} />
          </FormRow>
        </Section>

        <Section title="الحالة والملاحظات" full>
          <FormRow label="الحالة">
            <Select value={values.status ?? 'registered'} onValueChange={(v) => set('status', v as ApplicantStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_AR)
                  .filter(([k]) => k !== 'deleted')
                  .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormRow>

          {(values.status === 'accepted' || values.status === 'conditionally_accepted') && (
            <FormRow label="مبررات القبول *" error={errors.acceptance_reasons}>
              <Textarea
                value={values.acceptance_reasons ?? ''}
                onChange={(e) => set('acceptance_reasons', e.target.value)}
                rows={3}
                placeholder="السبب الذي دعا للقبول…"
              />
            </FormRow>
          )}

          {values.status === 'rejected' && (
            <FormRow label="مبررات الرفض *" error={errors.rejection_reasons}>
              <Textarea
                value={values.rejection_reasons ?? ''}
                onChange={(e) => set('rejection_reasons', e.target.value)}
                rows={3}
                placeholder="السبب الذي دعا للرفض…"
              />
            </FormRow>
          )}

          <FormRow label="ملاحظات">
            <Textarea value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows={3} />
          </FormRow>
        </Section>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          إلغاء
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'جارٍ الحفظ…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children, full = false }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <Card className={full ? 'md:col-span-2' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function FormRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SwitchYesNo({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex items-center gap-3 h-9">
      <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
      <span className="text-sm text-muted-foreground">{value === null || value === undefined ? '—' : value ? 'نعم' : 'لا'}</span>
      {(value === true || value === false) && (
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(null)}>
          مسح
        </Button>
      )}
    </div>
  );
}
