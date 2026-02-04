'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkers, useTrucks, useRoutes } from '@/hooks';
import { useCommandCenterStore } from '@/stores';
import type { CartingJob, Worker, Truck, WorkerRole, WorkerStatus, TruckType, TruckStatus } from '@/types';
import {
  TRUCK_TYPE_LABELS,
  WORKER_ROLE_LABELS,
  BOROUGH_LABELS,
} from '@/types';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface WarRoomPanelProps {
  job: CartingJob | null;
  date: string;
  onStagedDriver?: (workerId: string, name: string) => void;
  onStagedTruck?: (truckId: string, name: string) => void;
}

type WorkerRec = { workerId: string; score: number; reasons?: string[]; reason?: string };

function workerStatusColor(s: WorkerStatus): string {
  if (s === 'OUT_SICK') return 'bg-danger';
  if (s === 'OFF_DUTY' || s === 'VACATION') return 'bg-text-3';
  return 'bg-success';
}

function truckStatusColor(s: TruckStatus): string {
  if (s === 'EN_ROUTE') return 'bg-success';
  if (s === 'AVAILABLE') return 'bg-info';
  if (s === 'MAINTENANCE' || s === 'OUT_OF_SERVICE') return 'bg-danger';
  if (s === 'ON_SITE') return 'bg-amber';
  return 'bg-text-3';
}

function scoreColor(score: number): string {
  if (score > 80) return 'text-success';
  if (score >= 60) return 'text-amber';
  return 'text-danger';
}

