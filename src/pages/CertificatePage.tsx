import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CertificateView, { CertificateData } from '@/components/CertificateView';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import logoImg from '@/assets/logo.png';

// عرض الشهادة الحقيقي بالبكسل (297mm × 96dpi) لتصغير المعاينة على الشاشة
const CERT_WIDTH_PX = 1123;

// ألوان الصفحة — مشتقة من هوية الشهادة نفسها
const C = {
  night: '#06343A',
  nightDeep: '#032326',
  teal: '#045E63',
  gold: '#C9A96A',
  goldSoft: '#E9D8AF',
  ivory: '#FBF8F1',
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
    name: 'نورة بنت عبدالله المحمد',
    fromSurah: 'البقرة',
    toSurah: 'الناس',
    juzText: '30 جزءًا',
    score: '95%',
    grade: 'ممتاز',
  },
};

// فاصل ذهبي بمعيّن — يحاكي شريط الزخرفة في الشهادة
function GoldDivider() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span className="h-px w-16 sm:w-24" style={{ background: `linear-gradient(to left, transparent, ${C.gold})` }} />
      <span className="text-xs" style={{ color: C.gold }}>◆</span>
      <span className="h-px w-16 sm:w-24" style={{ background: `linear-gradient(to right, transparent, ${C.gold})` }} />
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

  const resetSearch = () => {
    setNationalId('');
    setLookup({ kind: 'idle' });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen px-4 py-10 sm:py-14"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${C.teal} 0%, ${C.night} 55%, ${C.nightDeep} 100%)`,
        fontFamily: "'Alyamama', 'Amiri', serif",
      }}
    >
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
        #cert-id-input::placeholder { color: ${C.gold}66; letter-spacing: 0.35em; }
        #cert-id-input:focus-visible {
          outline: 2px solid ${C.gold};
          outline-offset: 2px;
        }
        .cert-reveal { animation: cert-rise 700ms ease-out both; }
        @keyframes cert-rise {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cert-reveal { animation: none; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl space-y-8 print:hidden">
        {/* الترويسة */}
        <header className="text-center space-y-4">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow-lg"
            style={{ background: C.ivory, boxShadow: `0 0 0 3px ${C.gold}55, 0 8px 24px rgba(0,0,0,.35)` }}
          >
            <img src={logoImg} alt="جمعية تعلم للقرآن وعلومه" className="h-12 w-auto" />
          </div>
          <div className="space-y-1">
            <h1
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: "'Doran ExtraBold', 'Amiri', serif", color: C.ivory }}
            >
              شهادات برنامج الوقار
            </h1>
            <p className="text-sm sm:text-base" style={{ color: C.goldSoft }}>
              الدورة الرابعة عشرة — ١٤٤٨ هـ
            </p>
          </div>
          <GoldDivider />
        </header>

        {/* أزرار المعاينة التجريبية */}
        {demoMode && (
          <div className="flex items-center justify-center gap-2">
            {(['completion', 'participation'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDemoType(t)}
                className="rounded-full px-5 py-2 text-sm transition-colors"
                style={
                  demoType === t
                    ? { background: C.gold, color: C.nightDeep }
                    : { background: 'transparent', color: C.goldSoft, border: `1px solid ${C.gold}66` }
                }
              >
                {t === 'completion' ? 'شهادة إتمام' : 'شهادة مشاركة'}
              </button>
            ))}
          </div>
        )}

        {/* بوابة الدخول — تظهر ما دامت الشهادة لم تُعرض */}
        {!demoMode && !certificate && (
          <section
            className="mx-auto max-w-md rounded-2xl p-6 sm:p-8 text-center space-y-5"
            style={{ background: `${C.ivory}0D`, border: `1px solid ${C.gold}44`, backdropFilter: 'blur(4px)' }}
          >
            <div className="space-y-1">
              <h2 className="text-xl" style={{ color: C.ivory }}>أهلًا بكنّ</h2>
              <p className="text-sm leading-6" style={{ color: `${C.ivory}B3` }}>
                أدخلي رقم هويتك لعرض شهادتك وتحميلها
              </p>
            </div>
            <div className="space-y-3">
              <label htmlFor="cert-id-input" className="sr-only">رقم الهوية</label>
              <div className="relative">
                <input
                  id="cert-id-input"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="××××××××××"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl px-4 py-3 text-center text-xl tracking-[0.35em]"
                  style={{
                    background: `${C.nightDeep}CC`,
                    border: `1px solid ${C.gold}88`,
                    color: C.goldSoft,
                    fontFamily: "'Cairo', sans-serif",
                  }}
                />
                {lookup.kind === 'searching' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.gold }}>
                    <Loader2 size={18} className="animate-spin" />
                  </span>
                )}
              </div>
              {lookup.kind === 'not_found' && (
                <p className="text-sm" style={{ color: '#F2B8B5' }}>
                  لا يوجد سجل بهذا الرقم — تأكدي من رقم الهوية.
                </p>
              )}
              {lookup.kind === 'error' && (
                <p className="text-sm" style={{ color: '#F2B8B5' }}>تعذر البحث: {lookup.message}</p>
              )}
            </div>
          </section>
        )}

        {/* لحظة الكشف: التهنئة ثم الشهادة ثم التحميل */}
        {certificate && (
          <section className="cert-reveal space-y-6">
            <CelebrationOverlay key={`${certificate.name}-${certificate.type}`} />

            <div className="text-center space-y-2">
              <p
                className="text-3xl sm:text-5xl"
                style={{ fontFamily: "'Doran ExtraBold', 'Amiri', serif", color: C.gold }}
              >
                الحمدلله على التمام
              </p>
              <p className="text-lg sm:text-xl" style={{ color: C.ivory }}>
                مبارك لكنّ 🎉
              </p>
            </div>

            <GoldDivider />

            {/* معاينة مصغّرة تحافظ على مقاس A4 الحقيقي عند الطباعة */}
            <div
              ref={wrapRef}
              className="overflow-hidden rounded-lg"
              style={{
                height: `${scale * (CERT_WIDTH_PX * 210 / 297)}px`,
                boxShadow: `0 0 0 1px ${C.gold}88, 0 0 0 6px ${C.nightDeep}, 0 0 0 7px ${C.gold}44, 0 24px 48px rgba(0,0,0,.5)`,
                background: '#fff',
              }}
            >
              <div id="certificate-print" style={{ transform: `scale(${scale})`, transformOrigin: 'top right' }}>
                <CertificateView data={certificate} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-lg font-bold shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: C.gold, color: C.nightDeep, outlineColor: C.goldSoft }}
              >
                <Download size={20} /> تحميل الشهادة PDF
              </button>
              {!demoMode && (
                <button
                  onClick={resetSearch}
                  className="text-sm underline underline-offset-4"
                  style={{ color: `${C.ivory}99` }}
                >
                  البحث برقم هوية آخر
                </button>
              )}
            </div>
          </section>
        )}

        {/* التذييل */}
        <footer className="pt-4 text-center text-xs" style={{ color: `${C.ivory}66` }}>
          جمعية تعلم للقرآن وعلومه — برنامج الوقار
        </footer>
      </div>

      {/* نسخة الطباعة تعتمد على #certificate-print أعلاه فقط */}
    </div>
  );
}
