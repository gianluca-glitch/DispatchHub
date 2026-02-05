'use client';

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDispatchStore, useCommandCenterStore } from '@/stores';
import { useJobs } from '@/hooks';
import { JobRow } from './job-row';
import { JobDashboard } from './job-dashboard';
import { RouteOverviewPanel } from './route-overview-panel';
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

  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [scrollToJobId, setScrollToJobId] = useState<string | null>(null);
  const [highlightedTruckId, setHighlightedTruckId] = useState<string | null>(null);
  const [highlightedTruckColor, setHighlightedTruckColor] = useState<string | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!scrollToJobId) return;
    const t = setTimeout(() => setScrollToJobId(null), 800);
    return () => clearTimeout(t);
  }, [scrollToJobId]);

  const handleRowClick = useCallback(
    (job: (typeof jobs)[0]) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        setSelectedJobId(job.id);
        setHighlightedJob(job.id);
        return;
      }
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        if (job.truckId) {
          setExpandedRouteId(job.truckId);
          setScrollToJobId(job.id);
        }
        setHighlightedJob(job.id);
      }, 250);
    },
    [setSelectedJobId, setHighlightedJob]
  );

  const handleRowDoubleClick = useCallback(
    (job: (typeof jobs)[0]) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      setSelectedJobId(job.id);
      setHighlightedJob(job.id);
    },
    [setSelectedJobId, setHighlightedJob]
  );

  const handleOpenJob = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId);
      setHighlightedJob(jobId);
    },
    [setSelectedJobId, setHighlightedJob]
  );

  const handleHighlightTruck = useCallback((truckId: string | null, color?: string) => {
    setHighlightedTruckId(truckId);
    setHighlightedTruckColor(color ?? null);
  }, []);

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
    <div className="h-full w-full flex flex-col min-h-0 min-w-0">
      {/* Three-panel row: takes remaining space */}
      <div className="flex-1 min-h-0 flex min-w-0">
        {/* 50% left: Date, stats, job table */}
        <div className="flex flex-col flex-[10] min-w-0 min-h-0 h-full overflow-hidden pr-2">
        {/* Header row: date picker + stats — fixed height */}
        <div className="flex-shrink-0 flex items-center gap-2 mb-4">
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
        <div className="flex-shrink-0 flex flex-wrap gap-4 mb-4">
          <StatPill label="Total jobs" value={stats.total} />
          <StatPill label="Completed" value={stats.completed} className="text-success" />
          <StatPill label="Scheduled / In progress" value={stats.inProgress} className="text-info" />
          <StatPill label="Delayed" value={stats.delayed} className="text-danger" />
        </div>

        {/* Job table — compact grid, adaptive row height, vertical scroll */}
        <div
          ref={tableScrollRef}
          className="flex-1 min-h-0 flex flex-col border border-border rounded bg-surface-0 overflow-hidden"
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
            <>
              {/* Table header — compact */}
              <div
                className={cn(
                  'grid grid-cols-[10%_18%_22%_12%_12%_12%_8%_6%] flex-shrink-0 gap-0',
                  'text-[11px] py-1.5 uppercase tracking-wide font-medium text-text-3',
                  'bg-surface-1 border-b border-border'
                )}
              >
                <div className="pl-4 pr-2">Time</div>
                <div className="px-2">Customer</div>
                <div className="px-2">Address</div>
                <div className="px-2">Type</div>
                <div className="px-2">Truck</div>
                <div className="px-2">Driver</div>
                <div className="px-2">Status</div>
                <div className="px-2">Priority</div>
              </div>
              {/* Table body — rows always distribute to fill panel */}
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
                {jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    className="flex-1 min-h-[36px] max-h-[80px]"
                    onClick={() => handleRowClick(job)}
                    onDoubleClick={() => handleRowDoubleClick(job)}
                    highlighted={highlightedJobId === job.id}
                    highlightBorderColor={
                      job.truckId && highlightedTruckId === job.truckId ? highlightedTruckColor : null
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
        </div>
        {/* 35% middle: route overview — fills height, scrolls inside */}
        <div className="flex flex-col flex-[7] min-w-0 min-h-0 h-full overflow-hidden">
          <RouteOverviewPanel
            date={selectedDate}
            onOpenJob={handleOpenJob}
            highlightedJobId={highlightedJobId}
            expandedRouteId={expandedRouteId}
            scrollToJobId={scrollToJobId}
            onHighlightTruck={handleHighlightTruck}
          />
        </div>
        {/* 15% right: AI sidebar — fills height, scrolls inside */}
        <div className="flex flex-col flex-[3] min-w-0 min-h-0 h-full overflow-hidden">
          <AiChatSidebar selectedDate={selectedDate} onApplied={refetchJobs} />
        </div>
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
