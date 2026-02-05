'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, PanelRightClose, PanelRightOpen, Send, Loader2, Truck, User, Check, Clock } from 'lucide-react';
import { useCommandCenterStore } from '@/stores';
import { useTrucks, useWorkers, useScheduleConflicts } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ScenarioResult, VoiceCommandActionItem } from '@/types';
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

function conflictStatusMessage(conflicts: { type?: string; message: string; severity?: string }[]): string {
  if (conflicts.length === 0) {
    return '✅ All clear for today. What do you need?';
  }

  const truckConflicts = conflicts.filter(c => c.type === 'TRUCK_DOUBLE_BOOK');
  const driverConflicts = conflicts.filter(c => c.type === 'DRIVER_DOUBLE_BOOK');
  const sickWorkers = conflicts.filter(c => c.type === 'WORKER_OUT_SICK');
  const projectLocks = conflicts.filter(c => c.type === 'PROJECT_RESOURCE_LOCK');
  const criticalCount = conflicts.filter(c => c.severity === 'CRITICAL').length;

  const lines: string[] = [];
  lines.push(`⚠️ ${conflicts.length} conflicts detected${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}:`);

  if (truckConflicts.length > 0) {
    const names = [...new Set(truckConflicts.map(c => c.message.split(' is also')[0]))];
    lines.push(`🚛 ${truckConflicts.length} truck double-book${truckConflicts.length > 1 ? 's' : ''}: ${names.join(', ')}`);
  }
  if (driverConflicts.length > 0) {
    const names = [...new Set(driverConflicts.map(c => c.message.split(' is also')[0]))];
    lines.push(`👷 ${driverConflicts.length} driver overlap${driverConflicts.length > 1 ? 's' : ''}: ${names.join(', ')}`);
  }
  if (sickWorkers.length > 0) {
    const names = sickWorkers.map(c => c.message.replace(' is flagged OUT SICK today', ''));
    lines.push(`🤒 ${sickWorkers.length} out sick: ${names.join(', ')}`);
  }
  if (projectLocks.length > 0) {
    const projectNames = [...new Set(projectLocks.map(c => {
      const match = c.message.match(/active project: (.+)/);
      return match ? match[1] : c.message;
    }))];
    lines.push(`📋 ${projectNames.length} project lock${projectNames.length > 1 ? 's' : ''}: ${projectNames.join(', ')}`);
  }

  lines.push('');
  lines.push("Say 'details' for the full list, or 'fix it' and I'll resolve what I can.");
  return lines.join('\n');
}

function getActionIcon(action: VoiceCommandActionItem['action']) {
  switch (action) {
    case 'assign_truck':
    case 'swap_truck':
      return Truck;
    case 'assign_driver':
    case 'swap_driver':
      return User;
    case 'mark_complete':
    case 'mark_delayed':
      return Check;
    case 'reschedule':
      return Clock;
    default:
      return Check;
  }
}

function getActionLabel(act: VoiceCommandActionItem): string {
  const p = act.params ?? {};
  switch (act.action) {
    case 'assign_truck':
      return `Assign Truck: ${act.jobName} → ${p.truckName ?? p.truckId ?? '?'}`;
    case 'assign_driver':
      return `Assign Driver: ${act.jobName} → ${p.driverName ?? p.driverId ?? '?'}`;
    case 'swap_truck':
      return `Swap Truck: ${act.jobName} → ${p.newTruckName ?? p.newTruckId ?? '?'}`;
    case 'swap_driver':
      return `Swap Driver: ${act.jobName} → ${p.newDriverName ?? p.newDriverId ?? '?'}`;
    case 'mark_complete':
      return `Mark Complete: ${act.jobName}`;
    case 'mark_delayed':
      return `Mark Delayed: ${act.jobName}`;
    case 'reschedule':
      return `Reschedule: ${act.jobName} → ${p.newDate ?? '?'}${p.newTime ? ` ${p.newTime}` : ''}`;
    default:
      return `${act.action}: ${act.jobName}`;
  }
}

