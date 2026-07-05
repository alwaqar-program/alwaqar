import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A compact −/+ number picker. Value is clamped to [min, max] and never NaN.
 * Used for small integer counts (e.g. عدد الأخطاء / عدد اللحون).
 */
export function NumberStepper({
  value, onChange, min = 0, max = 999, step = 1, className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const btn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40 ' +
    'text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className={cn('flex h-10 items-center justify-between gap-2 rounded-md border px-2', className)}>
      <button type="button" className={btn} onClick={() => set(value - step)} disabled={value <= min} aria-label="نقص">
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
        className="w-12 bg-transparent text-center text-sm font-medium outline-none
                   [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label="زيادة">
        <Plus size={16} />
      </button>
    </div>
  );
}
