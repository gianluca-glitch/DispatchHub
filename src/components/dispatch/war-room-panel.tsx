'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkers, useTrucks, useConflicts } from '@/hooks';
import { useCommandCenterStore } from '@/stores';
import type {
  CartingJob,
  WorkerStatus,
  TruckStatus,
  JobAnalysis,
} from '@/types';
import { TRUCK_TYPE_LABELS, WORKER_ROLE_LABELS } from '@/types';
import { ConflictBanner } from './conflict-banner';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Conflict } from '@/types';

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

export function WarRoomPanel({ job, date }: WarRoomPanelProps) {
  const { data: workersData } = useWorkers();
  const { data: trucksData } = useTrucks();
  const { data: conflictsData } = useConflicts(job?.id ?? null, date);
  const workers = workersData ?? [];
  const trucks = trucksData ?? [];
  const conflicts = conflictsData ?? [];
  const setModifiedField = useCommandCenterStore((s) => s.setModifiedField);

  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(null);
  const [jobAnalysisLoading, setJobAnalysisLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const jobContext = useMemo(
    () =>
      job
        ? {
            id: job.id,
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

  const runJobAnalyze = useCallback(() => {
    if (!job?.id) return;
    setJobAnalysisLoading(true);
    fetch('/api/dispatch/job-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, date, action: 'initial' }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setJobAnalysis(data);
      })
      .catch(() => setJobAnalysis(null))
      .finally(() => setJobAnalysisLoading(false));
  }, [job?.id, date]);

  useEffect(() => {
    if (!job?.id) {
      setJobAnalysis(null);
      return;
    }
    runJobAnalyze();
  }, [job?.id, date, runJobAnalyze]);

  const searchLower = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchLower || searchLower.length < 2) return { workers: [], trucks: [] };
    const w = workers
      .filter((worker) => worker.name.toLowerCase().includes(searchLower))
      .slice(0, 5);
    const t = trucks
      .filter((truck) => truck.name.toLowerCase().includes(searchLower))
      .slice(0, 5);
    return { workers: w, trucks: t };
  }, [searchLower, workers, trucks]);
  const hasSearchResults =
    searchResults.workers.length > 0 || searchResults.trucks.length > 0;

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
        Select a job to see conflicts, AI recommendations, and chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0">
      {toastMsg && (
        <div className="shrink-0 mx-3 mt-2 p-2 rounded border border-amber/40 bg-amber/10 text-amber text-xs">
          {toastMsg}
        </div>
      )}

      {/* Section 1: Conflicts — compact, always visible */}
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-1.5">
          Conflicts
        </h3>
        {conflicts.length === 0 ? (
          <div className="rounded border-l-2 border-success bg-success/10 text-success px-2 py-1.5 text-xs">
            No conflicts
          </div>
        ) : (
          <div className="space-y-1">
            {conflicts.map((c: Conflict) => (
              <div
                key={`${c.type}-${c.affectedJobId ?? c.message}`}
                className="rounded border-l-2 border-amber bg-amber/10 px-2 py-1"
              >
                <ConflictBanner conflict={c} className="border-0 rounded-r text-xs py-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: AI Recommendations */}
      <div className="shrink-0 px-3 py-2 border-b border-border overflow-y-auto max-h-[50vh]">
        <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
          AI RECOMMENDATIONS
        </h3>
        {jobAnalysisLoading ? (
          <div className="flex items-center gap-2 text-text-3 text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing…
          </div>
        ) : (
          <div className="space-y-2">
            {(jobAnalysis?.workerRecs ?? []).slice(0, 3).map((rec) => (
              <div
                key={rec.workerId}
                className="rounded border-l-4 border-success bg-surface-1 p-2 text-sm"
              >
                <div className="font-medium text-text-0">
                  {rec.name} — Score: {rec.score}
                </div>
                <p className="text-xs text-text-3 mt-0.5 line-clamp-1">{rec.reason}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1.5 h-7 text-xs border-success/40 text-success hover:bg-success/10"
                  onClick={() => setModifiedField('driverId', rec.workerId)}
                >
                  Assign
                </Button>
              </div>
            ))}
            {(jobAnalysis?.truckRecs ?? []).slice(0, 3).map((rec) => (
              <div
                key={rec.truckId}
                className="rounded border-l-4 border-info bg-surface-1 p-2 text-sm"
              >
                <div className="font-medium text-text-0">
                  {rec.name} — {TRUCK_TYPE_LABELS[rec.type as keyof typeof TRUCK_TYPE_LABELS] ?? rec.type}
                </div>
                <p className="text-xs text-text-3 mt-0.5 line-clamp-1">{rec.reason}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1.5 h-7 text-xs border-info/40 text-info hover:bg-info/10"
                  onClick={() => setModifiedField('truckId', rec.truckId)}
                >
                  Use This
                </Button>
              </div>
            ))}
            {(jobAnalysis?.optimizationTip ?? (jobAnalysis?.recommendations ?? [])[0]) && (
              <div className="rounded border-l-4 border-amber bg-surface-1 p-2 text-sm">
                <p className="text-xs text-text-0">
                  {jobAnalysis?.optimizationTip ?? (jobAnalysis?.recommendations ?? [])[0]}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1.5 h-7 text-xs border-amber/40 text-amber hover:bg-amber/10"
                  onClick={() => {
                    const tip = jobAnalysis?.optimizationTip ?? (jobAnalysis?.recommendations ?? [])[0];
                    if (tip) toast.info(tip, { duration: 4000 });
                  }}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Search crew or trucks */}
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <Input
          type="text"
          placeholder="Search crew or trucks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm bg-surface-1 border-border"
        />
        {searchLower.length >= 2 && (
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {searchResults.workers.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 rounded bg-surface-1 px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-text-0 truncate">{w.name}</span>
                  <span className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text-2 shrink-0">
                    {WORKER_ROLE_LABELS[w.role]}
                  </span>
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', workerStatusColor(w.status))} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs shrink-0"
                  onClick={() => setModifiedField('driverId', w.id)}
                >
                  Assign
                </Button>
              </div>
            ))}
            {searchResults.trucks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded bg-surface-1 px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-text-0 truncate">{t.name}</span>
                  <span className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text-2 shrink-0">
                    {TRUCK_TYPE_LABELS[t.type]}
                  </span>
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', truckStatusColor(t.status))} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs shrink-0"
                  onClick={() => setModifiedField('truckId', t.id)}
                >
                  Use This
                </Button>
              </div>
            ))}
            {!hasSearchResults && (
              <p className="text-xs text-text-3 py-1">No crew or trucks match.</p>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Chat — bottom, always visible */}
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
