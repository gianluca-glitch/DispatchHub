'use client';

import { useState, useMemo } from 'react';
import { useTrucks, useWorkers } from '@/hooks';
import { useCommandCenterStore } from '@/stores';
import type { TruckRoute, Truck, Worker, TruckType, TruckStatus, WorkerRole, WorkerStatus } from '@/types';
import { TRUCK_TYPE_LABELS, WORKER_ROLE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const TRUCK_STATUS_STYLE: Record<TruckStatus, string> = {
  AVAILABLE: 'bg-success/20 text-success',
  EN_ROUTE: 'bg-info/20 text-info',
  ON_SITE: 'bg-amber/20 text-amber',
  MAINTENANCE: 'bg-danger/20 text-danger',
  OUT_OF_SERVICE: 'bg-danger/20 text-danger',
};

const WORKER_STATUS_STYLE: Record<WorkerStatus, string> = {
  AVAILABLE: 'bg-success/20 text-success',
  ON_SITE: 'bg-amber/20 text-amber',
  EN_ROUTE: 'bg-info/20 text-info',
  OFF_DUTY: 'bg-[#5e6170]/30 text-text-3',
  OUT_SICK: 'bg-danger/20 text-danger',
  VACATION: 'bg-danger/20 text-danger',
};

const ROLE_STYLE: Record<WorkerRole, string> = {
  DRIVER: 'bg-info/20 text-info',
  LABORER: 'bg-surface-3 text-text-2',
  FOREMAN: 'bg-amber/20 text-amber',
  OPERATOR: 'bg-purple/20 text-purple',
};

function truckStatusLabel(s: TruckStatus): string {
  return s.replace(/_/g, ' ');
}

function workerStatusLabel(s: WorkerStatus): string {
  return s.replace(/_/g, ' ');
}

export interface ResourceCardsProps {
  routes: TruckRoute[];
}

export function ResourceCards({ routes }: ResourceCardsProps) {
  const { data: trucksData } = useTrucks();
  const { data: workersData } = useWorkers();
  const trucks = trucksData ?? [];
  const workers = workersData ?? [];

  const {
    selectedCards,
    highlightedJobId,
    selectCard,
  } = useCommandCenterStore();

  const [previewResult, setPreviewResult] = useState<{
    score: number;
    oneliner: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const truckJobCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of routes) {
      m.set(r.truckId, r.stops.length);
    }
    return m;
  }, [routes]);

  const truckCurrentStop = useMemo(() => {
    const m = new Map<string, { current: number; total: number }>();
    for (const r of routes) {
      const idx = r.currentStopIndex;
      if (idx >= 0 && r.stops.length > 0) {
        m.set(r.truckId, { current: idx + 1, total: r.stops.length });
      }
    }
    return m;
  }, [routes]);

  const workerAssignmentCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of routes) {
      if (r.driverId) m.set(r.driverId, (m.get(r.driverId) ?? 0) + 1);
    }
    return m;
  }, [routes]);

  const canPreview =
    selectedCards.truckId != null &&
    selectedCards.driverId != null &&
    highlightedJobId != null;

  const handlePreview = async () => {
    if (!canPreview) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch('/api/dispatch/quick-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: highlightedJobId,
          truckId: selectedCards.truckId,
          driverId: selectedCards.driverId,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setPreviewResult({ score: json.data.score, oneliner: json.data.oneliner ?? '' });
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const unavailableTruckStatuses: TruckStatus[] = ['MAINTENANCE', 'OUT_OF_SERVICE'];
  const unavailableWorkerStatuses: WorkerStatus[] = ['OUT_SICK', 'VACATION'];

  const sortedTrucks = useMemo(() => {
    const available = trucks.filter(
      (t) => !unavailableTruckStatuses.includes(t.status)
    );
    const unavailable = trucks.filter((t) =>
      unavailableTruckStatuses.includes(t.status)
    );
    return [...available, ...unavailable];
  }, [trucks]);

  const sortedWorkers = useMemo(() => {
    const available = workers.filter(
      (w) => !unavailableWorkerStatuses.includes(w.status)
    );
    const unavailable = workers.filter((w) =>
      unavailableWorkerStatuses.includes(w.status)
    );
    return [...available, ...unavailable];
  }, [workers]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-6">
        {/* Trucks */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs text-text-3 uppercase tracking-wider font-sans mb-2">
            Trucks
          </span>
          <div className="flex gap-2 pb-2 overflow-x-auto">
            {sortedTrucks.map((truck) => {
              const jobs = truckJobCount.get(truck.id) ?? 0;
              const stop = truckCurrentStop.get(truck.id);
              const unavailable = unavailableTruckStatuses.includes(truck.status);
              const selected = selectedCards.truckId === truck.id;
              return (
                <button
                  key={truck.id}
                  type="button"
                  onClick={() => selectCard('truck', truck.id)}
                  className={cn(
                    'shrink-0 w-[140px] p-3 rounded-lg border text-left transition-all duration-150',
                    'bg-surface-1 border-border hover:border-amber/40',
                    selected && 'border-amber ring-1 ring-amber/30',
                    unavailable && 'opacity-50'
                  )}
                >
                  <div className="font-medium text-sm text-text-0 truncate">
                    {truck.name}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs bg-surface-2 px-1.5 py-0.5 rounded font-sans">
                      {TRUCK_TYPE_LABELS[truck.type]}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded flex items-center gap-1 font-sans',
                        TRUCK_STATUS_STYLE[truck.status]
                      )}
                    >
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {truckStatusLabel(truck.status)}
                    </span>
                  </div>
                  <div className="text-xs text-text-3 mt-1.5 font-mono">
                    {jobs} jobs
                  </div>
                  {stop && (
                    <div className="text-xs text-amber font-mono mt-0.5">
                      Stop {stop.current}/{stop.total}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview button (floating between sections when conditions met) */}
        {canPreview && (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              title={previewResult ? previewResult.oneliner : undefined}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border border-amber/40 bg-surface-1 text-text-0 text-sm font-medium',
                'hover:bg-amber/10 transition-all duration-150',
                previewLoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              <span>Preview</span>
              {previewLoading && (
                <span className="text-xs text-text-3">…</span>
              )}
              {previewResult && !previewLoading && (
                <span
                  className={cn(
                    'font-mono text-xs px-1.5 py-0.5 rounded',
                    previewResult.score >= 80 && 'bg-success/20 text-success',
                    previewResult.score >= 60 &&
                      previewResult.score < 80 &&
                      'bg-amber/20 text-amber',
                    previewResult.score < 60 && 'bg-danger/20 text-danger'
                  )}
                  title={previewResult.oneliner}
                >
                  {previewResult.score >= 80 && '✓ '}
                  {previewResult.score}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Workers */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs text-text-3 uppercase tracking-wider font-sans mb-2">
            Workers
          </span>
          <div className="flex gap-2 pb-2 overflow-x-auto">
            {sortedWorkers.map((worker) => {
              const assigned = workerAssignmentCount.get(worker.id) ?? 0;
              const unavailable = unavailableWorkerStatuses.includes(worker.status);
              const isDriver = worker.role === 'DRIVER';
              const selected =
                (isDriver && selectedCards.driverId === worker.id) ||
                (!isDriver && selectedCards.workerIds.includes(worker.id));
              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() =>
                    selectCard(isDriver ? 'driver' : 'worker', worker.id)
                  }
                  className={cn(
                    'shrink-0 w-[140px] p-3 rounded-lg border text-left transition-all duration-150',
                    'bg-surface-1 border-border hover:border-amber/40',
                    selected && 'border-amber ring-1 ring-amber/30',
                    unavailable && 'opacity-50'
                  )}
                >
                  <div className="font-medium text-sm text-text-0 truncate">
                    {worker.name}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-sans',
                        ROLE_STYLE[worker.role]
                      )}
                    >
                      {WORKER_ROLE_LABELS[worker.role]}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded flex items-center gap-1 font-sans',
                        WORKER_STATUS_STYLE[worker.status]
                      )}
                    >
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {workerStatusLabel(worker.status)}
                    </span>
                  </div>
                  {worker.certifications?.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {worker.certifications.slice(0, 2).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] bg-surface-2 px-1 py-0.5 rounded text-text-2"
                        >
                          {c}
                        </span>
                      ))}
                      {worker.certifications.length > 2 && (
                        <span className="text-[10px] text-text-3 font-mono">
                          +{worker.certifications.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-text-3 mt-1.5 font-sans">
                    {assigned} assigned
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