export function AiChatSidebar({ selectedDate, onApplied }: AiChatSidebarProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarMessages,
    addSidebarMessage,
    triggerDispatchRefetch,
    dispatchRefetchTrigger,
    setLastSuggestedActions,
    clearLastSuggestedActions,
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
  const [greetingPosted, setGreetingPosted] = useState(false);
  const prevDateRef = useRef(selectedDate);
  const selectedDateRef = useRef(selectedDate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingStartDateRef = useRef<string | null>(null);
  const loadingForDateRef = useRef<string | null>(null);
  const isCurrentDateLoading = loading && loadingForDateRef.current === selectedDate;

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [sidebarMessages, loading]);

  useEffect(() => {
    if (dispatchRefetchTrigger > 0) refetchScheduleConflicts();
  }, [dispatchRefetchTrigger, refetchScheduleConflicts]);

  // Save/restore chat per date
  useEffect(() => {
    if (prevDateRef.current !== selectedDate) {
      // If user has unsent text, clear it when switching dates so they don't send to wrong day
      if (input.trim()) {
        setInput('');
        typingStartDateRef.current = null;
      }
      if (prevDateRef.current && sidebarMessages.length > 0) {
        useCommandCenterStore.getState().setSidebarMessagesForDate(prevDateRef.current, sidebarMessages);
      }
      const saved = useCommandCenterStore.getState().sidebarMessagesByDate[selectedDate] ?? [];
      useCommandCenterStore.setState({ sidebarMessages: saved });
      setGreetingPosted(saved.length > 0);
      prevDateRef.current = selectedDate;
    }
  }, [selectedDate, sidebarMessages, input]);

  // Post greeting ONLY after we have real data (not before SWR returns)
  useEffect(() => {
    if (greetingPosted) return;
    if (conflictsLoading) return;
    if (scheduleConflicts === undefined || scheduleConflicts === null) return;
    const content = conflictStatusMessage(conflicts);
    addSidebarMessage({ role: 'assistant', content, type: 'text' });
    setGreetingPosted(true);
  }, [conflictsLoading, scheduleConflicts, conflicts, greetingPosted, addSidebarMessage]);

  const addMessageForDate = (targetDate: string, message: Parameters<typeof addSidebarMessage>[0]) => {
    if (targetDate === selectedDateRef.current) {
      addSidebarMessage(message);
    } else {
      const store = useCommandCenterStore.getState();
      const existing = store.sidebarMessagesByDate[targetDate] ?? [];
      store.setSidebarMessagesForDate(targetDate, [...existing, message]);
    }
  };

  const buildConversationHistory = (): { role: string; content: string }[] => {
    return sidebarMessages.slice(-6).map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
  };

  const sendMessage = async (overrideText?: string) => {
    // Use the date from when typing started, fall back to current
    const messageDate = typingStartDateRef.current ?? selectedDate;
    const text = (overrideText ?? input.trim()).trim();
    if (!text || isCurrentDateLoading) return;
    // Reset typing lock
    typingStartDateRef.current = null;
    const history = buildConversationHistory();
    if (!overrideText) setInput('');
    addMessageForDate(messageDate, { role: 'user', content: text, type: 'text' });
    loadingForDateRef.current = messageDate;
    setLoading(true);
    clearLastSuggestedActions();
    try {
      const res = await fetch('/api/dispatch/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          date: messageDate,
          conversationHistory: history,
        }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? 'Command failed');

      const hasActions = Array.isArray(json.actions) && json.actions.length > 0;
      if (hasActions) setLastSuggestedActions(json.actions);

      if (hasActions) {
        addMessageForDate(messageDate, {
          role: 'assistant',
          content: json.message ?? '',
          type: 'agentic',
          data: {
            message: json.message,
            actions: json.actions,
            autoApply: json.autoApply ?? false,
            applied: json.applied ?? false,
            appliedCount: json.appliedCount ?? 0,
          },
        });
        if (json.applied) {
          clearLastSuggestedActions();
          triggerDispatchRefetch();
        }
      } else if (json.type === 'scenario' && json.result) {
        const result = json.result as ScenarioResult;
        addMessageForDate(messageDate, {
          role: 'assistant',
          content: result.recommendation ?? 'Scenario analysis',
          type: 'scenario',
          data: result,
        });
      } else if (json.type === 'update' && json.result) {
        const msg = json.result?.message ?? 'Done';
        addMessageForDate(messageDate, {
          role: 'assistant',
          content: msg,
          type: 'update',
          data: json.result,
        });
        triggerDispatchRefetch();
      } else {
        const display = json.message ?? json.result?.answer ?? json.result ?? '';
        addMessageForDate(messageDate, {
          role: 'assistant',
          content: display ? String(display) : 'No response.',
          type: 'query',
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Command failed';
      const isApiLimit = errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('credit');
      const isParseError = errMsg.includes('parse') || errMsg.includes('intent');

      let userMessage: string;
      if (isApiLimit) {
        userMessage = '⚠️ AI is temporarily unavailable (rate limit). Try again in a moment, or use manual controls.';
      } else if (isParseError) {
        userMessage = "⚠️ I didn't understand that. Try something like: \"assign truck 7 to the BK job\" or \"swap Ray's driver\".";
      } else {
        userMessage = `⚠️ Something went wrong: ${errMsg}. Try again or use manual controls.`;
      }

      addMessageForDate(messageDate, {
        role: 'assistant',
        content: userMessage,
        type: 'text',
      });
    } finally {
      setLoading(false);
      loadingForDateRef.current = null;
    }
  };

  const handleApplyAll = async () => {
    await sendMessage('apply');
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

  const dismissAgenticActions = (index: number) => {
    useCommandCenterStore.setState((s) => ({
      sidebarMessages: s.sidebarMessages.map((m, i) =>
        i === index && m.type === 'agentic' ? { ...m, type: 'query' as const, data: undefined } : m
      ),
    }));
    clearLastSuggestedActions();
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
    <div className="h-full w-full min-w-0 flex flex-col overflow-hidden border-l border-border bg-surface-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <h3 className="text-sm font-semibold text-text-0 truncate min-w-0">Dispatch AI</h3>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded text-text-3 hover:text-amber hover:bg-surface-2 transition-colors flex-shrink-0"
          aria-label="Minimize sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-3 flex flex-col justify-start"
      >
        {sidebarMessages.length === 0 && !loading && (
          <p className="text-text-3 text-sm py-4 break-words">Ask about today’s schedule, mark jobs complete, or run a scenario.</p>
        )}
        {sidebarMessages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end min-w-0">
                <div className="max-w-[85%] min-w-0 px-3 py-2 rounded-lg rounded-tr-sm bg-amber/20 text-amber border border-amber/30 text-sm break-words">
                  {msg.content}
                </div>
              </div>
            );
          }
          if (msg.type === 'agentic' && msg.data) {
            const { message, actions, autoApply, applied, appliedCount } = msg.data as {
              message: string;
              actions: VoiceCommandActionItem[];
              autoApply: boolean;
              applied: boolean;
              appliedCount: number;
            };
            return (
              <div key={i} className="flex justify-start min-w-0">
                <div className="max-w-[95%] w-full min-w-0 space-y-2">
                  <div className="px-3 py-2 rounded-lg rounded-tl-sm bg-surface-2 text-text-1 border border-border text-sm break-words">
                    {message}
                  </div>
                  {actions?.length > 0 && (
                    <div className="space-y-1.5">
                      {actions.map((act, ai) => {
                        const Icon = getActionIcon(act.action);
                        return (
                          <div
                            key={ai}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                              applied
                                ? 'bg-success/10 border-success/30 text-success'
                                : 'bg-surface-1 border-border text-text-1'
                            )}
                          >
                            {applied ? (
                              <Check className="h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <Icon className="h-4 w-4 shrink-0 text-amber" />
                            )}
                            <span className="break-words">{getActionLabel(act)}</span>
                          </div>
                        );
                      })}
                      {autoApply && applied ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-success text-sm">
                          <Check className="h-4 w-4" />
                          <span>Applied {appliedCount} changes</span>
                        </div>
                      ) : !autoApply && actions.length > 0 ? (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="w-full bg-amber text-black hover:bg-amber/90"
                            onClick={handleApplyAll}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply All'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="border-border text-text-2"
                            onClick={() => dismissAgenticActions(i)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          if (msg.type === 'scenario' && msg.data) {
            const result = msg.data as ScenarioResult;
            return (
              <div key={i} className="flex justify-start min-w-0">
                <div className="max-w-[95%] w-full min-w-0">
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
              <div key={i} className="flex justify-start min-w-0">
                <div className="max-w-[85%] min-w-0 px-3 py-2 rounded-lg rounded-tl-sm bg-success/20 text-success border border-success/30 text-sm break-words">
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start min-w-0">
              <div className="max-w-[85%] min-w-0 px-3 py-2 rounded-lg rounded-tl-sm bg-surface-2 text-text-1 border border-border text-sm break-words">
                {msg.content}
              </div>
            </div>
          );
        })}
        {loading && loadingForDateRef.current === selectedDate && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border flex-shrink-0 flex gap-2 min-w-0">
        <Input
          value={input}
          onChange={(e) => {
            const val = e.target.value;
            setInput(val);
            // Lock date when typing starts
            if (val && !typingStartDateRef.current) {
              typingStartDateRef.current = selectedDate;
            }
            // Clear lock when input emptied
            if (!val) {
              typingStartDateRef.current = null;
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type a command..."
          className="h-9 bg-surface-2 border-border text-text-0 text-sm placeholder:text-text-3 flex-1 min-w-0"
          disabled={isCurrentDateLoading}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 bg-amber text-black hover:bg-amber/90"
          onClick={() => sendMessage()}
          disabled={isCurrentDateLoading || !input.trim()}
        >
          {isCurrentDateLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
