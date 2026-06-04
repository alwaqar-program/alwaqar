import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, AlertCircle, Pencil, Trash2, RotateCcw } from 'lucide-react';
import {
  Applicant, STATUS_AR, AGE_AR, BRANCH_AR, statusVariant,
} from '@/lib/applicant-labels';
import { restoreApplicant } from '@/lib/applicant-actions';
import ApplicantFormDialog from '@/components/applicants/ApplicantFormDialog';
import DeleteApplicantDialog from '@/components/applicants/DeleteApplicantDialog';
import ApplicantActivityLog from '@/components/applicants/ApplicantActivityLog';

export default function ApplicantProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logRefresh, setLogRefresh] = useState(0);

  const reload = useCallback(async () => {
    if (!id) return;
    const { data, error } = await (supabase as any)
      .from('applicants')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      toast({ title: 'تعذّر تحميل البيانات', description: error.message, variant: 'destructive' });
    } else {
      setData(data as Applicant);
    }
    setLoading(false);
  }, [id, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleRestore() {
    if (!data) return;
    const { error } = await restoreApplicant(data.id);
    if (error) {
      toast({ title: 'تعذّر الاسترجاع', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'تم الاسترجاع', description: 'أُعيدت المتقدمة إلى حالة "مسجلة"' });
    reload();
    setLogRefresh((k) => k + 1);
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-destructive flex flex-col items-center gap-3">
        <AlertCircle size={32} />
        <div>لم يتم العثور على المتقدمة</div>
        <Button variant="outline" onClick={() => navigate('/applicants')}>← العودة للقائمة</Button>
      </div>
    );
  }

  const isDeleted = data.status === 'deleted';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate('/applicants')} className="gap-2">
          <ArrowRight size={16} />
          العودة للقائمة
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(data.status)}>{STATUS_AR[data.status]}</Badge>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
            <Pencil size={14} />
            تعديل
          </Button>
          {isDeleted ? (
            <Button variant="outline" size="sm" onClick={handleRestore} className="gap-2">
              <RotateCcw size={14} />
              استرجاع
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 size={14} />
              حذف
            </Button>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-display">{data.full_name || '—'}</h1>
        {data.name_en && <p className="text-muted-foreground mt-1">{data.name_en}</p>}
        {data.registered_at && (
          <p className="text-xs text-muted-foreground mt-2 tabular-nums">
            تاريخ التسجيل: {new Date(data.registered_at).toLocaleString('ar-SA', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
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
          <Field
            label="تابع لتعلَّم"
            value={data.institute_is_taallam == null ? null : data.institute_is_taallam ? 'نعم' : 'لا'}
          />
          <Field label="اسم المُرشِّحة" value={data.nominator} />
          <Field label="الأجزاء المحفوظة" value={data.memorized_juz_count?.toString()} mono />
          <Field label="من سورة" value={data.from_surah} />
          <Field label="إلى سورة" value={data.to_surah} />
          <Field label="الفرع المراد" value={data.desired_branch && BRANCH_AR[data.desired_branch]} />
          <Field label="المقرر المحدد" value={data.curriculum_spec} />
        </Section>

        <Section title="السابقة والمرافقات والصحة">
          <Field
            label="سبق الالتحاق بدورة الوقار"
            value={data.previously_joined == null ? null : data.previously_joined ? 'نعم' : 'لا'}
          />
          <Field label="الفرع السابق" value={data.previous_branch} />
          <Field label="نوع المشاركة" value={data.participation_type} />
          <Field label="مرض مزمن" value={data.has_chronic_illness ? 'نعم' : 'لا'} />
          <Field label="نوع المرض" value={data.illness_type} />
          <Field
            label="معها مرافقات"
            value={data.has_companions == null ? null : data.has_companions ? 'نعم' : 'لا'}
          />
          <Field label="بيانات المرافقات" value={data.companions_details} />
          <Field label="ترافق مع" value={data.accompanying_with} />
        </Section>

        {data.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ملاحظات</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Activity Log */}
        <div className="md:col-span-2">
          <ApplicantActivityLog applicantId={data.id} refreshKey={logRefresh} />
        </div>
      </div>

      {/* Dialogs */}
      <ApplicantFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        applicant={data}
        onSaved={() => { reload(); setLogRefresh((k) => k + 1); }}
      />
      <DeleteApplicantDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        applicantId={data.id}
        applicantName={data.full_name ?? '—'}
        onDeleted={() => { reload(); setLogRefresh((k) => k + 1); }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-left ${mono ? 'tabular-nums' : ''}`}>{value || '—'}</dd>
    </div>
  );
}
