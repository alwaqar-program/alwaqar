import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CertificateView, { CertificateData } from '@/components/CertificateView';
import ConfettiBurst from '@/components/ConfettiBurst';
import bandImg from '@/assets/cert-band.jpg';
import waqarMark from '@/assets/waqar-mark.jpg';
import logoImg from '@/assets/logo.png';

// عرض الشهادة الحقيقي بالبكسل (297mm × 96dpi) لتصغير المعاينة على الشاشة
const CERT_WIDTH_PX = 1123;

// لوحة ألوان مأخوذة من ورق الشهادة نفسه
const C = {
  paper: '#FBF8F1',
  card: '#FFFDF8',
  teal: '#045E63',
  tealInk: '#03383C',
  gold: '#C2A263',
  goldPale: '#E5D5AE',
};

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
    name: 'نورة بنت عبدالله بن محمد آل عبدالعزيز',
    fromSurah: 'الفاتحة',
    toSurah: 'الإخلاص',
    juzText: '30 جزءًا',
    score: '95%',
    grade: 'ممتاز',
  },
};

// فاصل ذهبي بمعيّن صغير — نفس روح الفواصل في مطبوعات الجمعية
function GoldDivider() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span
        className="h-px w-20 sm:w-28"
        style={{ background: `linear-gradient(to left, transparent, ${C.gold})` }}
      />
      <span style={{ color: C.gold, fontSize: '10px' }}>◆</span>
      <span
        className="h-px w-20 sm:w-28"
        style={{ background: `linear-gradient(to right, transparent, ${C.gold})` }}
      />
    </div>
  );
}

