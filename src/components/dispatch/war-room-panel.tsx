'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkers, useTrucks } from '@/hooks';
import { useCommandCenterStore } from '@/stores';
import type { CartingJob, WorkerStatus, TruckStatus } from '@/types';
import type { JobAnalysisResponse } from '@/types';
import { TRUCK_TYPE_LABELS, WORKER_ROLE_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { Send, Loader2, ChevronDown, ChevronRight, ArrowLeft, Check } from 'lucide-react';

export type PanelState = 'summary' | 'options' | 'preview' | 'confirmed';

export interface WarRoomPanelProps {
  job: CartingJob | null;
  date: string;
}

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

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('h-4 rounded bg-surface-2 animate-pulse w-full', className)} />;
}

export function WarRoomPanel({ job, date }: WarRoomPanelProps) {
  const { data: workersData } = useWorkers();
  const { data: trucksData } = useTrucks();
  const workers = workersData ?? [];
  const trucks = trucksData ?? [];
  const addSidebarMessage = useCommandCenterStore((s) => s.addSidebarMessage);
  const triggerDispatchRefetch = useCommandCenterStore((s) => s.triggerDispatchRefetch);

  const [panelState, setPanelState] = useState<PanelState>('summary');
  const [analysis, setAnalysis] = useState<JobAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [optionsTab, setOptionsTab] = useState<'Crew' | 'Trucks'>('Crew');
  const [selectedPreviewDriverId, setSelectedPreviewDriverId] = useState<string | null>(null);
  const [selectedPreviewTruckId, setSelectedPreviewTruckId] = useState<string | null>(null);
  const [previewImpact, setPreviewImpact] = useState<JobAnalysisResponse | null>(null);
  const [previewImpactLoading, setPreviewImpactLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmedAssignment, setConfirmedAssignment] = useState<{ name: string; isDriver: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const toastIdRef = useRef(0);

  const jobContext = useMemo(
    () =>
      job
        ? {
            jobId: job.id,
            customer: job.customer,
            address: job.address,
            borough: job.borough,
            date: typeof job.date === 'string' ? job.date.slice(0, 10) : (job as { date?: { slice?: (a: number, b: number) => string } })?.date?.slice?.(0, 10),
            time: job.time,
            type: job.type,
            truckId: job.truckId ?? undefined,
            truckName: job.truck?.name ?? undefined,
            driverId: job.driverId ?? undefined,
            driverName: job.driver?.name ?? undefined,
          }
        : null,
    [job]
  );

  const fetchAnalysis = useCallback(
    (opts?: { action?: 'initial' | 'swap_driver' | 'swap_truck'; newDriverId?: string | null; newTruckId?: string | null }) => {
      if (!job?.id) return;
      setAnalysisLoading(true);
      fetch('/api/dispatch/job-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          date,
          action: opts?.action ?? 'initial',
          newDriverId: opts?.newDriverId ?? undefined,
          newTruckId: opts?.newTruckId ?? undefined,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setAnalysis(data as JobAnalysisResponse);
        })
        .catch(() => setAnalysis(null))
        .finally(() => setAnalysisLoading(false));
    },
    [job?.id, date]
  );

  useEffect(() => {
    if (!job?.id) {
      setAnalysis(null);
      setPanelState('summary');
      setSelectedPreviewDriverId(null);
      setSelectedPreviewTruckId(null);
      setPreviewImpact(null);
      return;
    }
    fetchAnalysis();
  }, [job?.id, date, fetchAnalysis]);

  const addToast = useCallback((text: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const hasConflicts = (analysis?.conflicts?.length ?? 0) > 0;
  const topWorker = analysis?.topWorker ?? null;
  const strongRec = topWorker && topWorker.score > 80;

  const searchLower = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchLower || searchLower.length < 2) return { workers: [], trucks: [] };
    const w = workers.filter((worker) => worker.name.toLowerCase().includes(searchLower)).slice(0, 5);
    const t = trucks.filter((truck) => truck.name.toLowerCase().includes(searchLower)).slice(0, 5);
    return { workers: w, trucks: t };
  }, [searchLower, workers, trucks]);

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
        answer = json.result?.answer ?? json.result ?? json.message ?? 'No response.';
      }
      addToast(String(answer));
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Command failed');
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, job, jobContext, date, chatLoading, addToast]);

  const goToPreviewWithDriver = useCallback((driverId: string) => {
    setSelectedPreviewDriverId(driverId);
    setSelectedPreviewTruckId(null);
    setPreviewImpact(null);
    setPreviewImpactLoading(true);
    setPanelState('preview');
    fetch('/api/dispatch/job-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job!.id, date, action: 'swap_driver', newDriverId: driverId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPreviewImpact(data as JobAnalysisResponse);
      })
      .catch(() => setPreviewImpact(null))
      .finally(() => setPreviewImpactLoading(false));
  }, [job, date]);

  const goToPreviewWithTruck = useCallback((truckId: string) => {
    setSelectedPreviewTruckId(truckId);
    setSelectedPreviewDriverId(null);
    setPreviewImpact(null);
    setPreviewImpactLoading(true);
    setPanelState('preview');
    fetch('/api/dispatch/job-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job!.id, date, action: 'swap_truck', newTruckId: truckId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPreviewImpact(data as JobAnalysisResponse);
      })
      .catch(() => setPreviewImpact(null))
      .finally(() => setPreviewImpactLoading(false));
  }, [job, date]);

  const handleConfirmSave = useCallback(async () => {
    if (!job?.id) return;
    setConfirmLoading(true);
    const payload: Record<string, unknown> = {};
    if (selectedPreviewDriverId) payload.driverId = selectedPreviewDriverId;
    if (selectedPreviewTruckId) payload.truckId = selectedPreviewTruckId;
    if (Object.keys(payload).length === 0) {
      setConfirmLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/jobs/' + job.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      const customer = job.customer;
      const what = selectedPreviewDriverId
        ? `driver → ${workers.find((w) => w.id === selectedPreviewDriverId)?.name ?? 'assigned'}`
        : `truck → ${trucks.find((t) => t.id === selectedPreviewTruckId)?.name ?? 'assigned'}`;
      addSidebarMessage({
        role: 'assistant',
        content: `📋 Job updated: ${customer} — ${what}. Schedule refreshed.`,
        type: 'text',
      });
      triggerDispatchRefetch();
      setConfirmedAssignment(
        selectedPreviewDriverId
          ? { name: workers.find((w) => w.id === selectedPreviewDriverId)?.name ?? 'Driver', isDriver: true }
          : { name: trucks.find((t) => t.id === selectedPreviewTruckId)?.name ?? 'Truck', isDriver: false }
      );
      setPanelState('confirmed');
      setSelectedPreviewDriverId(null);
      setSelectedPreviewTruckId(null);
      setPreviewImpact(null);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setConfirmLoading(false);
    }
  }, [job, selectedPreviewDriverId, selectedPreviewTruckId, workers, trucks, addSidebarMessage, triggerDispatchRefetch, fetchAnalysis]);

  useEffect(() => {
    if (panelState !== 'confirmed') return;
    const t = setTimeout(() => {
      setPanelState('summary');
      setConfirmedAssignment(null);
      fetchAnalysis();
      triggerDispatchRefetch();
    }, 2000);
    return () => clearTimeout(t);
  }, [panelState, fetchAnalysis, triggerDispatchRefetch]);

  if (!job) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-surface-0 p-4 text-text-3 text-sm">
        Select a job to see conflicts, AI recommendations, and chat.
      </div>
    );
  }

  const previewDriver = selectedPreviewDriverId ? workers.find((w) => w.id === selectedPreviewDriverId) : null;
  const previewTruck = selectedPreviewTruckId ? trucks.find((t) => t.id === selectedPreviewTruckId) : null;
  const currentDriverName = job.driver?.name ?? '—';
  const currentTruckName = job.truck?.name ?? '—';
  const previewHasCritical = previewImpact?.conflicts?.some((c) => c.severity === 'CRITICAL') ?? false;
  const confirmedName = confirmedAssignment?.name;

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0 max-w-full overflow-hidden">
      {/* Toasts — stack at top */}
      {toasts.length > 0 && (
        <div className="shrink-0 px-3 pt-2 space-y-1 max-h-32 overflow-y-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="rounded border border-amber/40 bg-amber/10 text-amber text-xs px-2 py-1.5"
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Content by state */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {panelState === 'summary' && (
          <>
            <div className="space-y-4">
              {/* Conflict badge */}
              <ConflictBadge
                conflicts={analysis?.conflicts ?? []}
                loading={analysisLoading}
              />
              {/* AI assessment */}
              <div>
                {analysisLoading ? (
                  <div className="space-y-1">
                    <SkeletonLine />
                    <SkeletonLine className="w-3/4" />
                  </div>
                ) : (
                  <p className="text-sm text-text-1">{analysis?.impactSummary ?? 'No assessment yet.'}</p>
                )}
              </div>
              {/* Primary CTA */}
              <Button
                className="w-full h-11 bg-amber text-black hover:bg-amber/90 font-medium text-sm"
                onClick={() => {
                  if (strongRec && topWorker) {
                    goToPreviewWithDriver(topWorker.id);
                  } else {
                    setPanelState('options');
                  }
                }}
                disabled={analysisLoading}
              >
                {analysisLoading
                  ? 'Loading…'
                  : strongRec && topWorker
                    ? `Assign ${topWorker.name} (Score: ${topWorker.score}) →`
                    : hasConflicts
                      ? 'See Fix Options →'
                      : 'See Options →'}
              </Button>
              <button
                type="button"
                className="text-xs text-text-3 hover:text-amber block w-full text-center"
                onClick={() => setPanelState('options')}
              >
                Or browse all crew & fleet
              </button>
            </div>
          </>
        )}

        {panelState === 'options' && (
          <>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-text-2 hover:text-amber mb-3"
              onClick={() => setPanelState('summary')}
            >
              <ArrowLeft className="h-4 w-4" />
              Summary
            </button>
            <div className="flex gap-1 p-0.5 rounded-md bg-surface-2 mb-3">
              <button
                type="button"
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium',
                  optionsTab === 'Crew' ? 'bg-amber text-black' : 'bg-transparent text-text-2 hover:text-text-0'
                )}
                onClick={() => setOptionsTab('Crew')}
              >
                Crew
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium',
                  optionsTab === 'Trucks' ? 'bg-amber text-black' : 'bg-transparent text-text-2 hover:text-text-0'
                )}
                onClick={() => setOptionsTab('Trucks')}
              >
                Trucks
              </button>
            </div>
            {optionsTab === 'Crew' && (
              <div className="space-y-2 mb-3">
                {(analysis?.workers ?? []).slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    className="rounded-md border border-border bg-surface-1 px-3 py-2 hover:border-amber/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-0 text-sm">{w.name}</span>
                      <span className="rounded bg-surface-2 text-amber font-mono text-[10px] px-1.5 py-0.5">
                        {w.score}
                      </span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-2">
                        {WORKER_ROLE_LABELS[w.role as keyof typeof WORKER_ROLE_LABELS]}
                      </span>
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', workerStatusColor(w.status as WorkerStatus))} />
                    </div>
                    <p className="text-[11px] text-text-3 mt-0.5 line-clamp-1">{w.reason}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 text-xs border-border text-text-2 hover:bg-amber/10 hover:border-amber/40"
                      onClick={() => goToPreviewWithDriver(w.id)}
                    >
                      Preview →
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {optionsTab === 'Trucks' && (
              <div className="space-y-2 mb-3">
                {(analysis?.trucks ?? []).slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-md border border-border bg-surface-1 px-3 py-2 hover:border-amber/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-0 text-sm">{t.name}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-2">
                        {TRUCK_TYPE_LABELS[t.type as keyof typeof TRUCK_TYPE_LABELS] ?? t.type}
                      </span>
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', truckStatusColor(t.status as TruckStatus))} />
                      <span className="text-[10px] text-text-3">{t.jobCount} jobs today</span>
                    </div>
                    <p className="text-[11px] text-text-3 mt-0.5 line-clamp-1">{t.reason}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 text-xs border-border text-text-2 hover:bg-amber/10 hover:border-amber/40"
                      onClick={() => goToPreviewWithTruck(t.id)}
                    >
                      Preview →
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Search */}
            <Input
              type="text"
              placeholder="Search all crew & trucks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm bg-surface-1 border-border"
            />
            {searchLower.length >= 2 && (
              <div className="mt-2 space-y-1">
                {searchResults.workers.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded bg-surface-1 px-2 py-1.5 text-sm border border-border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-text-0 truncate">{w.name}</span>
                      <span className="rounded bg-surface-2 px-1 py-0.5 text-[10px] text-text-2 shrink-0">
                        {WORKER_ROLE_LABELS[w.role]}
                      </span>
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', workerStatusColor(w.status))} />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs shrink-0"
                      onClick={() => goToPreviewWithDriver(w.id)}
                    >
                      Preview →
                    </Button>
                  </div>
                ))}
                {searchResults.trucks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded bg-surface-1 px-2 py-1.5 text-sm border border-border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-text-0 truncate">{t.name}</span>
                      <span className="rounded bg-surface-2 px-1 py-0.5 text-[10px] text-text-2 shrink-0">
                        {TRUCK_TYPE_LABELS[t.type]}
                      </span>
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', truckStatusColor(t.status))} />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs shrink-0"
                      onClick={() => goToPreviewWithTruck(t.id)}
                    >
                      Preview →
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {panelState === 'preview' && (
          <>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-text-2 hover:text-amber mb-3"
              onClick={() => {
                setPanelState('options');
                setSelectedPreviewDriverId(null);
                setSelectedPreviewTruckId(null);
                setPreviewImpact(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Options
            </button>
            <div className="rounded-md border-l-4 border-info bg-surface-2 px-3 py-2 mb-3">
              {previewDriver ? (
                <>
                  <p className="font-semibold text-text-0 text-sm">Assigning {previewDriver.name} as driver</p>
                  <p className="text-xs text-text-3 mt-0.5">
                    {currentDriverName} → {previewDriver.name}
                  </p>
                </>
              ) : previewTruck ? (
                <>
                  <p className="font-semibold text-text-0 text-sm">Switching truck to {previewTruck.name}</p>
                  <p className="text-xs text-text-3 mt-0.5">
                    {currentTruckName} → {previewTruck.name}
                  </p>
                </>
              ) : null}
            </div>
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-text-2 uppercase tracking-wider mb-1.5">Impact</p>
              {previewImpactLoading ? (
                <div className="space-y-1">
                  <SkeletonLine />
                  <SkeletonLine />
                  <SkeletonLine className="w-2/3" />
                </div>
              ) : previewImpact ? (
                <div className="space-y-2">
                  {previewImpact.conflicts.length === 0 ? (
                    <p className="text-xs text-success">✅ No new conflicts</p>
                  ) : (
                    previewImpact.conflicts.map((c, i) => (
                      <p key={i} className={cn('text-xs', c.severity === 'CRITICAL' ? 'text-danger' : 'text-amber')}>
                        • {c.message}
                      </p>
                    ))
                  )}
                  {previewImpact.warnings?.map((w, i) => (
                    <p key={i} className="text-xs text-amber">• {w}</p>
                  ))}
                  <p className="text-sm text-text-1 mt-1">{previewImpact.impactSummary}</p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className={cn(
                  'w-full h-10 font-medium text-sm',
                  previewHasCritical ? 'bg-amber/90 text-black hover:bg-amber' : 'bg-amber text-black hover:bg-amber/90'
                )}
                onClick={handleConfirmSave}
                disabled={confirmLoading}
              >
                {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : previewHasCritical ? 'Confirm with Conflicts' : 'Confirm & Save'}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-text-2"
                onClick={() => {
                  setPanelState('options');
                  setSelectedPreviewDriverId(null);
                  setSelectedPreviewTruckId(null);
                  setPreviewImpact(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}

        {panelState === 'confirmed' && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Check className="h-12 w-12 text-success mb-3" />
            <p className="font-semibold text-text-0 text-sm">
              ✅ {confirmedName ?? 'Updated'} assigned to {job.customer}
            </p>
            <p className="text-text-3 text-xs mt-1">Schedule updated</p>
          </div>
        )}
      </div>

      {/* Chat input — fixed at bottom in all states */}
      <div className="shrink-0 p-2 border-t border-border bg-surface-0">
        <div className="flex gap-2">
          <Input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
            placeholder="Ask about this job..."
            className="flex-1 min-w-0 h-9 text-sm bg-surface-2 border-border placeholder:text-text-3"
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

function ConflictBadge({
  conflicts,
  loading,
}: {
  conflicts: JobAnalysisResponse['conflicts'];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (loading) return <SkeletonLine className="h-7 w-24 rounded-full" />;
  if (conflicts.length === 0) {
    return (
      <div className="rounded-full bg-success/20 text-success px-3 py-1 text-xs font-medium inline-block">
        ✅ No conflicts
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="rounded-full bg-amber/20 text-amber px-3 py-1 text-xs font-medium inline-flex items-center gap-1"
      >
        ⚠️ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <ul className="mt-1.5 pl-3 space-y-0.5 text-[11px] text-text-2 border-l-2 border-amber/40">
          {conflicts.map((c, i) => (
            <li key={i}>{c.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
