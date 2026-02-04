'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Check, Loader2, X } from 'lucide-react';
import { useCommandCenterStore } from '@/stores';
import { useTrucks, useWorkers } from '@/hooks';
import { Button } from '@/components/ui/button';
import type { ScenarioResult } from '@/types';
import { cn } from '@/lib/utils';

export interface ScenarioPanelProps {
  selectedDate: string;
  onApplied: () => void;
}

function ScoreCircle({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const deg = pct * 360;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-16 h-16 shrink-0 mx-auto">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, #2b2f3a ${deg}deg)`,
        }}
      />
      <div className="absolute inset-[3px] rounded-full bg-surface-0 flex items-center justify-center">
        <span className="text-lg font-mono font-bold text-text-0">{Math.round(score)}</span>
      </div>
    </div>
  );
}

export function ScenarioPanel({ selectedDate, onApplied }: ScenarioPanelProps) {
  const {
    activeScenario,
    scenarioResult,
    scenarioLoading,
    setScenario,
    setScenarioResult,
    setScenarioLoading,
    clearScenario,
  } = useCommandCenterStore();

  const { data: trucksData } = useTrucks();
  const { data: workersData } = useWorkers();
  const trucks = trucksData ?? [];
  const workers = workersData ?? [];

  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const isOpen = scenarioResult != null || activeScenario != null || scenarioLoading;
  const hasResult = scenarioResult != null;

  // When activeScenario is set (e.g. from job dashboard "Swap truck"), run analysis
  useEffect(() => {
    if (!activeScenario || !selectedDate) return;
    setScenarioLoading(true);
    setScenarioResult(null);
    const body = JSON.stringify({ scenario: activeScenario, date: selectedDate });
    fetch('/api/dispatch/scenario-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setScenarioResult(json.data as ScenarioResult);
      })
      .finally(() => setScenarioLoading(false));
  }, [activeScenario, selectedDate, setScenarioResult, setScenarioLoading]);

  const handleClose = () => {
    clearScenario();
  };

  const handleApply = async () => {
    if (!scenarioResult?.unassignedJobs?.length) return;
    const truckById = new Map(trucks.map((t) => [t.id, t]));
    const truckByName = new Map(trucks.map((t) => [t.name, t.id]));
    const workerById = new Map(workers.map((w) => [w.id, w]));
    const workerByName = new Map(workers.map((w) => [w.name, w.id]));
    const resolveTruckId = (s: string) => truckById.has(s) ? s : truckByName.get(s) ?? null;
    const resolveDriverId = (s: string) => workerById.has(s) ? s : workerByName.get(s) ?? null;
    const changes = scenarioResult.unassignedJobs
      .map((j) => {
        const newTruckId = resolveTruckId(j.suggestedTruck);
        const newDriverId = resolveDriverId(j.suggestedDriver);
        if (!newTruckId && !newDriverId) return null;
        return {
          jobId: j.jobId,
          ...(newTruckId ? { newTruckId } : {}),
          ...(newDriverId ? { newDriverId } : {}),
        };
      })
      .filter((c): c is { jobId: string; newTruckId?: string; newDriverId?: string } => c != null);

    if (changes.length === 0) return;
    setApplyLoading(true);
    try {
      const res = await fetch('/api/dispatch/apply-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, reason: scenarioResult.recommendation?.slice(0, 100) ?? 'Scenario apply' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Apply failed');
      clearScenario();
      onApplied();
    } finally {
      setApplyLoading(false);
    }
  };

  const handleTryAnother = () => {
    setScenarioResult(null);
  };

  const handleTryAlternative = (alt: ScenarioResult['alternativeScenarios'][0]) => {
    if (alt.scenarioInput) {
      setScenario(alt.scenarioInput);
      setScenarioResult(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden
        onClick={handleClose}
      />
      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[800px] max-h-[90vh] flex flex-col bg-surface-0 border border-border rounded-lg shadow-modal overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 id="scenario-title" className="text-lg font-semibold text-text-0">
            Scenario Analysis
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded text-text-3 hover:text-text-0 hover:bg-surface-2 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {scenarioLoading && (
            <div className="flex items-center justify-center py-12 text-text-3 text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing scenario…
            </div>
          )}

          {!scenarioLoading && hasResult && scenarioResult && (
            <>
              <div className="flex flex-col items-center gap-2">
                <ScoreCircle score={scenarioResult.score} />
                <span className="text-xs text-text-3 font-sans">Score</span>
              </div>

              <div className="border-l-2 border-amber bg-surface-1 p-3 rounded-r text-sm text-text-0">
                {scenarioResult.recommendation}
              </div>

              {scenarioResult.affectedRoutes?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-text-3 uppercase tracking-wider font-sans">
                    Affected routes
                  </span>
                  {scenarioResult.affectedRoutes.map((r, i) => (
                    <div
                      key={r.truckId + String(i)}
                      className="grid grid-cols-2 gap-2 bg-surface-1 rounded border border-border p-2 text-xs"
                    >
                      <div>
                        <div className="text-text-3 uppercase tracking-wider mb-0.5">Before</div>
                        <div className="font-medium text-text-0">{r.truckName}</div>
                        <div className="text-text-3 font-mono">{r.before.totalStops} stops · {r.before.estimatedDuration}</div>
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {r.before.boroughs?.map((b) => (
                            <span key={b} className="px-1 py-0.5 rounded bg-surface-2 text-text-2 text-[10px]">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-text-3 uppercase tracking-wider mb-0.5">After</div>
                        <div className="font-medium text-text-0">{r.truckName}</div>
                        <div className="text-text-3 font-mono">{r.after.totalStops} stops · {r.after.estimatedDuration}</div>
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {r.after.boroughs?.map((b) => (
                            <span key={b} className="px-1 py-0.5 rounded bg-surface-2 text-text-2 text-[10px]">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="col-span-2 text-text-3 text-xs mt-1">{r.impact}</p>
                    </div>
                  ))}
                </div>
              )}

              {scenarioResult.unassignedJobs?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-text-3 uppercase tracking-wider font-sans">
                    Unassigned jobs
                  </span>
                  {scenarioResult.unassignedJobs.map((j) => (
                    <div
                      key={j.jobId}
                      className="bg-surface-1 rounded border border-border p-2 text-xs"
                    >
                      <div className="font-medium text-text-0">{j.customer}</div>
                      <div className="text-text-2">{j.address}</div>
                      <div className="font-mono text-text-3 mt-0.5">{j.time}</div>
                      <div className="text-success mt-1">
                        Suggested: {j.suggestedTruck} with {j.suggestedDriver}
                      </div>
                      <p className="text-text-3 text-xs mt-0.5">{j.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {scenarioResult.warnings?.length > 0 && (
                <div className="space-y-1">
                  {scenarioResult.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-amber text-xs"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {scenarioResult.alternativeScenarios?.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setAlternativesOpen((o) => !o)}
                    className="text-xs text-text-3 uppercase tracking-wider font-sans hover:text-text-0 flex items-center gap-1"
                  >
                    Alternative scenarios
                    <ChevronDown className={cn('h-3 w-3 transition-transform', alternativesOpen && 'rotate-180')} />
                  </button>
                  {alternativesOpen && (
                    <div className="space-y-2">
                      {scenarioResult.alternativeScenarios.map((alt, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 bg-surface-1 rounded border border-border p-2 text-xs"
                        >
                          <div>
                            <span className="font-medium text-text-0">{alt.label}</span>
                            <span className="ml-2 font-mono text-text-3">{alt.score}</span>
                            <p className="text-text-2 mt-0.5">{alt.summary}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-amber/40 text-amber hover:bg-amber/10"
                            onClick={() => handleTryAlternative(alt)}
                            disabled={!alt.scenarioInput}
                          >
                            Try This
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — only when we have a result */}
        {!scenarioLoading && hasResult && scenarioResult && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border shrink-0 bg-surface-0">
            <Button
              type="button"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApply}
              disabled={applyLoading || !scenarioResult.unassignedJobs?.length}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Apply Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border text-text-2 hover:text-amber hover:border-amber/40"
              onClick={handleTryAnother}
            >
              Try Another
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary"
              onClick={handleClose}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
