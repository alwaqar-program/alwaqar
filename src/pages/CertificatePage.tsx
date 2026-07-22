import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import CertificateView, { CertificateData } from '@/components/CertificateView';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import logoImg from '@/assets/logo.png';

// عرض الشهادة الحقيقي بالبكسل (297mm × 96dpi) لتصغير المعاينة على الشاشة
const CERT_WIDTH_PX = 1123;

// صف الدالة get_certificate (هجرة 49)
interface CertificateRow {
  cohort: 'student' | 'companion' | 'beginner';
  full_name: string;
  pages: number | null;
  portion: number | null;
  juz_count: number | null;
  from_surah: string | null;
  to_surah: string | null;
  cert_type: 'completion' | 'participation';
  juz_text: string | null;
  score: string | null;
  grade: string | null;
}

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; data: CertificateData };

const rowToCertificate = (row: CertificateRow): CertificateData => ({
  type: row.cert_type,
  name: row.full_name,
  fromSurah: row.from_surah ?? '',
  toSurah: row.to_surah ?? '',
  juzText:
    row.juz_text ?? (row.juz_count && row.juz_count > 0 ? `${row.juz_count} جزءًا` : undefined),
  score: row.score ?? undefined,
  grade: row.grade ?? undefined,
});

// بيانات تجريبية لمراجعة التصميم — تظهر فقط مع ?demo في الرابط
const SAMPLE: Record<'participation' | 'completion', CertificateData> = {
  participation: {
    type: 'participation',
    name: 'نورة بنت عبدالله المحمد',
    fromSurah: 'الملك',
    toSurah: 'الناس',
  },
  completion: {
    type: 'completion',
    name: 'نورة بنت عبدالله المحمد',
    fromSurah: 'البقرة',
    toSurah: 'الناس',
    juzText: '30 جزءًا',
    score: '95%',
    grade: 'ممتاز',
  },
};

export default function CertificatePage() {
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.has('demo');

  const [nationalId, setNationalId] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [demoType, setDemoType] = useState<'participation' | 'completion'>('completion');

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'شهادات برنامج الوقار';
    return () => {
      document.title = previous;
    };
  }, []);

  // بحث تلقائي عند اكتمال 10 أرقام (نفس سلوك صفحة رقم المستخدم)
  useEffect(() => {
    const trimmed = nationalId.trim();
    if (trimmed.length !== 10) {
      setLookup({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setLookup({ kind: 'searching' });
    (supabase as any)
      .rpc('get_certificate', { p_national_id: trimmed })
      .then(({ data, error }: { data: CertificateRow[] | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (error) {
          setLookup({ kind: 'error', message: error.message });
          return;
        }
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!row) {
          setLookup({ kind: 'not_found' });
          return;
        }
        setLookup({ kind: 'found', data: rowToCertificate(row) });
      });
    return () => {
      cancelled = true;
    };
  }, [nationalId]);

  const certificate: CertificateData | null = demoMode
    ? SAMPLE[demoType]
    : lookup.kind === 'found'
      ? lookup.data
      : null;

  useEffect(() => {
    const update = () => {
      const w = wrapRef.current?.clientWidth ?? CERT_WIDTH_PX;
      setScale(Math.min(1, w / CERT_WIDTH_PX));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [certificate]);

  return (
    <div dir="rtl" className="min-h-screen bg-muted/40 py-6 px-4">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body * { visibility: hidden !important; }
          #certificate-print, #certificate-print * { visibility: visible !important; }
          #certificate-print {
            position: absolute;
            top: 0;
            right: 0;
            transform: none !important;
          }
          #certificate-print, #certificate-print * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="شعار الجمعية" className="h-12 w-auto" />
            <div>
              <h1 className="text-xl font-bold">شهادات برنامج الوقار</h1>
              <p className="text-sm text-muted-foreground">
                {demoMode ? 'معاينة تجريبية' : 'أدخلي رقم الهوية لعرض الشهادة وتحميلها'}
              </p>
            </div>
          </div>
          {demoMode && (
            <div className="flex items-center gap-2">
              <Button
                variant={demoType === 'completion' ? 'default' : 'outline'}
                onClick={() => setDemoType('completion')}
              >
                شهادة إتمام
              </Button>
              <Button
                variant={demoType === 'participation' ? 'default' : 'outline'}
                onClick={() => setDemoType('participation')}
              >
                شهادة مشاركة
              </Button>
            </div>
          )}
          {certificate && (
            <Button onClick={() => window.print()}>
              <Download size={18} /> تحميل PDF
            </Button>
          )}
        </div>

        {!demoMode && (
          <Card className="print:hidden">
            <CardContent className="pt-6">
              <div className="max-w-sm space-y-2">
                <Label htmlFor="national_id">رقم الهوية</Label>
                <div className="relative">
                  <Input
                    id="national_id"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="1xxxxxxxxx"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                    className="text-center tracking-widest"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {lookup.kind === 'searching' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Search size={16} />
                    )}
                  </span>
                </div>
                {lookup.kind === 'not_found' && (
                  <p className="text-sm text-destructive">
                    لا يوجد سجل بهذا الرقم — تأكدي من رقم الهوية.
                  </p>
                )}
                {lookup.kind === 'error' && (
                  <p className="text-sm text-destructive">تعذر البحث: {lookup.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* تهنئة + ألعاب نارية عند ظهور الشهادة */}
        {certificate && (
          <>
            <CelebrationOverlay key={`${certificate.name}-${certificate.type}`} />
            <div className="rounded-lg border-2 border-[#C9A96A] bg-gradient-to-l from-[#045E63] to-[#0E8388] px-6 py-5 text-center text-white shadow-sm print:hidden">
              <p className="text-2xl font-bold" style={{ fontFamily: "'Doran ExtraBold', 'Amiri', serif" }}>
                الحمدلله على التمام
              </p>
              <p className="mt-1 text-lg text-[#E3C88F]">مبارك لكنّ 🎉</p>
            </div>
          </>
        )}

        {/* معاينة مصغّرة تحافظ على مقاس A4 الحقيقي عند الطباعة */}
        {certificate && (
          <div
            ref={wrapRef}
            className="rounded-lg border shadow-sm overflow-hidden bg-white"
            style={{ height: `${scale * (CERT_WIDTH_PX * 210 / 297)}px` }}
          >
            <div id="certificate-print" style={{ transform: `scale(${scale})`, transformOrigin: 'top right' }}>
              <CertificateView data={certificate} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