export default function CertificatePage() {
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.has('demo');

  const [nationalId, setNationalId] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [demoType, setDemoType] = useState<'participation' | 'completion'>('completion');

  const wrapRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [downloading, setDownloading] = useState(false);

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

  const resetSearch = () => {
    setNationalId('');
    setLookup({ kind: 'idle' });
  };

  // تحميل مباشر لملف PDF — نرسم نسخة غير مصغّرة من الشهادة ثم نحوّلها لصفحة A4 عرضية.
  // أوثق من window.print لأن سفاري يتجاهل الاتجاه العرضي ويفرض هوامش.
  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      await document.fonts.ready;
      // ننتظر تركيب نسخة التصدير خلف شاشة الانتظار
      await new Promise((r) => setTimeout(r, 250));
      if (!exportRef.current) throw new Error('export node not mounted');
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1400,
        windowHeight: 1000,
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
      pdf.save(`شهادة برنامج الوقار - ${certificate?.name ?? ''}.pdf`);
    } catch (e) {
      console.error('PDF generation failed, falling back to print', e);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen"
      style={{ background: C.paper, color: C.tealInk, fontFamily: "'Alyamama', 'Amiri', serif" }}
    >
      <ConfettiBurst />

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          /* قفل ارتفاع الصفحة حتى لا يولّد المحتوى المخفي صفحات فارغة إضافية */
          html, body { height: 100% !important; overflow: hidden !important; }
          /* أي transform على الآباء يكسر التموضع المطلق للشهادة عند الطباعة */
          .cert-reveal { animation: none !important; transform: none !important; }
          body * { visibility: hidden !important; }
          #certificate-print, #certificate-print * { visibility: visible !important; }
          #certificate-print {
            position: absolute;
            top: 0;
            right: auto;
            left: 0;
            transform: none !important;
          }
          #certificate-print, #certificate-print * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #cert-side-band { display: none !important; }
        }
        /* سفاري يتجاهل size: landscape — عند طباعة الصفحة طوليًا نُدير الشهادة 90 درجة لتملأ الورقة */
        @media print and (orientation: portrait) {
          #certificate-print {
            transform: rotate(90deg) translate(0, -210mm) scale(0.995) !important;
            transform-origin: top left !important;
          }
        }
        #cert-id-input {
          font-family: 'Cairo', sans-serif;
          letter-spacing: 0.45em;
          background: transparent;
          border: none;
          border-bottom: 2px solid ${C.goldPale};
          border-radius: 0;
          transition: border-color 200ms ease;
        }
        #cert-id-input:focus-visible {
          outline: none;
          border-bottom-color: ${C.gold};
        }
        #cert-id-input::placeholder {
          letter-spacing: normal;
          font-family: 'Alyamama', serif;
          color: ${C.gold}99;
        }
        .cert-reveal { animation: cert-rise 600ms ease-out both; }
        @keyframes cert-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* شريط زخرفة الشهادة الحقيقي — الحافة اليمنى مثل الشهادة تمامًا */}
      <div
        id="cert-side-band"
        aria-hidden="true"
        className="fixed inset-y-0 right-0 w-10 sm:w-16 md:w-20"
        style={{
          backgroundImage: `url(${bandImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
        }}
      />

      {/* لا print:hidden هنا — إخفاء الطباعة يتم عبر visibility حتى تبقى الشهادة قابلة للطباعة.
          الهامش متساوٍ من الجهتين حتى يتوسّط المحتوى الشاشة رغم شريط الزخرفة الأيمن */}
      <div className="mx-10 sm:mx-16 md:mx-20">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14 space-y-8">
          {/* الترويسة — علامة الوقار ثم العنوان بخط الشهادة */}
          <header className="text-center space-y-3">
            <img
              src={waqarMark}
              alt=""
              className="mx-auto h-20 sm:h-24 w-auto"
              style={{ mixBlendMode: 'multiply' }}
            />
            <h1
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: "'Doran ExtraBold', 'Amiri', serif", color: C.teal }}
            >
              شهادات برنامج الوقار
            </h1>
            <p className="text-lg" style={{ color: C.gold }}>
              الدورة الرابعة عشرة — ١٤٤٨ هـ
            </p>
            <GoldDivider />
          </header>

          {/* أزرار المعاينة التجريبية */}
          {demoMode && (
            <div className="flex items-center justify-center gap-2">
              {(['completion', 'participation'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDemoType(t)}
                  className="rounded-full px-5 py-1.5 text-sm transition-colors"
                  style={
                    demoType === t
                      ? { background: C.teal, color: C.paper }
                      : { background: 'transparent', color: C.teal, border: `1px solid ${C.goldPale}` }
                  }
                >
                  {t === 'completion' ? 'شهادة إتمام' : 'شهادة مشاركة'}
                </button>
              ))}
            </div>
          )}

          {/* ورقة الإدخال — تختفي بعد عرض الشهادة */}
          {!demoMode && !certificate && (
            <section
              className="mx-auto max-w-lg rounded-sm px-6 py-8 sm:px-10 sm:py-10 text-center space-y-6"
              style={{
                background: C.card,
                border: `1px solid ${C.goldPale}`,
                boxShadow: `0 1px 0 ${C.goldPale}, 0 12px 32px rgba(4, 94, 99, 0.08)`,
              }}
            >
              <div className="space-y-2">
                <p className="text-2xl" style={{ fontFamily: "'Alyamama ExtraBold', serif", color: C.teal }}>
                  الحمد لله على التمام
                </p>
                <p className="text-base leading-7" style={{ color: `${C.tealInk}CC` }}>
                  أدخلي رقم الهوية المسجل في البرنامج لاستلام شهادتك
                </p>
              </div>

              <div className="space-y-3">
                <label htmlFor="cert-id-input" className="sr-only">
                  رقم الهوية
                </label>
                <div className="relative mx-auto max-w-xs">
                  <input
                    id="cert-id-input"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    autoFocus
                    placeholder="رقم الهوية"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-2 text-center text-2xl"
                    style={{ color: C.tealInk }}
                  />
                  {lookup.kind === 'searching' && (
                    <Loader2
                      size={18}
                      className="absolute -left-7 top-1/2 -translate-y-1/2 animate-spin"
                      style={{ color: C.gold }}
                    />
                  )}
                </div>
                {lookup.kind === 'not_found' && (
                  <p className="text-sm" style={{ color: '#A4453D' }}>
                    لا يوجد سجل بهذا الرقم — تأكدي من رقم الهوية.
                  </p>
                )}
                {lookup.kind === 'error' && (
                  <p className="text-sm" style={{ color: '#A4453D' }}>
                    تعذر البحث: {lookup.message}
                  </p>
                )}
              </div>

              <img src={logoImg} alt="جمعية تعلم للقرآن وعلومه" className="mx-auto h-10 w-auto opacity-90" />
            </section>
          )}

          {/* الشهادة */}
          {certificate && (
            <section className="cert-reveal space-y-5">
              {/* دفعة قصاصات جديدة كلما ظهرت شهادة (المفتاح يعيد تركيب المكوّن) */}
              <ConfettiBurst key={`${certificate.name}-${certificate.type}`} />
              <div className="text-center space-y-1">
                <p className="text-2xl" style={{ fontFamily: "'Alyamama ExtraBold', serif", color: C.teal }}>
                  {certificate.type === 'completion' ? 'شهادة إتمام البرنامج' : 'شهادة المشاركة في البرنامج'}
                </p>
                <p className="text-base" style={{ color: C.gold }}>
                  {certificate.name}
                </p>
              </div>

              {/* معاينة مصغّرة تحافظ على مقاس A4 الحقيقي عند الطباعة */}
              <div
                ref={wrapRef}
                className="overflow-hidden rounded-sm"
                style={{
                  height: `${scale * (CERT_WIDTH_PX * 210 / 297)}px`,
                  border: `1px solid ${C.goldPale}`,
                  boxShadow: `0 16px 40px rgba(4, 94, 99, 0.14)`,
                  background: '#fff',
                }}
              >
                <div
                  id="certificate-print"
                  style={{ transform: `scale(${scale})`, transformOrigin: 'top right' }}
                >
                  <CertificateView data={certificate} />
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={downloadPdf}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-lg transition-transform hover:scale-[1.02] disabled:opacity-70"
                  style={{
                    background: C.teal,
                    color: C.paper,
                    boxShadow: `0 0 0 1px ${C.gold}, 0 8px 20px rgba(4, 94, 99, 0.25)`,
                  }}
                >
                  {downloading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> جارٍ تجهيز الشهادة…
                    </>
                  ) : (
                    <>
                      <Download size={20} /> تحميل الشهادة PDF
                    </>
                  )}
                </button>
                {!demoMode && (
                  <button
                    onClick={resetSearch}
                    className="text-sm underline underline-offset-4"
                    style={{ color: `${C.tealInk}99` }}
                  >
                    البحث برقم هوية آخر
                  </button>
                )}
              </div>
            </section>
          )}

          <footer className="pt-2 text-center text-sm" style={{ color: `${C.tealInk}80` }}>
            جمعية تعلم للقرآن وعلومه — برنامج الوقار
          </footer>
        </div>
      </div>

      {/* أثناء التجهيز: نسخة تصدير بالحجم الكامل داخل نافذة العرض (شرط html2canvas)
          مغطاة بشاشة انتظار فلا تظهر للمستخدمة */}
      {certificate && downloading && (
        <>
          <div
            ref={exportRef}
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 9998,
              width: '297mm',
              height: '210mm',
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <CertificateView data={certificate} />
          </div>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: C.paper,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Loader2 size={32} className="animate-spin" style={{ color: C.teal }} />
            <p className="text-lg" style={{ color: C.teal }}>
              جارٍ تجهيز الشهادة…
            </p>
          </div>
        </>
      )}
    </div>
  );
}
