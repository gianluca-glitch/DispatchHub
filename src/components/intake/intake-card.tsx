'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Phone,
  Mail,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Columns2,
  LayoutList,
  Zap,
} from 'lucide-react';
import { ConfidenceBar } from './confidence-bar';
import { ParsedFields } from './parsed-fields';
import { ApprovalActions } from './approval-actions';
import { AudioPlayer } from './audio-player';
import {
  INTAKE_STATUS_LABELS,
  JOB_TYPE_LABELS,
  TRUCK_TYPE_LABELS,
  BOROUGH_LABELS,
  type IntakeItem,
  type IntakeStatus,
  type JobType,
  type TruckType,
  type Borough,
  type Truck,
  type Worker,
  type PreviewAnalysis,
} from '@/types';
import { cn, formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import { useUiStore, useDispatchStore, usePreviewStore } from '@/stores';
import { useTrucks, useWorkers, useJobs } from '@/hooks';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SOURCE_ICON = {
  PHONE: Phone,
  EMAIL: Mail,
  FORM: FileText,
};

const STATUS_PILL: Record<IntakeStatus, string> = {
  PENDING: 'bg-success/20 text-success',
  NEEDS_REVIEW: 'bg-amber/20 text-amber',
  FLAGGED: 'bg-danger/20 text-danger',
  APPROVED: 'bg-success/20 text-success',
  DECLINED: 'bg-text-3 text-text-2',
  ON_HOLD: 'bg-amber/20 text-amber',
};

const CONTAINER_SIZES = ['10yd', '20yd', '30yd', '40yd'];

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

function EfficiencyCircle({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const deg = pct * 360;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const dim = size === 'sm' ? 24 : 40;
  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, #2b2f3a ${deg}deg)`,
        }}
      />
      <div className="absolute inset-[2px] rounded-full bg-surface-0 flex items-center justify-center">
        <span className={cn('font-mono font-bold text-text-0', size === 'sm' ? 'text-[10px]' : 'text-sm')}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

export interface IntakeCardProps {
  item: IntakeItem;
  allIntakeItems?: IntakeItem[];
  onStatusChange: (id: string, status: IntakeStatus) => void;
  onFieldChange: (id: string, field: string, value: string | null) => void;
  onApproved?: (jobId: string) => void;
  refetch: () => void;
}

export function IntakeCard({
  item,
  allIntakeItems = [],
  onStatusChange,
  onFieldChange,
  onApproved,
  refetch,
}: IntakeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const setSelectedJobId = useDispatchStore((s) => s.setSelectedJobId);
  const setSelectedDate = useDispatchStore((s) => s.setSelectedDate);

  const preview = usePreviewStore((s) => s.previews[item.id]);
  const setPreview = usePreviewStore((s) => s.setPreview);
  const clearPreview = usePreviewStore((s) => s.clearPreview);
  const getOtherPreviews = usePreviewStore((s) => s.getOtherPreviews);

  const { data: trucksData } = useTrucks();
  const { data: workersData } = useWorkers();
  const trucks = trucksData ?? [];
  const workers = workersData ?? [];
  const targetDate = item.parsedDate ? item.parsedDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const { data: jobsData } = useJobs(targetDate);
  const jobsForDate = jobsData ?? [];

  const SourceIcon = SOURCE_ICON[item.source];

  const drivers = workers.filter((w) => w.role === 'DRIVER');
  const nonDrivers = workers.filter((w) => w.role !== 'DRIVER');

  const trucksByType = trucks.reduce<Record<TruckType, Truck[]>>(
    (acc, t) => {
      const type = t.type as TruckType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(t);
      return acc;
    },
    {} as Record<TruckType, Truck[]>
  );

  const triggerAnalyze = useCallback(async () => {
    const p = usePreviewStore.getState().previews[item.id];
    if (!p?.truckId || !p.driverId) return;
    setPreview(item.id, { analysisLoading: true });
    try {
      const res = await fetch('/api/intake/preview-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeItemId: item.id,
          truckId: p.truckId,
          driverId: p.driverId,
          workerIds: p.workerIds ?? [],
          timeOverride: p.timeOverride,
          otherPreviews: getOtherPreviews(item.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Analysis failed');
      setPreview(item.id, { analysis: json.data, analysisLoading: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed');
      setPreview(item.id, { analysis: null, analysisLoading: false });
    }
  }, [item.id, setPreview, getOtherPreviews]);

  const analyzeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePreviewChange = useCallback(
    (updates: Partial<{ truckId: string | null; driverId: string | null; workerIds: string[]; timeOverride: string | null; containerSize: string | null }>) => {
      const current = usePreviewStore.getState().previews[item.id] ?? {
        intakeItemId: item.id,
        truckId: null,
        driverId: null,
        workerIds: [],
        timeOverride: null,
        containerSize: null,
        analysis: null,
        analysisLoading: false,
      };
      const next = { ...current, ...updates };
      setPreview(item.id, next);
      if (next.truckId && next.driverId && (updates.truckId !== undefined || updates.driverId !== undefined || updates.workerIds !== undefined || updates.timeOverride !== undefined)) {
        if (analyzeDebounceRef.current) clearTimeout(analyzeDebounceRef.current);
        analyzeDebounceRef.current = setTimeout(() => {
          analyzeDebounceRef.current = null;
          triggerAnalyze();
        }, 2000);
      }
    },
    [item.id, setPreview, triggerAnalyze]
  );

  const handleApplyAiRecommendation = useCallback(() => {
    const a = preview?.analysis;
    if (!a?.alternativeSuggestion) return;
    const lower = a.alternativeSuggestion.toLowerCase();
    if (lower.includes('packer') || lower.includes('truck')) {
      const match = trucks.find((t) => lower.includes(t.name.toLowerCase()));
      if (match) handlePreviewChange({ truckId: match.id });
    }
    toast.info('AI suggestion applied where possible');
  }, [preview?.analysis, trucks, handlePreviewChange]);

  const handleConfirmAndSchedule = useCallback(async () => {
    const p = preview ?? usePreviewStore.getState().previews[item.id];
    setLoading(true);
    try {
      const res = await fetch('/api/intake/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeItemId: item.id,
          truckId: p?.truckId ?? null,
          driverId: p?.driverId ?? null,
          workerIds: p?.workerIds ?? [],
          timeOverride: p?.timeOverride ?? null,
          containerSizeOverride: p?.containerSize ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Approve failed');
      const job = json.data;
      clearPreview(item.id);
      toast.success('Job created + confirmations sent', {
        action: {
          label: 'Open job',
          onClick: () => {
            setSelectedDate(job.date?.slice?.(0, 10) ?? new Date().toISOString().slice(0, 10));
            setSelectedJobId(job.id);
            setActiveTab('dispatch');
          },
        },
      });
      onApproved?.(job.id);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setLoading(false);
    }
  }, [item.id, preview, clearPreview, onApproved, refetch, setActiveTab, setSelectedJobId, setSelectedDate]);

  const handleApprove = useCallback(async () => {
    const p = preview ?? usePreviewStore.getState().previews[item.id];
    if (p?.truckId && p?.driverId) {
      await handleConfirmAndSchedule();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/intake/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeItemId: item.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Approve failed');
      const job = json.data;
      toast.success('Job created + confirmations sent', {
        action: {
          label: 'Open job',
          onClick: () => {
            setSelectedDate(job.date?.slice?.(0, 10) ?? new Date().toISOString().slice(0, 10));
            setSelectedJobId(job.id);
            setActiveTab('dispatch');
          },
        },
      });
      onApproved?.(job.id);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setLoading(false);
    }
  }, [item.id, preview, handleConfirmAndSchedule, onApproved, refetch, setActiveTab, setSelectedJobId, setSelectedDate]);

  const handleDecline = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/intake/' + item.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DECLINED' }),
      });
      onStatusChange(item.id, 'DECLINED');
      refetch();
    } finally {
      setLoading(false);
    }
  }, [item.id, onStatusChange, refetch]);

  const handleHold = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/intake/' + item.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ON_HOLD' }),
      });
      onStatusChange(item.id, 'ON_HOLD');
      refetch();
    } finally {
      setLoading(false);
    }
  }, [item.id, onStatusChange, refetch]);

  const handleFlag = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/intake/' + item.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FLAGGED' }),
      });
      onStatusChange(item.id, 'FLAGGED');
      refetch();
    } finally {
      setLoading(false);
    }
  }, [item.id, onStatusChange, refetch]);

  const handleFieldChange = useCallback(
    (field: string, value: string | null) => {
      onFieldChange(item.id, field, value);
      fetch('/api/intake/' + item.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      }).then(() => refetch());
    },
    [item.id, onFieldChange, refetch]
  );

  const receivedAt = item.receivedAt
    ? new Date(item.receivedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  const isFinal = item.status === 'APPROVED' || item.status === 'DECLINED';
  const analysis: PreviewAnalysis | null = preview?.analysis ?? null;
  const boroughsForDate = [...new Set(jobsForDate.map((j) => j.borough).filter(Boolean))] as Borough[];
  const timeCounts = jobsForDate.reduce<Record<string, number>>((acc, j) => {
    const t = j.time ?? '09:00';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="border border-border rounded bg-surface-0 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-1 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-2 text-text-2">
          <SourceIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-text-0 truncate">
              {item.parsedCustomer ?? 'Unknown'}
            </span>
            <span className="text-text-3 text-xs font-mono">{receivedAt}</span>
          </div>
          <p className="text-sm text-text-2 truncate mt-0.5">
            {item.parsedAddress ?? item.rawContent.slice(0, 60)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.parsedServiceType && (
            <span className="text-xs px-2 py-0.5 rounded bg-info/20 text-info border border-info/40">
              {JOB_TYPE_LABELS[item.parsedServiceType as JobType]}
            </span>
          )}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded',
              STATUS_PILL[item.status as IntakeStatus]
            )}
          >
            {INTAKE_STATUS_LABELS[item.status as IntakeStatus]}
          </span>
        </div>
        <div className="w-20 shrink-0">
          <ConfidenceBar value={item.confidence} />
          <span className="text-[10px] text-text-3 font-mono mt-0.5">
            {Math.round(item.confidence)}%
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-text-3" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-3" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-surface-0">
          {item.source === 'PHONE' && item.audioUrl && (
            <AudioPlayer audioUrl={item.audioUrl} />
          )}
          <ParsedFields
            item={item}
            confidence={item.confidence}
            editMode={editMode}
            onFieldChange={handleFieldChange}
          />

          {/* Preview Mode / Sandbox */}
          <div className="rounded border border-amber/30 bg-amber/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-amber">Preview sandbox</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-text-3 hover:text-text-0"
                onClick={() => setCompareMode(!compareMode)}
              >
                {compareMode ? (
                  <LayoutList className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Columns2 className="h-3.5 w-3.5 mr-1" />
                )}
                {compareMode ? 'Single' : 'Compare'}
              </Button>
            </div>

            {compareMode ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded bg-surface-1 p-3 border border-border">
                  <span className="text-xs font-medium text-text-3 uppercase">Parsed</span>
                  <div className="mt-2 space-y-1 text-sm font-mono text-text-2">
                    <div>Truck: —</div>
                    <div>Driver: —</div>
                    <div>Time: {formatTime(item.parsedTime)}</div>
                    <div>Container: {item.parsedContainerSize ?? '—'}</div>
                  </div>
                </div>
                <div className="rounded bg-surface-1 p-3 border border-amber/40">
                  <span className="text-xs font-medium text-amber uppercase">Preview</span>
                  <div className="mt-2 space-y-1 text-sm font-mono text-text-2">
                    <div>Truck: {preview?.truckId ? trucks.find((t) => t.id === preview.truckId)?.name ?? '—' : '—'}</div>
                    <div>Driver: {preview?.driverId ? workers.find((w) => w.id === preview.driverId)?.name ?? '—' : '—'}</div>
                    <div>Time: {formatTime(preview?.timeOverride ?? item.parsedTime)}</div>
                    <div>Container: {preview?.containerSize ?? item.parsedContainerSize ?? '—'}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn('grid gap-3', compareMode ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4')}>
              <div className="flex flex-col gap-1">
                <label className="text-text-3 text-xs font-medium">Truck (by type)</label>
                <Select
                  value={preview?.truckId ?? '__none__'}
                  onValueChange={(v) => handlePreviewChange({ truckId: v === '__none__' ? null : v })}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue placeholder="Select truck" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(Object.keys(TRUCK_TYPE_LABELS) as TruckType[]).map((type) => {
                      const list = trucksByType[type];
                      if (!list?.length) return null;
                      return (
                        <SelectGroup key={type}>
                          <SelectLabel>{TRUCK_TYPE_LABELS[type]}</SelectLabel>
                          {list.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                          <SelectSeparator />
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-3 text-xs font-medium">Driver</label>
                <Select
                  value={preview?.driverId ?? '__none__'}
                  onValueChange={(v) => handlePreviewChange({ driverId: v === '__none__' ? null : v })}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {drivers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-3 text-xs font-medium">Time</label>
                <Select
                  value={preview?.timeOverride ?? item.parsedTime ?? '__parsed__'}
                  onValueChange={(v) => handlePreviewChange({ timeOverride: v === '__parsed__' ? null : v })}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__parsed__">Parsed ({formatTime(item.parsedTime)})</SelectItem>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatTime(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-3 text-xs font-medium">Container size</label>
                <Select
                  value={preview?.containerSize ?? item.parsedContainerSize ?? '__none__'}
                  onValueChange={(v) => handlePreviewChange({ containerSize: v === '__none__' ? null : v })}
                >
                  <SelectTrigger className="h-9 bg-surface-1 border-border font-mono">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {CONTAINER_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-text-3 text-xs font-medium">Additional workers</label>
              <div className="flex flex-wrap gap-2">
                {nonDrivers.map((w) => {
                  const selected = (preview?.workerIds ?? []).includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        const ids = preview?.workerIds ?? [];
                        handlePreviewChange({
                          workerIds: selected ? ids.filter((id) => id !== w.id) : [...ids, w.id],
                        });
                      }}
                      className={cn(
                        'px-2 py-1 rounded text-xs font-mono border transition-colors',
                        selected
                          ? 'bg-amber/20 border-amber/40 text-amber'
                          : 'bg-surface-2 border-border text-text-2 hover:bg-surface-3'
                      )}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI Analysis panel */}
          {(preview?.truckId && preview?.driverId) && (
            <div className="rounded border border-border bg-surface-1 p-4 space-y-4">
              <h4 className="text-sm font-medium text-text-0">AI analysis</h4>
              {preview.analysisLoading ? (
                <div className="flex items-center gap-2 text-text-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analyzing...</span>
                </div>
              ) : analysis ? (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    <EfficiencyCircle score={analysis.efficiencyScore} size="md" />
                    <div className="flex flex-col gap-1">
                      {analysis.conflicts.length > 0 && (
                        <div className="space-y-0.5">
                          {analysis.conflicts.map((c, i) => (
                            <div
                              key={i}
                              className={cn(
                                'text-xs font-mono',
                                c.severity === 'CRITICAL' ? 'text-danger' : 'text-amber'
                              )}
                            >
                              {c.message}
                            </div>
                          ))}
                        </div>
                      )}
                      {analysis.warnings.length > 0 && (
                        <div className="space-y-0.5">
                          {analysis.warnings.map((w, i) => (
                            <div key={i} className="text-xs text-amber">
                              {w}
                            </div>
                          ))}
                        </div>
                      )}
                      {analysis.positives.length > 0 && (
                        <div className="space-y-0.5">
                          {analysis.positives.map((p, i) => (
                            <div key={i} className="text-xs text-success">
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded bg-surface-0 border border-border p-2">
                      <span className="text-[10px] text-text-3 uppercase">Deadhead</span>
                      <p className="text-xs font-mono text-text-1 mt-0.5">{analysis.estimatedDeadhead}</p>
                    </div>
                    <div className="rounded bg-surface-0 border border-border p-2">
                      <span className="text-[10px] text-text-3 uppercase">Workload</span>
                      <p className="text-xs font-mono text-text-1 mt-0.5">{analysis.workloadBalance}</p>
                    </div>
                    <div className="rounded bg-surface-0 border border-border p-2">
                      <span className="text-[10px] text-text-3 uppercase">Route impact</span>
                      <p className="text-xs font-mono text-text-1 mt-0.5">{analysis.routeImpact}</p>
                    </div>
                  </div>
                  {analysis.alternativeSuggestion && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded bg-amber/10 border border-amber/30 p-2 text-sm text-text-1">
                        {analysis.alternativeSuggestion}
                      </div>
                      <Button
                        size="sm"
                        className="bg-amber/20 text-amber border border-amber/40 hover:bg-amber/30 shrink-0"
                        onClick={handleApplyAiRecommendation}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span className="ml-1">Apply</span>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="bg-amber text-black hover:bg-amber/90"
                  onClick={() => triggerAnalyze()}
                  disabled={preview.analysisLoading}
                >
                  {preview.analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Analyze</span>
                </Button>
              )}
            </div>
          )}

          {/* Schedule context bar */}
          {allIntakeItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 py-2 px-3 rounded bg-surface-1 border border-border">
              <span className="text-xs text-text-3 font-mono">
                {targetDate} · {jobsForDate.length} jobs
              </span>
              {boroughsForDate.length > 0 && (
                <div className="flex gap-1">
                  {boroughsForDate.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded text-[10px] bg-info/20 text-info border border-info/40"
                    >
                      {BOROUGH_LABELS[b]}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1 items-center">
                {TIME_SLOTS.slice(0, 8).map((t) => {
                  const count = timeCounts[t] ?? 0;
                  const max = Math.max(1, ...Object.values(timeCounts));
                  const intensity = count / max;
                  return (
                    <div
                      key={t}
                      title={`${formatTime(t)}: ${count} jobs`}
                      className={cn(
                        'w-4 h-4 rounded-sm transition-colors',
                        intensity > 0.6 ? 'bg-amber' : intensity > 0.2 ? 'bg-amber/50' : 'bg-surface-3'
                      )}
                    />
                  );
                })}
                <span className="text-[10px] text-text-3 ml-1">heat</span>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            {preview?.truckId && preview?.driverId && (
              <>
                {analysis?.alternativeSuggestion && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber/40 text-amber hover:bg-amber/10"
                    onClick={handleApplyAiRecommendation}
                    disabled={loading || isFinal}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span className="ml-1">Apply AI Recommendation</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  className="bg-success/20 text-success border border-success/40 hover:bg-success/30"
                  onClick={handleConfirmAndSchedule}
                  disabled={loading || isFinal}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span className="ml-1">Confirm & Schedule</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border text-text-2 hover:bg-surface-2"
                  onClick={() => clearPreview(item.id)}
                  disabled={loading || isFinal}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="ml-1">Reset</span>
                </Button>
              </>
            )}
            <ApprovalActions
              status={item.status}
              editMode={editMode}
              onApprove={handleApprove}
              onDecline={handleDecline}
              onHold={handleHold}
              onEdit={() => setEditMode(!editMode)}
              onFlag={handleFlag}
              loading={loading}
              hideApprove={!!(preview?.truckId && preview?.driverId)}
            />
          </div>

          <div className="pt-2 border-t border-border">
            <span className="text-text-3 text-xs font-medium">Raw content</span>
            <pre className="mt-1 p-2 rounded bg-surface-1 text-xs text-text-2 font-mono overflow-x-auto max-h-32 overflow-y-auto">
              {item.rawContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
