import bg from '@/assets/certificate-bg.jpg';

export type CertificateType = 'participation' | 'completion';

export interface CertificateData {
  type: CertificateType;
  name: string;
  fromSurah: string;
  toSurah: string;
  /** نص الأجزاء المنجزة في شهادة الإتمام، مثل «ثلاثين جزءًا» أو «٣٠ جزءًا» */
  juzText?: string;
  /** المعدل — يُعرض كما هو (تُزوَّد به الإدارة لاحقًا) */
  score?: string;
  /** التقدير، مثل «ممتاز» */
  grade?: string;
}

// نصوص ثابتة من قالب الجمعية (الدورة الرابعة عشرة 1448هـ)
const DAYS_TEXT = 'بواقع 21 يوم';
const VENUE_TEXT = 'في حلقات مسجد رسول الله صلى الله عليه وسلم';
const SESSION_PARTICIPATION = 'من دورة البرنامج الرابعة عشرة في عام 1448 هـ';
const SESSION_COMPLETION = 'ضمن دورة الوقار الرابعة عشرة في عام 1448 هـ';
const DUA_TEXT = 'داعين المولى أن يجعل القرآن الكريم ربيع قلبها ونور دربها';

/** تحويل الأرقام إلى أرقام عربية مشرقية */
const ar = (s: string | number) =>
  String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const TEAL = '#045E63';

/** كل القيم المتغيرة في الشهادة بنفس تنسيق الاسم: Alyamama ExtraBold تركوازي */
const V = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontFamily: "'Alyamama ExtraBold', 'Alyamama', serif", color: TEAL }}>
    {children}
  </span>
);

/**
 * الشهادة بمقاس A4 أفقي حقيقي (297×210 ملم) فوق خلفية الجمعية.
 * الأحجام بالنقاط مطابقة لقالب Word: العنوان Doran ExtraBold ‏30pt،
 * والمتن Alyamama ‏20pt. للمعاينة على الشاشة يُصغَّر بـ transform خارجيًا.
 */
export default function CertificateView({ data }: { data: CertificateData }) {
  const isCompletion = data.type === 'completion';

  return (
    <div
      dir="rtl"
      style={{
        width: '297mm',
        height: '210mm',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}
    >
      <img
        src={bg}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* العنوان */}
      <div
        style={{
          position: 'absolute',
          top: '52mm',
          right: '10mm',
          width: '244mm',
          textAlign: 'center',
          fontFamily: "'Doran ExtraBold', 'Amiri', serif",
          fontSize: '30pt',
          color: TEAL,
        }}
      >
        {isCompletion ? 'إتمـــام برنامـــج الوقـــار' : 'مشاركة في برنامج الوقار'}
      </div>

      {/* المتن — منطقة ثابتة بين العنوان والتواقيع، والنص يتوسّطها عموديًا
          حتى لا يطغى على التواقيع مهما طالت الأسماء أو أسماء السور */}
      <div
        style={{
          position: 'absolute',
          top: '66mm',
          right: '32mm',
          width: '200mm',
          height: '76mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: "'Alyamama', 'Amiri', serif",
          fontSize: '18pt',
          lineHeight: 1.7,
          color: '#222',
        }}
      >
        <p style={{ margin: 0 }}>
          تشهد جمعية تعلم للقرآن وعلومه أن الطالبة: <V>{data.name}</V>
        </p>
        <p style={{ margin: 0 }}>
          {isCompletion ? (
            <>
              أتمت برنامج الوقار وأنجزت (<V>{ar(data.juzText ?? '')}</V>) من سورة (
              <V>{data.fromSurah}</V>) الى سورة (<V>{data.toSurah}</V>) {ar(DAYS_TEXT)}{' '}
              {VENUE_TEXT}{' '}
              {data.score && data.grade ? (
                <>
                  بمعدل (<V>{ar(data.score)}</V>) وبتقدير (<V>{data.grade}</V>){' '}
                </>
              ) : null}
              {ar(SESSION_COMPLETION)}
            </>
          ) : (
            <>
              شاركت في برنامج الوقار من سورة (<V>{data.fromSurah}</V>) الى سورة (
              <V>{data.toSurah}</V>) {ar(DAYS_TEXT)} {VENUE_TEXT} {ar(SESSION_PARTICIPATION)}
            </>
          )}
        </p>
        <p style={{ margin: '4mm 0 0' }}>{DUA_TEXT}</p>
      </div>
    </div>
  );
}
