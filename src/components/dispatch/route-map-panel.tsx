'use client';

import { useRoutes } from '@/hooks';
import type { TruckRoute, RoutePoint, JobStatus } from '@/types';
import { BOROUGH_LABELS } from '@/types';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RouteMapPanelProps {
  truckId: string | null;
  truckName: string;
  date: string;
}

function stopStatusDot(status: JobStatus) {
  if (status === 'COMPLETED') return 'bg-success';
  if (status === 'IN_PROGRESS') return 'bg-amber';
  return 'bg-info';
}

export function RouteMapPanel({ truckId, truckName, date }: RouteMapPanelProps) {
  const { data: routesData, loading: routesLoading } = useRoutes(date);
  const routes = Array.isArray(routesData) ? routesData : [];
  const route = truckId ? routes.find((r: TruckRoute) => r.truckId === truckId) : null;
  const stops = route?.stops ?? [];
  const currentIdx = route?.currentStopIndex ?? -1;
  const total = stops.length;
  const completedCount = currentIdx >= 0 ? currentIdx + (stops[currentIdx]?.status === 'COMPLETED' ? 1 : 0) : 0;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold text-text-0">
          Route — {truckName}
        </h3>
        <p className="text-xs text-text-3 mt-0.5">
          {total === 0 ? 'No stops' : `${completedCount}/${total} stops · ${pct}% complete`}
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="h-32 shrink-0 bg-surface-2 border-b border-border flex items-center justify-center text-text-3 text-sm">
          <div className="text-center">
            <p>Map loading...</p>
            <p className="text-xs mt-1 text-text-3/80">Leaflet integration pending</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {routesLoading ? (
            <p className="text-text-3 text-sm">Loading route…</p>
          ) : stops.length === 0 ? (
            <p className="text-text-3 text-sm">No stops for this truck on this date.</p>
          ) : (
            <ul className="space-y-0">
              {stops.map((stop: RoutePoint, idx: number) => {
                const isCurrent = idx === currentIdx && stop.status !== 'COMPLETED';
                const isCompleted = stop.status === 'COMPLETED' || idx < currentIdx;
                const isUpcoming = idx > currentIdx;
                return (
                  <li
                    key={stop.jobId}
                    className={cn(
                      'flex gap-3 py-2 border-b border-border/50 last:border-0',
                      isUpcoming && 'opacity-60'
                    )}
                  >
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold',
                          isCurrent && 'ring-2 ring-amber ring-offset-2 ring-offset-background animate-pulse',
                          isCompleted ? 'bg-success/20 text-success' : 'bg-surface-2 text-text-2'
                        )}
                      >
                        {isCompleted && idx !== currentIdx ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          stop.sequence + 1
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-3">{stop.time}</span>
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            stopStatusDot(stop.status)
                          )}
                          title={stop.status}
                        />
                      </div>
                      <p className="font-medium text-text-0 text-sm truncate">{stop.customer}</p>
                      <p className="text-xs text-text-3 truncate">{stop.address}</p>
                      {stop.borough && (
                        <span className="inline-block mt-1 text-xs text-text-3">
                          {BOROUGH_LABELS[stop.borough]}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="shrink-0 p-3 border-t border-border">
        <button
          type="button"
          disabled
          className="w-full py-2 rounded border border-border bg-surface-1 text-text-3 text-sm cursor-not-allowed"
        >
          Preview Add Stop
        </button>
      </div>
    </div>
  );
}
