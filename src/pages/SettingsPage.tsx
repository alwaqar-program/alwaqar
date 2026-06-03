import { Card, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إعدادات النظام</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Settings size={40} className="text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">قريباً — إعدادات النظام</p>
          <p className="text-sm text-muted-foreground/60 mt-1">مستهدفات الإنجاز، معايير التقدير، قواعد التصعيد</p>
        </CardContent>
      </Card>
    </div>
  );
}
