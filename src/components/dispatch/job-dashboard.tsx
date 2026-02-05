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
import { RouteMapPanel } from './route-map-panel';
import { WarRoomPanel } from './war-room-panel';
import { useJob, useWorkers, useTrucks } from '@/hooks';
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
import { cn, formatTime } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';
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

const JOB_TYPES: JobType[] = ['PICKUP', 'DROP_OFF', 'DUMP_OUT'];
const JOB_STATUSES: JobStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELAYED'];
const PRIORITIES: Priority[] = ['NORMAL', 'HIGH', 'URGENT'];
const BOROUGHS: Borough[] = ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN_ISLAND'];

function describePayloadChanges(
  payload: Record<string, unknown>,
  ctx: { trucks: { id: string; name: string }[]; workers: { id: string; name: string }[] }
): string {
  const parts: string[] = [];
  if (payload.type != null) parts.push(`type → ${JOB_TYPE_LABELS[payload.type as JobType] ?? payload.type}`);
  if (payload.status != null) parts.push(`status → ${JOB_STATUS_LABELS[payload.status as JobStatus] ?? payload.status}`);
  if (payload.borough != null) parts.push(`borough → ${BOROUGH_LABELS[payload.borough as Borough] ?? payload.borough}`);
  if (payload.date != null) parts.push(`date → ${String(payload.date)}`);
  if (payload.time != null) parts.push(`time → ${formatTime(String(payload.time))}`);
  if (payload.containerSize != null) parts.push(`container → ${String(payload.containerSize)}`);
  if (payload.priority != null) parts.push(`priority → ${PRIORITY_LABELS[payload.priority as Priority] ?? payload.priority}`);
  if ('truckId' in payload) {
    if (payload.truckId == null) parts.push('truck unassigned');
    else {
      const name = ctx.trucks.find((t) => t.id === payload.truckId)?.name ?? String(payload.truckId);
      parts.push(`truck → ${name}`);
    }
  }
  if ('driverId' in payload) {
    if (payload.driverId == null) parts.push('driver unassigned');
    else {
      const name = ctx.workers.find((w) => w.id === payload.driverId)?.name ?? String(payload.driverId);
      parts.push(`driver → ${name}`);
    }
  }
  if (payload.notes != null) parts.push('notes updated');
  return parts.length ? parts.join('; ') : 'updated';
}

