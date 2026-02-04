'use client';

import { useMemo, useState } from 'react';
import { useCommandCenterStore } from '@/stores';
import type { TruckRoute, RoutePoint, Borough } from '@/types';
import { BOROUGH_LABELS, JOB_STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const TRUCK_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#14b8a6',
  '#f43f5e',
  '#f97316',
  '#06b6d4',
];

const BOROUGH_ZONES: Record<
  Borough,
  { x: number; y: number; width: number; height: number; labelX: number; labelY: number }
> = {
  STATEN_ISLAND: { x: 50, y: 400, width: 150, height: 150, labelX: 125, labelY: 475 },
  BROOKLYN: { x: 250, y: 350, width: 200, height: 200, labelX: 350, labelY: 450 },
  MANHATTAN: { x: 200, y: 80, width: 120, height: 270, labelX: 260, labelY: 215 },
  QUEENS: { x: 400, y: 150, width: 300, height: 250, labelX: 550, labelY: 275 },
  BRONX: { x: 250, y: 20, width: 250, height: 160, labelX: 375, labelY: 100 },
};

function computePointPositions(routes: TruckRoute[]): Map<string, { x: number; y: number }> {
  const byBorough = new Map<Borough, RoutePoint[]>();
  for (const route of routes) {
    for (const stop of route.stops) {
      const list = byBorough.get(stop.borough) ?? [];
      list.push(stop);
      byBorough.set(stop.borough, list);
    }
  }
  const out = new Map<string, { x: number; y: number }>();
  const padding = 24;
  for (const [borough, points] of byBorough) {
    const zone = BOROUGH_ZONES[borough];
    if (!zone || points.length === 0) continue;
    const cols = Math.ceil(Math.sqrt(points.length));
    const rows = Math.ceil(points.length / cols);
    const cellW = Math.max(20, (zone.width - padding * 2) / cols);
    const cellH = Math.max(20, (zone.height - padding * 2) / rows);
    points.forEach((p, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = zone.x + padding + col * cellW + cellW / 2;
      const y = zone.y + padding + row * cellH + cellH / 2;
      out.set(p.jobId, { x, y });
    });
  }
  return out;
}

const STATUS_COLORS = {
  COMPLETED: '#22c55e',
  IN_PROGRESS: '#f97316',
  SCHEDULED: '#3b82f6',
  DELAYED: '#eab308',
  CANCELLED: '#6b7280',
} as const;

export interface RouteMapProps {
  routes: TruckRoute[];
  selectedDate: string;
  /** When true, dot color by job status (green/orange/blue) instead of truck color */
  colorDotsByStatus?: boolean;
  /** Job IDs to highlight as conflicting (red) */
  conflictJobIds?: string[];
  /** One-line impact summary shown below the map */
  impactSummary?: string;
}

