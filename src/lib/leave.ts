// src/lib/leave.ts
// أنواع الاستئذان: تُقرأ من جدول leave_types (يُدار من الإعدادات).
// تشترك فيها صفحة الاستئذان وتسجيل الحضور (/attend).
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const leaveStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

// أنواع افتراضية احتياطية إن تعذّر تحميلها من القاعدة (قبل تشغيل الهجرة أو خطأ اتصال).
export const DEFAULT_LEAVE_TYPES = ['إذن خروج', 'إجازة مرضية', 'إجازة طارئة', 'إذن زيارة', 'أخرى'];

/** أنواع الاستئذان الفعّالة (labels) مرتّبة حسب sort_order. */
export function useLeaveTypes(): { types: string[]; loading: boolean } {
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('leave_types')
      .select('label')
      .eq('is_active', true)
      .order('sort_order')
      .order('label')
      .then(({ data, error }) => {
        if (cancelled) return;
        const labels = (data || []).map((r: { label: string }) => r.label);
        // احتياطي: لو الجدول غير موجود بعد أو فارغ، استخدم القائمة الافتراضية.
        setTypes(error || labels.length === 0 ? DEFAULT_LEAVE_TYPES : labels);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  return { types, loading };
}
