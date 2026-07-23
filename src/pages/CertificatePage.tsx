import { useLayoutEffect } from 'react';
import logoImg from '@/assets/logo.png';

// صفحة مؤقتة لرابط الشهادات — تُستبدل بصفحة الشهادات الكاملة لاحقًا
export default function CertificatePage() {
  useLayoutEffect(() => {
    const previous = document.title;
    document.title = 'شهادات برنامج الوقار';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <img src={logoImg} alt="جمعية تعلم للقرآن وعلومه" className="mx-auto h-16 w-auto object-contain" />
        <h1 className="font-display text-3xl sm:text-4xl text-foreground">الحمدلله على التمام</h1>
      </div>
    </div>
  );
}
