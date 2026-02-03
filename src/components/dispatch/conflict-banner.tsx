'use client';

import { AlertTriangle, AlertCircle } from 'lucide-react';
import type { Conflict } from '@/types';
import { cn } from '@/lib/utils';

export interface ConflictBannerProps {
  conflict: Conflict;
  className?: string;
}

export function ConflictBanner({ conflict, className }: ConflictBannerProps) {
  const isCritical = conflict.severity === 'CRITICAL';
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded border px-3 py-2 text-sm',
        isCritical
          ? 'border-danger/50 bg-danger/10 text-danger'
          : 'border-amber/50 bg-amber/10 text-amber',
        className
      )}
    >
      {isCritical ? (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <span>{conflict.message}</span>
    </div>
  );
}

export interface ConflictBannerListProps {
  conflicts: Conflict[];
  className?: string;
}

export function ConflictBannerList({ conflicts, className }: ConflictBannerListProps) {
  if (conflicts.length === 0) return null;
  return (
    <div className={cn('space-y-2', className)}>
      {conflicts.map((c) => (
        <ConflictBanner key={`${c.type}-${c.affectedJobId ?? c.affectedWorkerId ?? c.affectedTruckId ?? c.message}`} conflict={c} />
      ))}
    </div>
  );
}
