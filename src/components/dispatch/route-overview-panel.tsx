'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { TruckRoute, RoutePoint, JobStatus } from '@/types';
import { JOB_STATUS_LABELS, BOROUGH_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), { ssr: false });

const ROUTE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#6366f1'];

export interface RouteOverviewPanelProps {
  date: string;
  onOpenJob: (jobId: string) => void;
  highlightedJobId?: string | null;
  /** When set, expand this route (truckId) and scroll into view */
  expandedRouteId?: string | null;
  /** When set with expandedRouteId, scroll this job into view in the expanded stop list */
  scrollToJobId?: string | null;
  onHighlightTruck?: (truckId: string | null, color?: string) => void;
}

interface RouteOverviewResponse {
  routes?: TruckRoute[];
  data?: TruckRoute[];
  unassigned?: Array<{
    jobId: string;
    time: string;
    customer: string;
    address: string;
    borough: string;
  }>;
}

function formatRouteDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function boroughFlow(boroughs: string[]): string {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const b of boroughs) {
    const label = BOROUGH_LABELS[b as keyof typeof BOROUGH_LABELS] ?? b;
    if (seen.has(label)) continue;
    seen.add(label);
    order.push(label);
  }
  return order.join(' → ') || '—';
}

function stopStatusLabel(status: JobStatus): string {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'DELAYED') return 'Delayed';
  return 'Scheduled';
}

function routeStatusInfo(route: TruckRoute): { label: string; dot: string } {
  const allComplete = route.stops.every((s) => s.status === 'COMPLETED');
  if (allComplete) return { label: 'Complete', dot: 'bg-success' };
  const anyInProgress = route.stops.some((s) => s.status === 'IN_PROGRESS');
  if (anyInProgress) return { label: 'En route', dot: 'bg-amber animate-pulse' };
  const anyDelayed = route.stops.some((s) => s.status === 'DELAYED');
  if (anyDelayed) return { label: 'Delayed', dot: 'bg-danger' };
  return { label: 'Scheduled', dot: 'bg-info' };
}

