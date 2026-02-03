'use client';

import { cn } from '@/lib/utils';

export interface ConfidenceBarProps {
  value: number; // 0-100
  className?: string;
}

export function ConfidenceBar({ value, className }: ConfidenceBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 90 ? 'bg-success' : pct >= 70 ? 'bg-amber' : 'bg-danger';

  return (
    <div
      className={cn('h-2 w-full rounded bg-surface-2 overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded transition-all', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
