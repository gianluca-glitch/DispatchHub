'use client';

import { useState } from 'react';
import useSWR from 'swr';

interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  detail: string;
  projectId: string | null;
  project: { id: string; name: string } | null;
  error: string | null;
  createdAt: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  return json.data as LogEntry[];
};

type FilterType = 'all' | 'chat' | 'actions' | 'errors';

const CHAT_ACTIONS = ['chat_message', 'ai_response'];
const ERROR_ACTIONS = ['error'];

const ACTION_COLORS: Record<string, string> = {
  chat_message: 'bg-purple/20 text-purple border-purple/30',
  ai_response: 'bg-purple/20 text-purple border-purple/30',
  create_project: 'bg-success/20 text-success border-success/30',
  update_project: 'bg-amber/20 text-amber border-amber/30',
  add_note: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  assign_worker: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  remove_worker: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  assign_truck: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  remove_truck: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  error: 'bg-danger/20 text-danger border-danger/30',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminLogs() {
  const [filter, setFilter] = useState<FilterType>('all');

  const buildUrl = () => {
    const params = new URLSearchParams({ limit: '200' });
    if (filter === 'chat') params.set('action', 'chat_message');
    if (filter === 'errors') params.set('action', 'error');
    return `/api/admin/logs?${params.toString()}`;
  };

  const { data: logs, isLoading } = useSWR<LogEntry[]>(buildUrl(), fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });

  const filteredLogs = (logs ?? []).filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'chat') return CHAT_ACTIONS.includes(log.action);
    if (filter === 'actions') return !CHAT_ACTIONS.includes(log.action) && !ERROR_ACTIONS.includes(log.action);
    if (filter === 'errors') return log.action === 'error';
    return true;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'chat', label: 'Chat' },
    { key: 'actions', label: 'Actions' },
    { key: 'errors', label: 'Errors' },
  ];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Filter buttons */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap min-h-[44px] transition-colors ${
              filter === f.key
                ? 'bg-amber/15 text-amber'
                : 'bg-surface-1 text-text-2 hover:text-text-0'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log entries */}
      {isLoading && (
        <div className="text-text-3 text-sm text-center py-8">Loading logs...</div>
      )}

      {!isLoading && filteredLogs.length === 0 && (
        <div className="text-text-3 text-sm text-center py-8">No logs found</div>
      )}

      <div className="space-y-2">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className={`rounded-lg border p-3 ${
              log.action === 'error'
                ? 'bg-danger/5 border-danger/20'
                : 'bg-surface-1 border-border'
            }`}
          >
            <div className="flex items-start gap-2 flex-wrap">
              {/* Timestamp */}
              <span className="text-text-3 text-xs font-mono whitespace-nowrap">
                {formatTimestamp(log.createdAt)}
              </span>

              {/* User */}
              <span className="text-text-1 text-xs font-medium">{log.userName}</span>

              {/* Action badge */}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  ACTION_COLORS[log.action] ?? 'bg-surface-2 text-text-2 border-border'
                }`}
              >
                {getActionLabel(log.action)}
              </span>

              {/* Project name */}
              {log.project && (
                <span className="text-text-3 text-xs">
                  [{log.project.name}]
                </span>
              )}
            </div>

            {/* Detail */}
            <p className="text-text-1 text-sm mt-1.5 break-words whitespace-pre-wrap">
              {log.detail.length > 300 ? log.detail.slice(0, 300) + '...' : log.detail}
            </p>

            {/* Error message */}
            {log.error && (
              <p className="text-danger text-xs mt-1 font-mono break-words">
                {log.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
