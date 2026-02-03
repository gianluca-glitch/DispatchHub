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
  onClick: () => void;
}

const JOB_TYPE_PILL: Record<JobType, string> = {
  PICKUP: 'bg-info/20 text-info border-info/40',
  DROP_OFF: 'bg-success/20 text-success border-success/40',
  DUMP_OUT: 'bg-amber/20 text-amber border-amber/40',
  SWAP: 'bg-purple/20 text-purple border-purple/40',
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

export function JobRow({ job, onClick }: JobRowProps) {
  const time = job.time || '—';
  const customer = job.customer || '—';
  const address = job.address || '—';
  const truckName = job.truck?.name ?? '—';
  const driverName = job.driver?.name ?? '—';

  return (
    <tr
      onClick={onClick}
      className="border-b border-border hover:bg-surface-1 cursor-pointer transition-colors"
    >
      <td className="py-2.5 pl-4 pr-2 font-mono text-sm text-text-1 whitespace-nowrap">
        {time}
      </td>
      <td className="py-2.5 px-2 text-sm text-text-0">{customer}</td>
      <td className="py-2.5 px-2 text-sm text-text-2 max-w-[200px] truncate" title={address}>
        {address}
      </td>
      <td className="py-2.5 px-2">
        <span
          className={cn(
            'inline-flex rounded border px-2 py-0.5 text-xs font-medium',
            JOB_TYPE_PILL[job.type as JobType]
          )}
        >
          {JOB_TYPE_LABELS[job.type as JobType]}
        </span>
      </td>
      <td className="py-2.5 px-2 text-sm text-text-1">{truckName}</td>
      <td className="py-2.5 px-2 text-sm text-text-1">{driverName}</td>
      <td className="py-2.5 px-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium',
            JOB_STATUS_PILL[job.status as JobStatus]
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[job.status as JobStatus])}
          />
          {JOB_STATUS_LABELS[job.status as JobStatus]}
        </span>
      </td>
      <td className="py-2.5 px-2">
        <Badge
          variant="outline"
          className={cn('text-xs font-medium', PRIORITY_BADGE[job.priority as Priority])}
        >
          {PRIORITY_LABELS[job.priority as Priority]}
        </Badge>
      </td>
    </tr>
  );
}
