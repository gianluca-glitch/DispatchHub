'use client';

import { Badge } from '@/components/ui/badge';
import {
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  type CartingJob,
  type JobType,
  type JobStatus,
  type Priority,
} from '@/types';
import { cn } from '@/lib/utils';

export interface JobRowProps {
  job: CartingJob;
  className?: string;
  onClick: () => void;
  onDoubleClick?: () => void;
  highlighted?: boolean;
  /** When set, show a left border with this color (e.g. when route card is hovered) */
  highlightBorderColor?: string | null;
}

const JOB_TYPE_PILL: Record<JobType, string> = {
  PICKUP: 'bg-info/20 text-info border-info/40',
  DROP_OFF: 'bg-success/20 text-success border-success/40',
  DUMP_OUT: 'bg-amber/20 text-amber border-amber/40',
  SWAP: 'bg-purple/20 text-purple border-purple/40',
  HAUL: 'bg-surface-2 text-text-2 border-border',
};

const JOB_STATUS_PILL: Record<JobStatus, string> = {
  SCHEDULED: 'bg-info/20 text-info',
  IN_PROGRESS: 'bg-amber/20 text-amber',
  COMPLETED: 'bg-success/20 text-success',
  CANCELLED: 'bg-text-3 text-text-2',
  DELAYED: 'bg-danger/20 text-danger',
};

const STATUS_DOT: Record<JobStatus, string> = {
  SCHEDULED: 'bg-info',
  IN_PROGRESS: 'bg-amber',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-text-3',
  DELAYED: 'bg-danger',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  NORMAL: 'bg-surface-2 text-text-2 border-border',
  HIGH: 'bg-amber/15 text-amber border-amber/40',
  URGENT: 'bg-danger/15 text-danger border-danger/40',
};

const ROW_GRID = 'grid grid-cols-[10%_18%_22%_12%_12%_12%_8%_6%] gap-0 min-w-0';

export function JobRow({
  job,
  className,
  onClick,
  onDoubleClick,
  highlighted,
  highlightBorderColor,
}: JobRowProps) {
  const time = job.time || '—';
  const customer = job.customer || '—';
  const address = job.address || '—';
  const truckName = job.truck?.name ?? '—';
  const driverName = job.driver?.name ?? '—';

  return (
    <div
      role="row"
      data-job-id={job.id}
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onDoubleClick?.();
        }
      }}
      className={cn(
        ROW_GRID,
        'items-center border-b border-border hover:bg-surface-1 cursor-pointer transition-colors',
        'text-[12px] py-1.5',
        highlighted && 'bg-amber/10 ring-inset ring-1 ring-amber/30',
        highlightBorderColor && 'border-l-4',
        className
      )}
      style={highlightBorderColor ? { borderLeftColor: highlightBorderColor } : undefined}
    >
      <div
        className="pl-4 pr-2 text-[11px] tabular-nums font-mono text-text-1 whitespace-nowrap overflow-hidden text-ellipsis min-w-0"
        title={time}
      >
        {time}
      </div>
      <div className="px-2 text-[12px] text-text-0 truncate min-w-0" title={customer}>
        {customer}
      </div>
      <div className="px-2 text-[12px] text-text-2 truncate min-w-0" title={address}>
        {address}
      </div>
      <div className="px-2 overflow-hidden min-w-0 flex items-center">
        <span
          className={cn(
            'inline-flex rounded border text-[10px] px-1.5 py-0.5 font-medium',
            JOB_TYPE_PILL[job.type as JobType]
          )}
        >
          {JOB_TYPE_LABELS[job.type as JobType]}
        </span>
      </div>
      <div className="px-2 text-[12px] text-text-1 truncate min-w-0" title={truckName}>
        {truckName}
      </div>
      <div className="px-2 text-[12px] text-text-1 truncate min-w-0" title={driverName}>
        {driverName}
      </div>
      <div className="px-2 overflow-hidden min-w-0 flex items-center">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 font-medium',
            JOB_STATUS_PILL[job.status as JobStatus]
          )}
        >
          <span
            className={cn('h-1 w-1 rounded-full shrink-0', STATUS_DOT[job.status as JobStatus])}
          />
          {JOB_STATUS_LABELS[job.status as JobStatus]}
        </span>
      </div>
      <div className="px-2 overflow-hidden min-w-0 flex items-center">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0.5 font-medium', PRIORITY_BADGE[job.priority as Priority])}
        >
          {PRIORITY_LABELS[job.priority as Priority]}
        </Badge>
      </div>
    </div>
  );
}
