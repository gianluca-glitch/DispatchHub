'use client';

import { useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDispatchStore, useCommandCenterStore } from '@/stores';
import { useJobs } from '@/hooks';
import { JobRow } from './job-row';
import { JobDashboard } from './job-dashboard';
import { AiChatSidebar } from './ai-chat-sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function DispatchTab() {
  const { selectedDate, setSelectedDate, selectedJobId, setSelectedJobId } = useDispatchStore();
  const setHighlightedJob = useCommandCenterStore((s) => s.setHighlightedJob);
  const { data: jobsData, loading: jobsLoading, refetch: refetchJobs } = useJobs(selectedDate);
  const jobs = jobsData ?? [];
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const highlightedJobId = useCommandCenterStore((s) => s.highlightedJobId);
  const dispatchRefetchTrigger = useCommandCenterStore((s) => s.dispatchRefetchTrigger);
  useEffect(() => {
    if (!highlightedJobId || !tableScrollRef.current) return;
    const row = tableScrollRef.current.querySelector(`[data-job-id="${highlightedJobId}"]`);
    (row as HTMLElement)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedJobId]);
  useEffect(() => {
    if (dispatchRefetchTrigger > 0) refetchJobs();
  }, [dispatchRefetchTrigger, refetchJobs]);

  const stats = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
    const inProgress = jobs.filter((j) =>
      ['SCHEDULED', 'IN_PROGRESS'].includes(j.status)
    ).length;
    const delayed = jobs.filter((j) => j.status === 'DELAYED').length;
    return { total, completed, inProgress, delayed };
  }, [jobs]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] flex-1 min-w-0">
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* 70% left: Date, stats, job table */}
        <div className="flex flex-col flex-[7] min-w-0 min-h-0 overflow-hidden pr-2">
        {/* Date picker */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border text-text-2 hover:text-amber hover:border-amber/40"
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-mono text-text-0 text-lg min-w-[200px] text-center">
            {formatDisplayDate(selectedDate)}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border text-text-2 hover:text-amber hover:border-amber/40"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-4 mb-4">
          <StatPill label="Total jobs" value={stats.total} />
          <StatPill label="Completed" value={stats.completed} className="text-success" />
          <StatPill label="Scheduled / In progress" value={stats.inProgress} className="text-info" />
          <StatPill label="Delayed" value={stats.delayed} className="text-danger" />
        </div>

        {/* Job table */}
        <div
          ref={tableScrollRef}
          className="flex-1 border border-border rounded bg-surface-0 overflow-auto"
        >
          {jobsLoading ? (
            <div className="flex items-center justify-center py-12 text-text-3">
              Loading…
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-text-3 text-sm">
              No jobs for this date
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-surface-1 border-b border-border z-10">
                <tr className="text-left text-xs font-medium text-text-3 uppercase tracking-wider">
                  <th className="py-2.5 pl-4 pr-2 w-16">Time</th>
                  <th className="py-2.5 px-2">Customer</th>
                  <th className="py-2.5 px-2">Address</th>
                  <th className="py-2.5 px-2 w-24">Type</th>
                  <th className="py-2.5 px-2">Truck</th>
                  <th className="py-2.5 px-2">Driver</th>
                  <th className="py-2.5 px-2 w-28">Status</th>
                  <th className="py-2.5 px-2 w-20">Priority</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setHighlightedJob(job.id);
                    }}
                    highlighted={highlightedJobId === job.id}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
        <AiChatSidebar selectedDate={selectedDate} onApplied={refetchJobs} />
      </div>

      {/* Job dashboard modal (includes route map) */}
      <JobDashboard
        jobId={selectedJobId}
        date={selectedDate}
        onClose={() => setSelectedJobId(null)}
        onApplied={refetchJobs}
      />
    </div>
  );
}

function StatPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className="text-text-3 text-sm">{label}</span>
      <span className="font-mono font-semibold text-text-0">{value}</span>
    </div>
  );
}