export function WarRoomPanel({ job, date, onStagedDriver, onStagedTruck }: WarRoomPanelProps) {
  const { data: workersData } = useWorkers();
  const { data: trucksData } = useTrucks();
  const { data: routesData } = useRoutes(date);
  const workers = workersData ?? [];
  const trucks = trucksData ?? [];
  const routes = Array.isArray(routesData) ? routesData : [];
  const truckJobCount = new Map<string, number>();
  const truckBoroughs = new Map<string, string[]>();
  const driverToRoute = new Map<string, { truckName: string; jobCount: number }>();
  for (const r of routes) {
    const count = r.stops?.length ?? 0;
    truckJobCount.set(r.truckId, count);
    const boroughs = [...new Set((r.stops ?? []).map((s: { borough: string }) => s.borough))];
    truckBoroughs.set(r.truckId, boroughs);
    if (r.driverId) driverToRoute.set(r.driverId, { truckName: r.truckName, jobCount: count });
  }
  const setModifiedField = useCommandCenterStore((s) => s.setModifiedField);
  const modifiedFields = useCommandCenterStore((s) => s.modifiedFields);

  const [workerRecs, setWorkerRecs] = useState<WorkerRec[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [workerRoleFilter, setWorkerRoleFilter] = useState<string>('all');
  const [workerAvailFilter, setWorkerAvailFilter] = useState<string>('all');
  const [workerSort, setWorkerSort] = useState<string>('ai');
  const [truckTypeFilter, setTruckTypeFilter] = useState<string>('all');
  const [truckAvailFilter, setTruckAvailFilter] = useState<string>('all');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const jobContext = job
    ? {
        id: job.id,
        customer: job.customer,
        address: job.address,
        borough: job.borough,
        date: typeof job.date === 'string' ? job.date.slice(0, 10) : (job as any).date?.slice?.(0, 10),
        time: job.time,
        type: job.type,
        truckId: job.truckId ?? undefined,
        truckName: job.truck?.name ?? undefined,
        driverId: job.driverId ?? undefined,
        driverName: job.driver?.name ?? undefined,
      }
    : null;

  useEffect(() => {
    if (!job || !jobContext) {
      setWorkerRecs([]);
      return;
    }
    setRecsLoading(true);
    fetch('/api/workers/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobContext }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const list = Array.isArray(data.data) ? data.data : [];
        setWorkerRecs(list.map((r: any) => ({ workerId: r.workerId, score: r.score ?? 0, reasons: r.reasons, reason: r.reason })));
      })
      .catch(() => setWorkerRecs([]))
      .finally(() => setRecsLoading(false));
  }, [job?.id]);

  const scoreByWorkerId = useCallback(
    (workerId: string) => workerRecs.find((r) => r.workerId === workerId)?.score ?? null,
    [workerRecs]
  );

  const filteredWorkers = workers.filter((w) => {
    if (workerRoleFilter !== 'all' && w.role !== workerRoleFilter) return false;
    if (workerAvailFilter === 'available' && !['AVAILABLE', 'ON_SITE', 'EN_ROUTE'].includes(w.status)) return false;
    return true;
  });

  const sortedWorkers = [...filteredWorkers].sort((a, b) => {
    if (workerSort === 'ai') {
      const sa = scoreByWorkerId(a.id) ?? -1;
      const sb = scoreByWorkerId(b.id) ?? -1;
      return sb - sa;
    }
    if (workerSort === 'name') return a.name.localeCompare(b.name);
    if (workerSort === 'role') return (a.role as string).localeCompare(b.role as string);
    return 0;
  });

  const filteredTrucks = trucks.filter((t) => {
    if (truckTypeFilter !== 'all' && t.type !== truckTypeFilter) return false;
    if (truckAvailFilter === 'available' && t.status !== 'AVAILABLE') return false;
    return true;
  });

  const driverStagedId = modifiedFields.driverId !== undefined ? modifiedFields.driverId : null;
  const driverStagedName = driverStagedId ? workers.find((w) => w.id === driverStagedId)?.name : null;
  const truckStagedId = modifiedFields.truckId !== undefined ? modifiedFields.truckId : null;
  const truckStagedName = truckStagedId ? trucks.find((t) => t.id === truckStagedId)?.name : null;

  const handleAssignDriver = useCallback(
    (workerId: string, name: string) => {
      setModifiedField('driverId', workerId);
      onStagedDriver?.(workerId, name);
    },
    [setModifiedField, onStagedDriver]
  );

  const handleUseTruck = useCallback(
    (truckId: string, name: string) => {
      setModifiedField('truckId', truckId);
      onStagedTruck?.(truckId, name);
    },
    [setModifiedField, onStagedTruck]
  );

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !job || !jobContext || chatLoading) return;
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/dispatch/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, date, jobContext }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Command failed');
      let answer = '';
      if (json.type === 'scenario' && json.result?.recommendation) {
        answer = json.result.recommendation;
      } else if (json.type === 'update' && json.result?.message) {
        answer = json.result.message;
      } else {
        answer = json.result?.answer ?? json.result ?? 'No response.';
      }
      setToastMsg(String(answer));
      toast.success('Response received', { duration: 5000 });
      setTimeout(() => setToastMsg(null), 5000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      setToastMsg(msg);
      toast.error(msg, { duration: 5000 });
      setTimeout(() => setToastMsg(null), 5000);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, job, jobContext, date, chatLoading]);

  if (!job) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-surface-0 p-4 text-text-3 text-sm">
        Select a job to see crew and fleet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0">
      {toastMsg && (
        <div className="shrink-0 mx-3 mt-2 p-2 rounded border border-amber/40 bg-amber/10 text-amber text-xs animate-in fade-in">
          {toastMsg}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Section 1: Worker cards — top 50% */}
        <div className="shrink-0 flex flex-col border-b border-border" style={{ height: '50%' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text-2 uppercase tracking-wider">
              AVAILABLE CREW
            </span>
            <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-mono text-text-2">
              {sortedWorkers.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border/50">
            <Select value={workerRoleFilter} onValueChange={setWorkerRoleFilter}>
              <SelectTrigger className="h-8 w-[110px] text-xs bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(Object.keys(WORKER_ROLE_LABELS) as WorkerRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{WORKER_ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={workerAvailFilter} onValueChange={setWorkerAvailFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="available">Available Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={workerSort} onValueChange={setWorkerSort}>
              <SelectTrigger className="h-8 w-[100px] text-xs bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">AI Score</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="role">Role</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-2 min-h-0">
            {recsLoading ? (
              <div className="flex items-center gap-2 text-text-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recommendations…
              </div>
            ) : (
              sortedWorkers.map((w) => {
                const score = scoreByWorkerId(w.id);
                return (
                  <div
                    key={w.id}
                    className="rounded border border-border bg-surface-1 p-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-0 truncate">{w.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-2">
                            {WORKER_ROLE_LABELS[w.role]}
                          </span>
                          <span className={cn('w-2 h-2 rounded-full shrink-0', workerStatusColor(w.status))} />
                          {(w.certifications ?? []).slice(0, 4).map((c) => (
                            <span key={c} className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text-2">
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-text-3 mt-1">
                          {driverToRoute.has(w.id)
                            ? `${driverToRoute.get(w.id)!.truckName} · ${driverToRoute.get(w.id)!.jobCount} jobs today`
                            : w.currentAssignment || 'Available'}
                        </p>
                        {score != null && (
                          <p className={cn('text-xs font-mono mt-0.5', scoreColor(score))}>
                            AI: {score}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-amber/40 text-amber hover:bg-amber/10 h-8"
                        onClick={() => handleAssignDriver(w.id, w.name)}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {driverStagedName && (
            <div className="shrink-0 px-3 py-2 border-t border-amber/30 bg-amber/10 text-amber text-xs">
              {driverStagedName} staged — Save Changes to apply
            </div>
          )}
        </div>

        {/* Section 2: Fleet cards — bottom 50% */}
        <div className="flex-1 flex flex-col min-h-0" style={{ minHeight: '50%' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text-2 uppercase tracking-wider">
              FLEET STATUS
            </span>
            <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-mono text-text-2">
              {filteredTrucks.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border/50">
            <Select value={truckTypeFilter} onValueChange={setTruckTypeFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(Object.keys(TRUCK_TYPE_LABELS) as TruckType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TRUCK_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={truckAvailFilter} onValueChange={setTruckAvailFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="available">Available Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-2 min-h-0">
            {filteredTrucks.map((t) => {
              const jobCount = truckJobCount.get(t.id) ?? 0;
              const boroughs = truckBoroughs.get(t.id) ?? [];
              return (
                <div
                  key={t.id}
                  className="rounded border border-border bg-surface-1 p-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-0">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-2">
                          {TRUCK_TYPE_LABELS[t.type]}
                        </span>
                        <span className={cn('w-2 h-2 rounded-full shrink-0', truckStatusColor(t.status))} />
                      </div>
                      <p className="text-xs text-text-3 mt-1">
                        {t.assignedDriver?.name ?? 'No driver'}
                      </p>
                      <p className="text-xs text-text-3">
                        {jobCount > 0 ? `${jobCount} jobs today` : 'No jobs'}
                      </p>
                      {boroughs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {boroughs.map((b) => (
                            <span key={b} className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text-2">
                              {typeof b === 'string' && b in BOROUGH_LABELS ? BOROUGH_LABELS[b as keyof typeof BOROUGH_LABELS] : b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-amber/40 text-amber hover:bg-amber/10 h-8"
                      onClick={() => handleUseTruck(t.id, t.name)}
                    >
                      Use This Truck
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {truckStagedName && (
            <div className="shrink-0 px-3 py-2 border-t border-amber/30 bg-amber/10 text-amber text-xs">
              {truckStagedName} staged — Save Changes to apply
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Chat input — fixed bottom */}
      <div className="shrink-0 p-3 border-t border-border bg-surface-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
            placeholder="Ask about this job..."
            className="flex-1 min-w-0 h-9 rounded border border-border bg-surface-1 px-3 text-sm text-text-0 placeholder:text-text-3"
            disabled={chatLoading}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 bg-amber text-black hover:bg-amber/90"
            onClick={sendChat}
            disabled={chatLoading || !chatInput.trim()}
          >
            {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
