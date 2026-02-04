'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, PanelRightClose, PanelRightOpen, Send, Loader2 } from 'lucide-react';
import { useCommandCenterStore } from '@/stores';
import { useTrucks, useWorkers, useScheduleConflicts } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ScenarioResult } from '@/types';
import { cn } from '@/lib/utils';

export interface AiChatSidebarProps {
  selectedDate: string;
  onApplied?: () => void;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-lg rounded-tl-sm bg-surface-2 text-text-2">
      <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function ScenarioCardInline({
  result,
  onApply,
  onDismiss,
  applyLoading,
}: {
  result: ScenarioResult;
  onApply: () => void;
  onDismiss: () => void;
  applyLoading: boolean;
}) {
  const scoreColor = result.score >= 70 ? 'text-success' : result.score >= 40 ? 'text-amber' : 'text-danger';
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-mono font-semibold', scoreColor)}>Score: {Math.round(result.score)}</span>
      </div>
      <p className="text-sm text-text-1">{result.recommendation}</p>
      {result.warnings?.length > 0 && (
        <ul className="text-xs text-amber list-disc list-inside">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {result.affectedRoutes?.length > 0 && (
        <div className="text-xs text-text-3 space-y-1">
          <span className="uppercase tracking-wider">Affected routes</span>
          {result.affectedRoutes.map((r, i) => (
            <div key={i} className="font-mono">
              {r.truckName}: {r.after.totalStops} stops · {r.impact}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="bg-amber text-black hover:bg-amber/90"
          onClick={onApply}
          disabled={applyLoading || !result.unassignedJobs?.length}
        >
          {applyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
        </Button>
        <Button size="sm" variant="outline" className="border-border text-text-2" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function conflictStatusMessage(conflicts: { message: string }[]): string {
  if (conflicts.length === 0) {
    return '✅ No scheduling conflicts for today. All clear.';
  }
  const lines = ['⚠️ Schedule conflicts detected for today:', ...conflicts.map((c) => `• ${c.message}`), 'Want me to suggest fixes?'];
  return lines.join('\n');
}

export function AiChatSidebar({ selectedDate, onApplied }: AiChatSidebarProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarMessages,
    addSidebarMessage,
    triggerDispatchRefetch,
    dispatchRefetchTrigger,
  } = useCommandCenterStore();

  const { data: trucksData } = useTrucks();
  const { data: workersData } = useWorkers();
  const { data: scheduleConflicts, loading: conflictsLoading, refetch: refetchScheduleConflicts } = useScheduleConflicts(selectedDate);
  const trucks = trucksData ?? [];
  const workers = workersData ?? [];
  const conflicts = Array.isArray(scheduleConflicts) ? scheduleConflicts : [];

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastConflictKeyRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [sidebarMessages, loading]);

  useEffect(() => {
    if (dispatchRefetchTrigger > 0) refetchScheduleConflicts();
  }, [dispatchRefetchTrigger, refetchScheduleConflicts]);

  useEffect(() => {
    if (conflictsLoading) return;
    const key = `${selectedDate}:${conflicts.length}:${conflicts.map((c) => c.message).join('|')}`;
    if (lastConflictKeyRef.current === key) return;
    lastConflictKeyRef.current = key;
    const content = conflictStatusMessage(conflicts);
    addSidebarMessage({ role: 'assistant', content, type: 'text' });
  }, [selectedDate, conflicts, conflictsLoading, addSidebarMessage]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addSidebarMessage({ role: 'user', content: text, type: 'text' });
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, date: selectedDate }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? 'Command failed');

      if (json.type === 'scenario') {
        const result = json.result as ScenarioResult;
        addSidebarMessage({
          role: 'assistant',
          content: result.recommendation ?? 'Scenario analysis',
          type: 'scenario',
          data: result,
        });
      } else if (json.type === 'update') {
        const msg = json.result?.message ?? 'Done';
        addSidebarMessage({
          role: 'assistant',
          content: msg,
          type: 'update',
          data: json.result,
        });
        triggerDispatchRefetch();
      } else {
        const answer = json.result?.answer ?? json.result;
        const display = answer != null ? String(answer) : '';
        addSidebarMessage({
          role: 'assistant',
          content: display || 'No response.',
          type: 'query',
        });
      }
    } catch (e) {
      addSidebarMessage({
        role: 'assistant',
        content: e instanceof Error ? e.message : 'Command failed',
        type: 'query',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyScenario = async (result: ScenarioResult) => {
    if (!result.unassignedJobs?.length) return;
    const truckById = new Map(trucks.map((t) => [t.id, t]));
    const truckByName = new Map(trucks.map((t) => [t.name, t.id]));
    const workerById = new Map(workers.map((w) => [w.id, w]));
    const workerByName = new Map(workers.map((w) => [w.name, w.id]));
    const resolveTruckId = (s: string) => truckById.has(s) ? s : truckByName.get(s) ?? null;
    const resolveDriverId = (s: string) => workerById.has(s) ? s : workerByName.get(s) ?? null;
    const changes = result.unassignedJobs
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
        body: JSON.stringify({
          changes,
          reason: result.recommendation?.slice(0, 100) ?? 'Scenario apply',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Apply failed');
      triggerDispatchRefetch();
      onApplied?.();
    } finally {
      setApplyLoading(false);
    }
  };

  const dismissScenarioInMessage = (index: number) => {
    useCommandCenterStore.setState((s) => ({
      sidebarMessages: s.sidebarMessages.map((m, i) =>
        i === index && m.type === 'scenario' ? { ...m, type: 'query' as const, data: undefined } : m
      ),
    }));
  };

  if (!sidebarOpen) {
    return (
      <div className="w-12 shrink-0 flex flex-col items-center py-2 border-l border-border bg-surface-0">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded text-text-3 hover:text-amber hover:bg-surface-2 transition-colors"
          aria-label="Expand AI chat"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
        <MessageSquare className="h-5 w-5 text-text-3 mt-2" />
      </div>
    );
  }

  return (
    <div className="w-[30%] min-w-[280px] max-w-[420px] shrink-0 flex flex-col border-l border-border bg-surface-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-text-0">Dispatch AI</h3>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded text-text-3 hover:text-amber hover:bg-surface-2 transition-colors"
          aria-label="Minimize sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {sidebarMessages.length === 0 && !loading && (
          <p className="text-text-3 text-sm py-4">Ask about today’s schedule, mark jobs complete, or run a scenario.</p>
        )}
        {sidebarMessages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-tr-sm bg-amber/20 text-amber border border-amber/30 text-sm">
                  {msg.content}
                </div>
              </div>
            );
          }
          if (msg.type === 'scenario' && msg.data) {
            const result = msg.data as ScenarioResult;
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[95%] w-full">
                  <ScenarioCardInline
                    result={result}
                    onApply={() => handleApplyScenario(result)}
                    onDismiss={() => dismissScenarioInMessage(i)}
                    applyLoading={applyLoading}
                  />
                </div>
              </div>
            );
          }
          if (msg.type === 'update') {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-tl-sm bg-success/20 text-success border border-success/30 text-sm">
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-tl-sm bg-surface-2 text-text-1 border border-border text-sm">
                {msg.content}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border shrink-0 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type a command..."
          className="h-9 bg-surface-2 border-border text-text-0 text-sm placeholder:text-text-3 flex-1 min-w-0"
          disabled={loading}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 bg-amber text-black hover:bg-amber/90"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
