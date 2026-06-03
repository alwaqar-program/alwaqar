import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  allowClear?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'ابحث...',
  emptyMessage = 'لا توجد نتائج',
  className,
  allowClear = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find(o => o.value === value)?.label;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <div className="flex items-center gap-1 shrink-0">
            {allowClear && value && (
              <X
                size={14}
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange('');
                }}
              />
            )}
            <ChevronsUpDown size={14} className="text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
          ) : (
            filtered.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  onValueChange(option.value === value ? '' : option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors text-right',
                  value === option.value
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <Check size={14} className={cn('shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                <span className="flex-1 text-right">{option.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
