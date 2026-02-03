'use client';

import { useState, useCallback } from 'react';
import { Phone, Mail, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { ConfidenceBar } from './confidence-bar';
import { ParsedFields } from './parsed-fields';
import { ApprovalActions } from './approval-actions';
import { AudioPlayer } from './audio-player';
import { INTAKE_STATUS_LABELS, JOB_TYPE_LABELS, type IntakeItem, type IntakeStatus, type JobType } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useUiStore, useDispatchStore } from '@/stores';

const SOURCE_ICON = {
  PHONE: Phone,
  EMAIL: Mail,
  FORM: FileText,
};

const STATUS_PILL: Record<IntakeStatus, string> = {
  PENDING: 'bg-success/20 text-success',
  NEEDS_REVIEW: 'bg-amber/20 text-amber',
  FLAGGED: 'bg-danger/20 text-danger',
  APPROVED: 'bg-success/20 text-success',
  DECLINED: 'bg-text-3 text-text-2',
  ON_HOLD: 'bg-amber/20 text-amber',
};

export interface IntakeCardProps {
  item: IntakeItem;
  onStatusChange: (id: string, status: IntakeStatus) => void;
  onFieldChange: (id: string, field: string, value: string | null) => void;
  onApproved?: (jobId: string) => void;
  refetch: () => void;
}

export function IntakeCard({
  item,
  onStatusChange,
  onFieldChange,
  onApproved,
  refetch,
}: IntakeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const setSelectedJobId = useDispatchStore((s) => s.setSelectedJobId);
  const setSelectedDate = useDispatchStore((s) => s.setSelectedDate);

  const SourceIcon = SOURCE_ICON[item.source];

  const handleApprove = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intake/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeItemId: item.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Approve failed');
      const job = json.data;
      toast.success('Job created + confirmations sent', {
        action: {
          label: 'Open job',
          onClick: () => {
            setSelectedDate(job.date?.slice?.(0, 10) ?? new Date().toISOString().slice(0, 10));
            setSelectedJobId(job.id);
            setActiveTab('dispatch');
          },
        },
      });
      onApproved?.(job.id);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setLoading(false);
    }
  }, [item.id, onApproved, refetch, setActiveTab, setSelectedJobId, setSelectedDate]);

  const handleDecline = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/intake/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DECLINED' }),
      });
      onStatusChange(item.id, 'DECLINED');
      refetch();
    } finally {
      setLoading(false);
    }
  }, [item.id, onStatusChange, refetch]);

  const handleHold = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/intake/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ON_HOLD' }),
      });
      onStatusChange(item.id, 'ON_HOLD');
      refetch();
    } finally {
      setLoading(false);
    }
  }, [item.id, onStatusChange, refetch]);

  const handleFlag = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/intake/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FLAGGED' }),
      });
      onStatusChange(item.id, 'FLAGGED');
      refetch();
    } finally {
      setLoading(false);
    }
  }, [item.id, onStatusChange, refetch]);

  const handleFieldChange = useCallback(
    (field: string, value: string | null) => {
      onFieldChange(item.id, field, value);
      fetch(`/api/intake/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      }).then(() => refetch());
    },
    [item.id, onFieldChange, refetch]
  );

  const receivedAt = item.receivedAt
    ? new Date(item.receivedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="border border-border rounded bg-surface-0 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-1 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-2 text-text-2">
          <SourceIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-text-0 truncate">
              {item.parsedCustomer ?? 'Unknown'}
            </span>
            <span className="text-text-3 text-xs font-mono">{receivedAt}</span>
          </div>
          <p className="text-sm text-text-2 truncate mt-0.5">
            {item.parsedAddress ?? item.rawContent.slice(0, 60)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.parsedServiceType && (
            <span className="text-xs px-2 py-0.5 rounded bg-info/20 text-info border border-info/40">
              {JOB_TYPE_LABELS[item.parsedServiceType as JobType]}
            </span>
          )}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded',
              STATUS_PILL[item.status as IntakeStatus]
            )}
          >
            {INTAKE_STATUS_LABELS[item.status as IntakeStatus]}
          </span>
        </div>
        <div className="w-20 shrink-0">
          <ConfidenceBar value={item.confidence} />
          <span className="text-[10px] text-text-3 font-mono mt-0.5">
            {Math.round(item.confidence)}%
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-text-3" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-3" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-surface-0">
          {item.source === 'PHONE' && item.audioUrl && (
            <AudioPlayer audioUrl={item.audioUrl} />
          )}
          <ParsedFields
            item={item}
            confidence={item.confidence}
            editMode={editMode}
            onFieldChange={handleFieldChange}
          />
          <ApprovalActions
            status={item.status}
            editMode={editMode}
            onApprove={handleApprove}
            onDecline={handleDecline}
            onHold={handleHold}
            onEdit={() => setEditMode(!editMode)}
            onFlag={handleFlag}
            loading={loading}
          />
          <div className="pt-2 border-t border-border">
            <span className="text-text-3 text-xs font-medium">Raw content</span>
            <pre className="mt-1 p-2 rounded bg-surface-1 text-xs text-text-2 font-mono overflow-x-auto max-h-32 overflow-y-auto">
              {item.rawContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
