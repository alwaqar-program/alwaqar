import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
}

export default function Badge({ children, color = 'bg-slate-100 text-slate-800' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ring-current/10 ${color}`}
    >
      {children}
    </span>
  );
}