export function RouteOverviewPanel({
  date,
  onOpenJob,
  highlightedJobId,
  expandedRouteId,
  scrollToJobId,
  onHighlightTruck,
}: RouteOverviewPanelProps) {
  const [routes, setRoutes] = useState<TruckRoute[]>([]);
  const [unassigned, setUnassigned] = useState<RouteOverviewResponse['unassigned']>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollToRef = useRef<HTMLDivElement>(null);

  const fetchRoutes = useCallback(() => {
    setLoading(true);
    fetch('/api/dispatch/routes?date=' + encodeURIComponent(date))
      .then((res) => res.json())
      .then((data: RouteOverviewResponse) => {
        const list = data.routes ?? data.data ?? [];
        setRoutes(Array.isArray(list) ? list : []);
        setUnassigned(Array.isArray(data.unassigned) ? data.unassigned : []);
      })
      .catch(() => {
        setRoutes([]);
        setUnassigned([]);
      })
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (expandedRouteId) setExpandedId(expandedRouteId);
  }, [expandedRouteId]);

  useEffect(() => {
    if (!scrollToJobId || !scrollToRef.current) return;
    scrollToRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [scrollToJobId, expandedId]);

  const totalStops = routes.reduce((acc, r) => acc + r.stops.length, 0);
  const getCompleted = (route: TruckRoute) =>
    route.stops.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div className="flex flex-col h-full min-h-0 w-full border-l border-r border-border bg-surface-0">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 text-text-3 text-xs">
        <div>Routes · {formatRouteDate(date)}</div>
        <div>
          {loading ? '…' : `${routes.length} route${routes.length !== 1 ? 's' : ''} · ${totalStops} stops`}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-text-3 text-sm">Loading routes…</div>
        ) : routes.length === 0 && (unassigned?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-text-3 text-sm">
            <p>No routes for this date</p>
            <p className="mt-1 text-xs">Jobs without assigned trucks won&apos;t appear here</p>
          </div>
        ) : (
          <>
            {routes.map((route, routeIndex) => {
              const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
              const isExpanded = expandedId === route.truckId;
              const statusInfo = routeStatusInfo(route);
              const completed = getCompleted(route);
              const pct = route.stops.length > 0 ? Math.round((completed / route.stops.length) * 100) : 0;
              const displayPct = Math.min(100, pct);

              return (
                <div
                  key={route.truckId}
                  className={cn(
                    'border-b border-border bg-surface-1 transition-colors',
                    isExpanded && 'bg-surface-2'
                  )}
                  style={{ borderLeftWidth: 4, borderLeftColor: color }}
                  onMouseEnter={() => onHighlightTruck?.(route.truckId, color)}
                  onMouseLeave={() => onHighlightTruck?.(null)}
                >
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-surface-2/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : route.truckId)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-0 text-sm truncate">
                        {route.truckName} · {route.driverName ?? 'No driver'}
                      </span>
                      <span className="text-xs text-text-3 shrink-0">{route.stops.length} stops</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-text-2 truncate">
                        {boroughFlow(route.boroughs)}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <div className="w-12 h-1 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${displayPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-3">{displayPct}%</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {statusInfo.label === 'Complete' ? (
                        <span className="text-[11px] text-success font-medium">Complete</span>
                      ) : (
                        <>
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusInfo.dot)} />
                          <span className="text-[11px] text-text-2">{statusInfo.label}</span>
                        </>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/60">
                      <div className="h-[200px] w-full rounded overflow-hidden mt-2 bg-surface-0">
                        <LeafletMap
                          stops={route.stops}
                          currentStopIndex={route.currentStopIndex}
                          highlightJobId={highlightedJobId ?? null}
                          centerOnIndex={null}
                        />
                      </div>
                      <ul className="mt-2 space-y-0.5">
                        {route.stops.map((stop, idx) => {
                          const isCurrent = idx === route.currentStopIndex && stop.status !== 'COMPLETED';
                          const isScrollTarget = stop.jobId === scrollToJobId;
                          return (
                            <li key={stop.jobId}>
                              <div
                                ref={isScrollTarget ? scrollToRef : undefined}
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenJob(stop.jobId)}
                                onKeyDown={(e) => e.key === 'Enter' && onOpenJob(stop.jobId)}
                                className={cn(
                                  'flex items-center gap-2 py-1.5 px-2 rounded text-left text-sm cursor-pointer hover:bg-surface-2 transition-colors',
                                  isCurrent && 'bg-amber/10',
                                  stop.status === 'COMPLETED' && 'text-text-3'
                                )}
                              >
                                <span className="font-mono text-xs text-text-3 w-5 shrink-0">{idx + 1}.</span>
                                <span className="font-mono text-xs text-text-2 w-12 shrink-0">{stop.time}</span>
                                <span className="font-medium text-text-0 truncate min-w-0 flex-1">{stop.customer}</span>
                                <span className="text-xs text-text-3 shrink-0">
                                  {BOROUGH_LABELS[stop.borough as keyof typeof BOROUGH_LABELS] ?? stop.borough}
                                </span>
                                <span className="flex items-center gap-1 shrink-0 text-[11px] text-text-3">
                                  {stop.status === 'COMPLETED' ? (
                                    <span className="text-success">●</span>
                                  ) : stop.status === 'IN_PROGRESS' ? (
                                    <span className="text-amber">◉</span>
                                  ) : (
                                    <span className="text-info">●</span>
                                  )}
                                  {stopStatusLabel(stop.status as JobStatus)}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            {unassigned && unassigned.length > 0 && (
              <div className="border-t border-border mt-2 mx-2 mb-2 rounded border-l-4 border-text-3/60 bg-surface-2">
                <div className="px-3 py-2 text-amber text-xs font-medium">
                  ⚠️ Unassigned · {unassigned.length} job{unassigned.length !== 1 ? 's' : ''}
                </div>
                <ul className="pb-2">
                  {unassigned.map((j) => (
                    <li key={j.jobId}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 py-1.5 px-3 text-left text-sm hover:bg-amber/10 transition-colors"
                        onClick={() => onOpenJob(j.jobId)}
                      >
                        <span className="font-mono text-xs text-text-2 w-12 shrink-0">{j.time}</span>
                        <span className="font-medium text-text-0 truncate flex-1">{j.customer}</span>
                        <span className="text-xs text-text-3 shrink-0">
                          {BOROUGH_LABELS[j.borough as keyof typeof BOROUGH_LABELS] ?? j.borough}
                        </span>
                        <span className="text-[11px] text-text-3 shrink-0">No truck</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
