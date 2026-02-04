'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConflictBannerList } from './conflict-banner';
import { RouteMap } from './route-map';
import { ScenarioPanel } from './scenario-panel';
import { useJob, useConflicts, useWorkers, useTrucks, useRoutes } from '@/hooks';
import { useDispatchStore, useCommandCenterStore } from '@/stores';
import {
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  BOROUGH_LABELS,
  type CartingJob,
  type JobType,
  type JobStatus,
  type Priority,
  type Borough,
  type Conflict,
  type AiWorkerRecommendation,
} from '@/types';
import { cn } from '@/lib/utils';
import { Truck, User, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface JobDashboardProps {
  jobId: string | null;
  date: string;
  onClose: () => void;
  onApplied?: () => void;
}

// Normalize job date from API (ISO or YYYY-MM-DD)
function jobDateStr(job: CartingJob): string {
  const d = job.date;
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return (d as unknown as string).slice(0, 10);
}

const JOB_TYPES: JobType[] = ['PICKUP', 'DROP_OFF', 'DUMP_OUT', 'SWAP'];
const JOB_STATUSES: JobStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELAYED'];
const PRIORITIES: Priority[] = ['NORMAL', 'HIGH', 'URGENT'];
const BOROUGHS: Borough[] = ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN_ISLAND'];

export function JobDashboard({ jobId, date, onClose, onApplied }: JobDashboardProps) {
  const { data: job, loading: jobLoading, refetch: refetchJob } = useJob(jobId);
  const { data: conflictsData, refetch: refetchConflicts } = useConflicts(jobId, date);
  const conflicts = conflictsData ?? [];
  const { data: workersData } = useWorkers();
  const workers = workersData ?? [];
  const { data: trucksData } = useTrucks();
  const trucks = trucksData ?? [];
  const { data: routesData } = useRoutes(date);
  const allRoutes = routesData ?? [];
  const jobTruckRoute = job?.truckId
    ? allRoutes.filter((r) => r.truckId === job.truckId)
    : [];

  const scenarioResult = useCommandCenterStore((s) => s.scenarioResult);
  const scenarioLoading = useCommandCenterStore((s) => s.scenarioLoading);
  const activeScenario = useCommandCenterStore((s) => s.activeScenario);

  const [recommendations, setRecommendations] = useState<AiWorkerRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [patchLoading, setPatchLoading] = useState(false);
  const truckSelectRef = useRef<HTMLButtonElement>(null);
  const driverSelectRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const open = !!jobId;
  const setHighlightedJob = useCommandCenterStore((s) => s.setHighlightedJob);
  const setScenario = useCommandCenterStore((s) => s.setScenario);

  // Fetch worker recommendations when job opens
  useEffect(() => {
    if (!jobId || !job?.customer) return;
    setRecLoading(true);
    const jobContext = [
      job.customer,
      job.address,
      job.type,
      jobDateStr(job),
      job.time,
      job.notes ?? '',
    ].join(' | ');
    fetch('/api/workers/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobContext }),
    })
      .then((res) => res.json())
      .then((json) => setRecommendations(json.data ?? []))
      .catch(() => setRecommendations([]))
      .finally(() => setRecLoading(false));
  }, [jobId, job?.customer, job?.address, job?.type, job?.date, job?.time, job?.notes]);

  const refetchAll = useCallback(() => {
    refetchJob();
    refetchConflicts();
  }, [refetchJob, refetchConflicts]);

  const patchJob = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!jobId) return;
      setPatchLoading(true);
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Update failed');
        if (json.changed) toast.success('Job updated');
        refetchAll();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setPatchLoading(false);
        setEditingField(null);
      }
    },
    [jobId, refetchAll]
  );

  const applyFix = useCallback(
    (type: 'SWAP_TRUCK' | 'SWAP_DRIVER' | 'RESCHEDULE') => {
      if (!jobId) return;
      if (type === 'SWAP_TRUCK') {
        setHighlightedJob(jobId);
        setScenario({ type: 'SWAP_TRUCK', affectedJobId: jobId });
        onClose();
      } else if (type === 'SWAP_DRIVER') {
        setHighlightedJob(jobId);
        setScenario({ type: 'SWAP_DRIVER', affectedJobId: jobId });
        onClose();
      } else {
        dateInputRef.current?.focus();
      }
    },
    [jobId, onClose, setHighlightedJob, setScenario]
  );

  const assignDriver = useCallback(
    (workerId: string) => {
      patchJob({ driverId: workerId });
    },
    [patchJob]
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-surface-0 border-border">
        <DialogHeader>
          <DialogTitle className="text-text-0">Job details</DialogTitle>
        </DialogHeader>

        {jobLoading || !job ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
            {/* 60/40: job details left, route map right */}
            <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-4 min-h-0 flex-1">
              <div className="flex flex-col gap-4 overflow-y-auto pr-2 min-h-0">
                {/* Conflict banners */}
                <ConflictBannerList conflicts={conflicts} />

            {/* AI fix options */}
            {conflicts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber/40 text-amber hover:bg-amber/10"
                  onClick={() => applyFix('SWAP_TRUCK')}
                >
                  <Truck className="h-3.5 w-3.5 mr-1" />
                  Swap truck
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber/40 text-amber hover:bg-amber/10"
                  onClick={() => applyFix('SWAP_DRIVER')}
                >
                  <User className="h-3.5 w-3.5 mr-1" />
                  Swap driver
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber/40 text-amber hover:bg-amber/10"
                  onClick={() => applyFix('RESCHEDULE')}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Reschedule
                </Button>
              </div>
            )}

            {/* Job fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <FieldRow label="Type">
                <Select
                  value={job.type}
                  onValueChange={(v) => patchJob({ type: v })}
                  disabled={patchLoading}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {JOB_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Status">
                <Select
                  value={job.status}
                  onValueChange={(v) => patchJob({ status: v })}
                  disabled={patchLoading}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {JOB_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Customer">
                {editingField === 'customer' ? (
                  <Input
                    className="h-9 font-mono bg-surface-1"
                    defaultValue={job.customer}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== job.customer) patchJob({ customer: v });
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    autoFocus
                  />
                ) : (
                  <ValueCell
                    value={job.customer}
                    onClick={() => setEditingField('customer')}
                  />
                )}
              </FieldRow>

              <FieldRow label="Address">
                {editingField === 'address' ? (
                  <Input
                    className="h-9 font-mono bg-surface-1"
                    defaultValue={job.address}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== job.address) patchJob({ address: v });
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    autoFocus
                  />
                ) : (
                  <ValueCell
                    value={job.address}
                    onClick={() => setEditingField('address')}
                  />
                )}
              </FieldRow>

              <FieldRow label="Borough">
                <Select
                  value={job.borough}
                  onValueChange={(v) => patchJob({ borough: v })}
                  disabled={patchLoading}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOROUGHS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {BOROUGH_LABELS[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Date">
                <Input
                  ref={dateInputRef}
                  type="date"
                  className="h-9 font-mono bg-surface-1"
                  value={jobDateStr(job)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v !== jobDateStr(job)) patchJob({ date: v });
                  }}
                  disabled={patchLoading}
                />
              </FieldRow>

              <FieldRow label="Time">
                {editingField === 'time' ? (
                  <Input
                    className="h-9 font-mono bg-surface-1 w-24"
                    defaultValue={job.time}
                    placeholder="HH:MM"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== job.time) patchJob({ time: v });
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    autoFocus
                  />
                ) : (
                  <ValueCell
                    value={job.time}
                    onClick={() => setEditingField('time')}
                    className="font-mono"
                  />
                )}
              </FieldRow>

              <FieldRow label="Container">
                {editingField === 'containerSize' ? (
                  <Input
                    className="h-9 font-mono bg-surface-1 w-24"
                    defaultValue={job.containerSize ?? ''}
                    placeholder="20yd"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (job.containerSize ?? null)) patchJob({ containerSize: v });
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    autoFocus
                  />
                ) : (
                  <ValueCell
                    value={job.containerSize ?? '—'}
                    onClick={() => setEditingField('containerSize')}
                  />
                )}
              </FieldRow>

              <FieldRow label="Priority">
                <Select
                  value={job.priority}
                  onValueChange={(v) => patchJob({ priority: v })}
                  disabled={patchLoading}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Truck" fullWidth>
                <Select
                  value={job.truckId ?? '__none__'}
                  onValueChange={(v) => patchJob({ truckId: v === '__none__' ? null : v })}
                  disabled={patchLoading}
                >
                  <SelectTrigger
                    ref={truckSelectRef}
                    className="h-9 bg-surface-1 border-border font-mono"
                  >
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {trucks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Driver" fullWidth>
                <Select
                  value={job.driverId ?? '__none__'}
                  onValueChange={(v) => patchJob({ driverId: v === '__none__' ? null : v })}
                  disabled={patchLoading}
                >
                  <SelectTrigger
                    ref={driverSelectRef}
                    className="h-9 bg-surface-1 border-border font-mono"
                  >
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Notes" fullWidth>
                {editingField === 'notes' ? (
                  <Input
                    className="h-9 bg-surface-1"
                    defaultValue={job.notes ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (job.notes ?? null)) patchJob({ notes: v });
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    autoFocus
                  />
                ) : (
                  <ValueCell
                    value={job.notes ?? '—'}
                    onClick={() => setEditingField('notes')}
                  />
                )}
              </FieldRow>
            </div>

            {/* Worker recommendations */}
            <div className="border-t border-border pt-4 mt-2">
              <h4 className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                Worker recommendations
              </h4>
              {recLoading ? (
                <div className="flex items-center gap-2 text-text-3 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : recommendations.length === 0 ? (
                <p className="text-text-3 text-sm">No recommendations</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recommendations.slice(0, 3).map((rec) => (
                    <div
                      key={rec.workerId}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-surface-1 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="text-text-0 font-medium">
                          {(rec as any).worker?.name ?? rec.workerId}
                        </span>
                        <span className="text-text-3 ml-2">Score: {rec.score}</span>
                        {rec.reasons?.length > 0 && (
                          <p className="text-text-3 text-xs mt-0.5">{rec.reasons[0]}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber/40 text-amber hover:bg-amber/10"
                        onClick={() => assignDriver(rec.workerId)}
                        disabled={patchLoading}
                      >
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              </div>
              </div>

              {/* Right: route map for this truck's day */}
              <div className="min-h-[280px] border border-border rounded bg-surface-0 overflow-hidden flex flex-col">
                <h4 className="text-xs font-semibold text-text-2 uppercase tracking-wider px-3 py-2 border-b border-border shrink-0">
                  Route — {job.truck?.name ?? 'Unassigned'}
                </h4>
                <div className="flex-1 min-h-0 p-2">
                  {jobTruckRoute.length > 0 ? (
                    <RouteMap routes={jobTruckRoute} selectedDate={date} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-text-3 text-sm">
                      No route for this truck on this date
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scenario results below when present */}
            {(scenarioResult || scenarioLoading || activeScenario) && (
              <div className="border-t border-border pt-3 shrink-0">
                <ScenarioPanel selectedDate={date} onApplied={() => { onApplied?.(); refetchAll(); }} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-1', fullWidth && 'sm:col-span-2')}>
      <span className="text-text-3 text-xs font-medium">{label}</span>
      {children}
    </div>
  );
}

function ValueCell({
  value,
  onClick,
  className,
}: {
  value: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 rounded border border-transparent px-2 text-left text-text-1 hover:border-border hover:bg-surface-1 text-sm w-full',
        className
      )}
    >
      {value}
    </button>
  );
}