export function RouteMap({
  routes,
  colorDotsByStatus = false,
  conflictJobIds = [],
  impactSummary,
}: RouteMapProps) {
  const {
    selectedTruckRoutes,
    highlightedJobId,
    showAllRoutes,
    setHighlightedJob,
    toggleRoute,
    setShowAllRoutes,
    setSelectedRoutes,
  } = useCommandCenterStore();

  const [tooltip, setTooltip] = useState<{
    jobId: string;
    x: number;
    y: number;
    customer: string;
    address: string;
    time: string;
    truckName: string;
    status: string;
  } | null>(null);

  const allTruckIds = useMemo(() => routes.map((r) => r.truckId), [routes]);
  const visibleSet = useMemo(() => {
    // When only one route is passed (e.g. job dashboard), always show it
    if (routes.length === 1) return new Set(allTruckIds);
    const sel = showAllRoutes ? allTruckIds : selectedTruckRoutes;
    return new Set(sel);
  }, [routes.length, showAllRoutes, selectedTruckRoutes, allTruckIds]);

  const positions = useMemo(() => computePointPositions(routes), [routes]);
  const truckColorById = useMemo(() => {
    const m = new Map<string, string>();
    routes.forEach((r, i) => m.set(r.truckId, TRUCK_COLORS[i % TRUCK_COLORS.length]));
    return m;
  }, [routes]);

  const handleAll = () => {
    setShowAllRoutes(true);
    setSelectedRoutes(allTruckIds);
  };
  const handleNone = () => {
    setShowAllRoutes(false);
    setSelectedRoutes([]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative border border-border rounded bg-surface-0 overflow-hidden">
        <svg
          viewBox="0 0 800 600"
          className="w-full h-auto min-h-[320px] block"
          style={{ maxHeight: 'min(70vh, 480px)' }}
        >
          <defs>
            <filter id="ring" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="white" floodOpacity="1" />
            </filter>
          </defs>
          {/* Boroughs */}
          {Object.entries(BOROUGH_ZONES).map(([borough, zone]) => (
            <g key={borough}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx={8}
                ry={8}
                className="fill-surface-2 stroke-border"
                strokeWidth={1}
              />
              <text
                x={zone.labelX}
                y={zone.labelY}
                textAnchor="middle"
                className="text-xs"
                style={{ fill: '#5e6170', fontFamily: 'DM Sans, system-ui' }}
              >
                {BOROUGH_LABELS[borough as Borough]}
              </text>
            </g>
          ))}

          {/* Route lines (behind dots) */}
          {routes.map((route) => {
            const color = truckColorById.get(route.truckId) ?? '#f59e0b';
            const hidden = !visibleSet.has(route.truckId);
            const points = route.stops
              .map((s) => positions.get(s.jobId))
              .filter((p): p is { x: number; y: number } => p != null);
            if (points.length < 2) return null;
            const currentIdx = route.currentStopIndex;
            return (
              <g key={route.truckId} style={{ opacity: hidden ? 0.1 : 1 }}>
                {points.slice(0, -1).map((p, i) => {
                  const next = points[i + 1];
                  const isFuture = i >= currentIdx;
                  return (
                    <line
                      key={i}
                      x1={p.x}
                      y1={p.y}
                      x2={next.x}
                      y2={next.y}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      strokeDasharray={isFuture ? '4 3' : undefined}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Job dots */}
          {routes.map((route) => {
            const truckColor = truckColorById.get(route.truckId) ?? '#f59e0b';
            const hidden = !visibleSet.has(route.truckId);
            return route.stops.map((stop) => {
              const pos = positions.get(stop.jobId);
              if (!pos) return null;
              const isHighlighted = highlightedJobId === stop.jobId;
              const isInProgress = stop.status === 'IN_PROGRESS';
              const isCompleted = stop.status === 'COMPLETED';
              const isConflict = conflictJobIds.includes(stop.jobId);
              const dotColor = isConflict
                ? '#ef4444'
                : colorDotsByStatus
                  ? (STATUS_COLORS[stop.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.SCHEDULED)
                  : truckColor;
              const r = isInProgress ? 8 : 6;
              return (
                <g
                  key={stop.jobId}
                  style={{ opacity: hidden ? 0.1 : 1 }}
                  onMouseEnter={() =>
                    setTooltip({
                      jobId: stop.jobId,
                      x: pos.x,
                      y: pos.y,
                      customer: stop.customer,
                      address: stop.address,
                      time: stop.time,
                      truckName: stop.truckName,
                      status: JOB_STATUS_LABELS[stop.status],
                    })
                  }
                  onMouseLeave={() => setTooltip((t) => (t?.jobId === stop.jobId ? null : t))}
                  onClick={() => setHighlightedJob(stop.jobId)}
                  className="cursor-pointer"
                >
                  {isHighlighted && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 3}
                      fill="none"
                      stroke="white"
                      strokeWidth={3}
                      filter="url(#ring)"
                    />
                  )}
                  {isCompleted ? (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill="none"
                      stroke={dotColor}
                      strokeWidth={2}
                    />
                  ) : (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill={dotColor}
                      className={isInProgress ? 'animate-pulse' : ''}
                    />
                  )}
                </g>
              );
            });
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 px-2 py-1.5 rounded bg-surface-2 border border-border text-xs font-sans pointer-events-none shadow-modal"
            style={{
              left: `calc(${(tooltip.x / 800) * 100}% - 80px)`,
              top: `calc(${(tooltip.y / 600) * 100}% - 60px)`,
              minWidth: 160,
            }}
          >
            <div className="font-medium text-text-0">{tooltip.customer}</div>
            <div className="text-text-2 truncate">{tooltip.address}</div>
            <div className="font-mono text-text-3 mt-0.5">{tooltip.time}</div>
            <div className="text-text-3">{tooltip.truckName} · {tooltip.status}</div>
          </div>
        )}
      </div>

      {/* Impact summary (job dashboard) */}
      {impactSummary && (
        <p className="text-sm text-text-2 border-t border-border pt-2 mt-2">
          {impactSummary}
        </p>
      )}

      {/* Truck legend */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAll}
          className="text-xs px-2 py-1 rounded border border-border bg-surface-1 text-text-2 hover:text-text-0 hover:border-amber/40 transition-colors duration-150"
        >
          All
        </button>
        <button
          type="button"
          onClick={handleNone}
          className="text-xs px-2 py-1 rounded border border-border bg-surface-1 text-text-2 hover:text-text-0 hover:border-amber/40 transition-colors duration-150"
        >
          None
        </button>
        <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-border">
          {routes.map((route) => {
            const color = truckColorById.get(route.truckId) ?? '#f59e0b';
            const active = visibleSet.has(route.truckId);
            return (
              <button
                key={route.truckId}
                type="button"
                onClick={() => {
                  setShowAllRoutes(false);
                  toggleRoute(route.truckId);
                }}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all duration-150',
                  active
                    ? 'border-border bg-surface-1 text-text-0 hover:border-amber/40'
                    : 'border-border/50 bg-surface-0 text-text-3 opacity-60 hover:opacity-100'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-sans">{route.truckName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
