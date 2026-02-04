'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { RouteMapPanel } from './route-map-panel';
import { WarRoomPanel } from './war-room-panel';
import { useJob, useConflicts, useWorkers, useTrucks } from '@/hooks';
import { useCommandCenterStore } from '@/stores';
import {
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  BOROUGH_LABELS,
  TRUCK_TYPE_LABELS,
  WORKER_ROLE_LABELS,
  type CartingJob,
  type JobType,
  type JobStatus,
  type Priority,
  type Borough,
} from '@/types';
import { cn } from '@/lib/utils';
import { Truck, User, Calendar, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export interface JobDashboardProps {
  jobId: string | null;
  date: string;
  onClose: () => void;
  onApplied?: () => void;
}

function jobDateStr(job: CartingJob): string {
  const d = job.date;
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return (d as unknown as string).slice(0, 10);
}

const JOB_TYPES: JobType[] = ['PICKUP', 'DROP_OFF', 'SWAP', 'DUMP_OUT', 'HAUL'];
const JOB_STATUSES: JobStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELAYED'];
const PRIORITIES: Priority[] = ['NORMAL', 'HIGH', 'URGENT'];
const BOROUGHS: Borough[] = ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN_ISLAND'];

export function JobDashboard({ jobId, date, onClose, onApplied }: JobDashboardProps) {
  const { data: job, loading: jobLoading, refetch: refetchJob } = useJob(jobId);
  const { data: conflictsData, refetch: refetchConflicts } = useConflicts(jobId, date);
  const conflicts = conflictsData ?? [];
  const { data: workersData } = useWorkers();
  const { data: trucksData } = useTrucks();
  const workers = workersData ?? [];
  const trucks = trucksData ?? [];
  const open = !!jobId;
  const routeDate = job ? jobDateStr(job) : date;

  const {
    modifiedFields,
    setModifiedField,
    clearModifiedFields,
    setHighlightedJob,
    setScenario,
    triggerDispatchRefetch,
  } = useCommandCenterStore();

  const hasModifications = Object.keys(modifiedFields).length > 0;
  const [patchLoading, setPatchLoading] = useState(false);

  const refetchAll = useCallback(() => {
    refetchJob();
    refetchConflicts();
    if (onApplied) onApplied();
    triggerDispatchRefetch();
  }, [refetchJob, refetchConflicts, onApplied, triggerDispatchRefetch]);

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
        if (json.changed) {
          toast.success('Job updated');
          clearModifiedFields();
          refetchAll();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setPatchLoading(false);
      }
    },
    [jobId, refetchAll, clearModifiedFields]
  );

  const handleSaveChanges = useCallback(() => {
    if (!hasModifications) return;
    patchJob(modifiedFields);
  }, [hasModifications, modifiedFields, patchJob]);

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
        (document.querySelector('[data-field="date"]') as HTMLElement)?.focus();
      }
    },
    [jobId, onClose, setHighlightedJob, setScenario]
  );

  useEffect(() => {
    if (!open) clearModifiedFields();
  }, [open, clearModifiedFields]);

  const displayTruckId = modifiedFields.truckId !== undefined ? modifiedFields.truckId : job?.truckId ?? null;
  const displayDriverId = modifiedFields.driverId !== undefined ? modifiedFields.driverId : job?.driverId ?? null;
  const effectiveTruck = displayTruckId ? trucks.find((t) => t.id === displayTruckId) : null;
  const effectiveDriver = displayDriverId ? workers.find((w) => w.id === displayDriverId) : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* Top bar — 48px */}
      <div className="h-12 shrink-0 flex items-center justify-between border-b border-border px-4 bg-surface-0">
        <div className="flex items-center gap-3 min-w-0">
          {jobLoading || !job ? (
            <span className="text-text-2 text-sm">Loading…</span>
          ) : (
            <>
              <span className="font-semibold text-text-0 truncate">
                {job.customer} — {job.address}
              </span>
              <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2 shrink-0">
                {job.borough ? BOROUGH_LABELS[job.borough] : '—'}
              </span>
              <span className="font-mono text-sm text-text-2 shrink-0">{job.time}</span>
              <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2 shrink-0">
                {job.status ? JOB_STATUS_LABELS[job.status] : '—'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-sm text-text-2">
          {effectiveTruck && <span>{effectiveTruck.name}</span>}
          {effectiveDriver && <span>{effectiveDriver.name}</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-text-2 hover:text-text-0 hover:bg-surface-2"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {jobLoading || !job ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[30%_40%_30%] min-h-0">
          {/* LEFT PANEL — 30%: Job details & manual edit */}
          <div className="flex flex-col border-r border-border overflow-y-auto bg-surface-0 min-w-0">
            <div className="p-4 space-y-6">
              <ConflictBannerList conflicts={conflicts} />

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <FieldRow label="Type" modified={false}>
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
                  <FieldRow label="Status" modified={false}>
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
                  <FieldRow label="Customer" modified={false}>
                    <Input
                      className="h-9 font-mono bg-surface-1 read-only:opacity-80"
                      value={job.customer}
                      readOnly
                    />
                  </FieldRow>
                  <FieldRow label="Address" modified={false}>
                    <Input
                      className="h-9 font-mono bg-surface-1 read-only:opacity-80"
                      value={job.address}
                      readOnly
                    />
                  </FieldRow>
                  <FieldRow label="Borough" modified={false}>
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
                  <FieldRow label="Date" modified={false}>
                    <Input
                      data-field="date"
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
                  <FieldRow label="Time" modified={false}>
                    <Input
                      type="text"
                      className="h-9 font-mono bg-surface-1 w-24"
                      defaultValue={job.time}
                      placeholder="HH:MM"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== job.time) patchJob({ time: v });
                      }}
                      disabled={patchLoading}
                    />
                  </FieldRow>
                  <FieldRow label="Container Size" modified={false}>
                    <Input
                      className="h-9 font-mono bg-surface-1"
                      defaultValue={job.containerSize ?? ''}
                      placeholder="20yd"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (job.containerSize ?? null)) patchJob({ containerSize: v });
                      }}
                      disabled={patchLoading}
                    />
                  </FieldRow>
                  <FieldRow label="Priority" modified={false}>
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
                  <FieldRow label="Truck" fullWidth modified={modifiedFields.truckId !== undefined}>
                    <Select
                      value={displayTruckId ?? '__none__'}
                      onValueChange={(v) => setModifiedField('truckId', v === '__none__' ? null : v)}
                      disabled={patchLoading}
                    >
                      <SelectTrigger className={cn('h-9 bg-surface-1 border-border font-mono', modifiedFields.truckId !== undefined && 'ring-1 ring-amber/50')}>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {trucks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({TRUCK_TYPE_LABELS[t.type]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Driver" fullWidth modified={modifiedFields.driverId !== undefined}>
                    <Select
                      value={displayDriverId ?? '__none__'}
                      onValueChange={(v) => setModifiedField('driverId', v === '__none__' ? null : v)}
                      disabled={patchLoading}
                    >
                      <SelectTrigger className={cn('h-9 bg-surface-1 border-border font-mono', modifiedFields.driverId !== undefined && 'ring-1 ring-amber/50')}>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {workers.filter((w) => w.role === 'DRIVER').map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({WORKER_ROLE_LABELS[w.role]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Notes" fullWidth modified={false}>
                    <textarea
                      className="min-h-[72px] w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm text-text-0 placeholder:text-text-3 resize-y"
                      defaultValue={job.notes ?? ''}
                      placeholder="Notes"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (job.notes ?? null)) patchJob({ notes: v });
                      }}
                      disabled={patchLoading}
                    />
                  </FieldRow>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full h-10 bg-amber text-black hover:bg-amber/90 font-medium"
                  onClick={handleSaveChanges}
                  disabled={!hasModifications || patchLoading}
                >
                  {patchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-amber/40 text-amber hover:bg-amber/10"
                    onClick={() => applyFix('SWAP_TRUCK')}
                  >
                    <Truck className="h-3.5 w-3.5 mr-1" />
                    Swap Truck
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-amber/40 text-amber hover:bg-amber/10"
                    onClick={() => applyFix('SWAP_DRIVER')}
                  >
                    <User className="h-3.5 w-3.5 mr-1" />
                    Swap Driver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-amber/40 text-amber hover:bg-amber/10"
                    onClick={() => applyFix('RESCHEDULE')}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    Reschedule
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE PANEL — 40%: Map & route */}
          <div className="flex flex-col min-h-0 min-w-0 border-r border-border">
            <RouteMapPanel
              truckId={displayTruckId}
              truckName={effectiveTruck?.name ?? 'No truck'}
              date={routeDate}
            />
          </div>

          {/* RIGHT PANEL — 30%: AI war room */}
          <div className="flex flex-col min-h-0 min-w-0">
            <WarRoomPanel job={job} date={routeDate} />
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  children,
  fullWidth,
  modified,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  modified?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-1', fullWidth && 'col-span-2')}>
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-xs font-medium">{label}</span>
        {modified && <span className="w-2 h-2 rounded-full bg-amber shrink-0" title="Modified" />}
      </div>
      {children}
    </div>
  );
}