export function JobDashboard({ jobId, date, onClose, onApplied }: JobDashboardProps) {
  const { data: job, loading: jobLoading, refetch: refetchJob } = useJob(jobId);
  const { data: workersData } = useWorkers();
  const { data: trucksData } = useTrucks();
  const workers = workersData ?? [];
  const trucks = trucksData ?? [];
  const open = !!jobId;
  const routeDate = job ? jobDateStr(job) : date;

  const { modifiedFields, setModifiedField, clearModifiedFields, triggerDispatchRefetch, addSidebarMessage } = useCommandCenterStore();

  const hasModifications = Object.keys(modifiedFields).length > 0;
  const [patchLoading, setPatchLoading] = useState(false);

  const refetchAll = useCallback(() => {
    refetchJob();
    if (onApplied) onApplied();
    triggerDispatchRefetch();
  }, [refetchJob, onApplied, triggerDispatchRefetch]);

  const patchJob = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!jobId) return;
      setPatchLoading(true);
      try {
        const res = await fetch('/api/jobs/' + jobId, {
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
          const customer = typeof job?.customer === 'string' ? job.customer : 'Job';
          const what = describePayloadChanges(payload, { trucks, workers });
          addSidebarMessage({
            role: 'assistant',
            content: `📋 Job updated: ${customer} — ${what}. Schedule refreshed.`,
            type: 'text',
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setPatchLoading(false);
      }
    },
    [jobId, job?.customer, refetchAll, clearModifiedFields, addSidebarMessage, trucks, workers]
  );

  const handleSaveChanges = useCallback(() => {
    if (!hasModifications) return;
    patchJob(modifiedFields);
  }, [hasModifications, modifiedFields, patchJob]);

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
              <span className="font-mono text-sm text-text-2 shrink-0">{formatTime(job.time)}</span>
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
        <div className="flex-1 grid grid-cols-[20%_45%_35%] min-h-0">
          {/* LEFT PANEL — 20%: Compact job details */}
          <div className="flex flex-col border-r border-border overflow-y-auto bg-surface-0 min-w-0">
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
                <FieldRow label="Type" modified={false}>
                  <Select
                    value={job.type}
                    onValueChange={(v) => patchJob({ type: v })}
                    disabled={patchLoading}
                  >
                    <SelectTrigger className="h-8 bg-surface-1 border-border font-mono text-sm">
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
                    <SelectTrigger className="h-8 bg-surface-1 border-border font-mono text-sm">
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
                <div className="col-span-2">
                  <span className="text-xs text-text-3 block mb-0.5">Customer</span>
                  <p className="font-semibold text-text-0 text-sm truncate">{job.customer}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-text-3 block mb-0.5">Address</span>
                  <p className="font-semibold text-text-0 text-sm truncate">{job.address}</p>
                </div>
                <FieldRow label="Borough" modified={false}>
                  <Select
                    value={job.borough}
                    onValueChange={(v) => patchJob({ borough: v })}
                    disabled={patchLoading}
                  >
                    <SelectTrigger className="h-8 bg-surface-1 border-border font-mono text-sm">
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
                    type="date"
                    className="h-8 font-mono bg-surface-1 text-sm"
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
                    className="h-8 font-mono bg-surface-1 text-sm w-full"
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
                    className="h-8 font-mono bg-surface-1 text-sm"
                    defaultValue={job.containerSize ?? ''}
                    placeholder="20yd"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (job.containerSize ?? null)) patchJob({ containerSize: v });
                    }}
                    disabled={patchLoading}
                  />
                </FieldRow>
              </div>
              <div>
                <FieldRow label="Priority" modified={false}>
                  <Select
                    value={job.priority}
                    onValueChange={(v) => patchJob({ priority: v })}
                    disabled={patchLoading}
                  >
                    <SelectTrigger className="h-8 bg-surface-1 border-border font-mono text-sm">
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
              </div>
              <div>
                <FieldRow label="Truck" modified={modifiedFields.truckId !== undefined}>
                  <Select
                    value={displayTruckId ?? '__none__'}
                    onValueChange={(v) => setModifiedField('truckId', v === '__none__' ? null : v)}
                    disabled={patchLoading}
                  >
                    <SelectTrigger className={cn('h-8 bg-surface-1 border-border font-mono text-sm w-full', modifiedFields.truckId !== undefined && 'ring-1 ring-amber/50')}>
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
              </div>
              <div>
                <FieldRow label="Driver" modified={modifiedFields.driverId !== undefined}>
                  <Select
                    value={displayDriverId ?? '__none__'}
                    onValueChange={(v) => setModifiedField('driverId', v === '__none__' ? null : v)}
                    disabled={patchLoading}
                  >
                    <SelectTrigger className={cn('h-8 bg-surface-1 border-border font-mono text-sm w-full', modifiedFields.driverId !== undefined && 'ring-1 ring-amber/50')}>
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
              </div>
              <div>
                <FieldRow label="Notes" modified={false}>
                  <textarea
                    className="min-h-[2.5rem] max-h-[4rem] w-full rounded border border-border bg-surface-1 px-2 py-1.5 text-sm text-text-0 placeholder:text-text-3 resize-y"
                    defaultValue={job.notes ?? ''}
                    placeholder="Notes"
                    rows={2}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (job.notes ?? null)) patchJob({ notes: v });
                    }}
                    disabled={patchLoading}
                  />
                </FieldRow>
              </div>
              <Button
                type="button"
                className="w-full h-8 text-sm bg-amber text-black hover:bg-amber/90 font-medium"
                onClick={handleSaveChanges}
                disabled={!hasModifications || patchLoading}
              >
                {patchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* MIDDLE PANEL — 45%: Map is the star */}
          <div className="flex flex-col min-h-0 min-w-0 border-r border-border">
            <RouteMapPanel
              jobId={job.id}
              truckId={displayTruckId}
              truckName={effectiveTruck?.name ?? 'No truck'}
              date={routeDate}
            />
          </div>

          {/* RIGHT PANEL — 35%: Smart AI panel */}
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
  modified,
}: {
  label: string;
  children: React.ReactNode;
  modified?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-3 uppercase tracking-wide">{label}</span>
        {modified && <span className="w-2 h-2 rounded-full bg-amber shrink-0" title="Modified" />}
      </div>
      {children}
    </div>
  );
}
