import { Card, CardContent } from '@/components/ui/card';
import { Settings, DoorOpen, Clock } from 'lucide-react';
import { LookupManager } from '@/components/settings/LookupManager';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إعدادات النظام</p>
      </div>

      <LookupManager
        table="leave_types"
        title="أنواع الاستئذان"
        description="تظهر هذه الأنواع في تسجيل الاستئذان وفي صفحة الحضور."
        icon={<DoorOpen size={20} className="text-primary" />}
        placeholder="مثال: إذن خروج"
      />

      <LookupManager
        table="late_reasons"
        title="أسباب التأخير"
        description="تظهر عند تسجيل «متأخرة» في الحضور. فعّلي «يتطلب ملاحظة» للسبب الذي يحتاج نصاً حرّاً (مثل «أخرى»)."
        icon={<Clock size={20} className="text-primary" />}
        placeholder="مثال: مواصلات"
        hasNoteFlag
      />

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Settings size={36} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground/60">مزيد من الإعدادات قريباً — مستهدفات الإنجاز، معايير التقدير</p>
        </CardContent>
      </Card>
    </div>
  );
}
