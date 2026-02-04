'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRoutes } from '@/hooks';
import type { TruckRoute, RoutePoint, JobStatus } from '@/types';
import { JOB_STATUS_LABELS } from '@/types';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), { ssr: false });

export interface RouteMapPanelProps {
  jobId?: string | null;
  truckId: string | null;
  truckName: string;
  date: string;
}

function stopStatusDot(status: JobStatus) {
  if (status === 'COMPLETED') return 'bg-success';
  if (status === 'IN_PROGRESS') return 'bg-amber';
  return 'bg-info';
}

export function RouteMapPanel({ jobId, truckId, truckName, date }: RouteMapPanelProps) {
  const { data: routesData, loading: routesLoading } = useRoutes(date);
  const routes = Array.isArray(routesData) ? routesData : [];
  const route = truckId ? routes.find((r: TruckRoute) => r.truckId === truckId) : null;
  const stops = route?.stops ?? [];
  const currentIdx = route?.currentStopIndex ?? -1;
  const total = stops.length;
  const completedCount =
    currentIdx >= 0
      ? currentIdx + (stops[currentIdx]?.status === 'COMPLETED' ? 1 : 0)
      : 0;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const [centerOnIndex, setCenterOnIndex] = useState<number | null>(null);

  const handleStopClick = useCallback((index: number) => {
    setCenterOnIndex(index);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold text-text-0">Route — {truckName}</h3>
        {total > 0 ? (
          <>
            <p className="text-xs text-text-3 mt-0.5">
              {completedCount}/{total} stops · {pct}%
            </p>
            <div className="mt-1.5 h-1 w-full rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-text-3 mt-0.5">No stops</p>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {routesLoading ? (
          <div className="flex-1 flex items-center justify-center text-text-3 text-sm">Loading route…</div>
        ) : stops.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-text-3 text-sm">
            No stops for this truck on this date.
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-[0.65] shrink-0 border-b border-border">
              <LeafletMap
                stops={stops}
                currentStopIndex={currentIdx}
                highlightJobId={jobId ?? null}
                onStopClick={handleStopClick}
                centerOnIndex={centerOnIndex}
              />
            </div>
            <div className="flex-[0.35] min-h-0 shrink-0 overflow-y-auto">
              <ul className="p-2 space-y-0">
                {stops.map((stop: RoutePoint, idx: number) => {
                  const isCurrent = idx === currentIdx && stop.status !== 'COMPLETED';
                  const isCompleted = stop.status === 'COMPLETED' || idx < currentIdx;
                  const isUpcoming = idx > currentIdx;
                  return (
                    <li
                      key={stop.jobId}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleStopClick(idx)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStopClick(idx)}
                      className={cn(
                        'flex gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-surface-1',
                        isUpcoming && 'opacity-60'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-semibold shrink-0',
                          isCurrent && 'ring-2 ring-amber ring-offset-1 ring-offset-background animate-pulse',
                          isCompleted ? 'bg-success/20 text-success' : 'bg-surface-2 text-text-2'
                        )}
                      >
                        {isCompleted && idx !== currentIdx ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          stop.sequence + 1
                        )}
                      </div>
                      <span className="font-mono text-xs text-text-3 shrink-0">{stop.time}</span>
                      <span className="font-medium text-text-0 text-sm truncate min-w-0">{stop.customer}</span>
                      <span
                        className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1.5', stopStatusDot(stop.status))}
                        title={JOB_STATUS_LABELS[stop.status]}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
