// src/lib/late-reasons.ts
// أسباب التأخير: تُقرأ من جدول late_reasons (يُدار من الإعدادات).
// السجلات القديمة خزّنت رموزاً (illness/transport/sleep/other)؛ الجديدة تخزّن الـ label.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LateReason { label: string; requires_note: boolean; }

// خريطة توافق للرموز القديمة → التسميات (لعرض السجلات السابقة).
const LEGACY: Record<string, string> = {
  illness: 'مرض', transport: 'مواصلات', sleep: 'نوم', other: 'أخرى',
};

// قائمة افتراضية احتياطية إن تعذّر التحميل من القاعدة (قبل الهجرة أو خطأ اتصال).
export const DEFAULT_LATE_REASONS: LateReason[] = [
  { label: 'مرض', requires_note: false },
  { label: 'مواصلات', requires_note: false },
  { label: 'نوم', requires_note: false },
  { label: 'أخرى', requires_note: true },
];

/** تحويل قيمة مخزّنة (قد تكون رمزاً قديماً) إلى الـ label المعروض/المختار. */
export const normalizeLateReason = (value: string | null): string =>
  value ? (LEGACY[value] ?? value) : '';

/** التسمية المعروضة لسبب التأخير + الملاحظة الحرّة إن وُجدت. */
export const lateReasonLabel = (reason: string | null, other: string | null): string => {
  if (!reason) return '';
  const base = LEGACY[reason] ?? reason;
  return other ? `${base} — ${other}` : base;
};

/** هل يتطلب هذا السبب حقل ملاحظة حرّة؟ (يشمل الرمز القديم other). */
export const reasonNeedsNote = (value: string, reasons: LateReason[]): boolean => {
  if (!value) return false;
  if (value === 'other') return true; // رمز قديم
  const norm = normalizeLateReason(value);
  return reasons.some(r => r.label === norm && r.requires_note);
};

/** أسباب التأخير الفعّالة مرتّبة حسب sort_order. */
export function useLateReasons(): { reasons: LateReason[]; loading: boolean } {
  const [reasons, setReasons] = useState<LateReason[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('late_reasons')
      .select('label, requires_note')
      .eq('is_active', true)
      .order('sort_order')
      .order('label')
      .then(({ data, error }) => {
        if (cancelled) return;
        const rows = (data || []) as LateReason[];
        setReasons(error || rows.length === 0 ? DEFAULT_LATE_REASONS : rows);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  return { reasons, loading };
}
