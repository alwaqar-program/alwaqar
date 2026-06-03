import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { supabase, type Applicant } from '../lib/supabase';
import { STATUS_AR, STATUS_COLOR, AGE_AR, BRANCH_AR } from '../lib/labels';
import Badge from '../components/Badge';

export default function ApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase.from('applicants').select('*').eq('id', id).single();
      if (error) setError(error.message);
      else setData(data as Applicant);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-slate-500">جاري التحميل…</div>;
  if (error || !data) {
    return (
      <div className="p-8 text-center text-rose-600 flex flex-col items-center gap-2">
        <AlertCircle size={32} />
        <div>{error || 'لم يتم العثور على المتقدمة'}</div>
        <Link to="/applicants" className="text-brand-600 text-sm mt-2">← العودة للقائمة</Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Link
          to="/applicants"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-800"
        >
          <ArrowRight size={18} />
          العودة للقائمة
        </Link>
        <Badge color={STATUS_COLOR[data.status]}>{STATUS_AR[data.status]}</Badge>
      </div>

      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">{data.full_name || '—'}</h2>
        {data.name_en && <p className="text-slate-500 mt-1">{data.name_en}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="الهوية الشخصية">
          <Field label="الجنسية" value={data.nationality} />
          <Field label="الهوية الوطنية" value={data.national_id} mono />
          <Field label="تاريخ الميلاد" value={data.date_of_birth} mono />
          <Field label="العمر" value={data.age?.toString()} mono />
          <Field label="الفئة العمرية" value={data.age_category && AGE_AR[data.age_category]} />
        </Section>

        <Section title="التواصل والموقع">
          <Field label="الجوال" value={data.phone} mono />
          <Field label="جوال ولي الأمر" value={data.guardian_phone} mono />
          <Field label="البريد الإلكتروني" value={data.email} />
          <Field label="المدينة" value={data.city} />
        </Section>

        <Section title="الخلفية الأكاديمية والحفظ">
          <Field label="المؤهل العلمي" value={data.qualification} />
          <Field label="المعهد / دار التحفيظ" value={data.institute_name} />
          <Field label="تابع لتعلَّم" value={data.institute_is_taallam == null ? null : data.institute_is_taallam ? 'نعم' : 'لا'} />
          <Field label="اسم المُرشِّحة" value={data.nominator} />
          <Field label="الأجزاء المحفوظة" value={data.memorized_juz_count?.toString()} mono />
          <Field label="من سورة" value={data.from_surah} />
          <Field label="إلى سورة" value={data.to_surah} />
          <Field label="الفرع المراد" value={data.desired_branch && BRANCH_AR[data.desired_branch]} />
          <Field label="المقرر المحدد" value={data.curriculum_spec} />
        </Section>

        <Section title="السابقة والمرافقات والصحة">
          <Field label="سبق الالتحاق بدورة الوقار" value={data.previously_joined == null ? null : data.previously_joined ? 'نعم' : 'لا'} />
          <Field label="الفرع السابق" value={data.previous_branch} />
          <Field label="نوع المشاركة" value={data.participation_type} />
          <Field label="مرض مزمن" value={data.has_chronic_illness ? 'نعم' : 'لا'} />
          <Field label="نوع المرض" value={data.illness_type} />
          <Field label="معها مرافقات" value={data.has_companions == null ? null : data.has_companions ? 'نعم' : 'لا'} />
          <Field label="بيانات المرافقات" value={data.companions_details} />
          <Field label="ترافق مع" value={data.accompanying_with} />
        </Section>

        {data.notes && (
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">ملاحظات</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{data.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      <dl className="space-y-3 text-sm">{children}</dl>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-slate-900 text-left ${mono ? 'tabular-nums' : ''}`}>{value || '—'}</dd>
    </div>
  );
}
