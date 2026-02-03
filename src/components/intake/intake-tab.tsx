'use client';

import { useState, useCallback } from 'react';
import { useIntake } from '@/hooks';
import { IntakeCard } from './intake-card';
import { PreviewSummary } from './preview-summary';
import type { IntakeItem, IntakeStatus } from '@/types';
import { INTAKE_STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'PENDING', label: INTAKE_STATUS_LABELS.PENDING },
  { id: 'NEEDS_REVIEW', label: INTAKE_STATUS_LABELS.NEEDS_REVIEW },
  { id: 'FLAGGED', label: INTAKE_STATUS_LABELS.FLAGGED },
  { id: 'ON_HOLD', label: INTAKE_STATUS_LABELS.ON_HOLD },
  { id: 'APPROVED', label: INTAKE_STATUS_LABELS.APPROVED },
  { id: 'DECLINED', label: INTAKE_STATUS_LABELS.DECLINED },
];

export function IntakeTab() {
  const { data: itemsData, refetch } = useIntake();
  const items = itemsData ?? [];
  const [filter, setFilter] = useState<string>('all');
  const [fieldUpdates, setFieldUpdates] = useState<Record<string, Partial<IntakeItem>>>({});

  const filtered =
    filter === 'all'
      ? items
      : items.filter((i) => i.status === filter);

  const handleStatusChange = useCallback((_id: string, _status: IntakeStatus) => {
    refetch();
  }, [refetch]);

  const handleFieldChange = useCallback(
    (id: string, field: string, value: string | null) => {
      setFieldUpdates((prev) => ({
        ...prev,
        [id]: { ...prev[id], [field]: value },
      }));
    },
    []
  );

  return (
    <div className="flex flex-col gap-4 relative">
      <PreviewSummary />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-amber/15 text-amber'
                : 'bg-surface-2 text-text-2 hover:text-text-0 hover:bg-surface-3'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-text-3 text-sm">
            No intake items
            {filter !== 'all' ? ` for ${FILTERS.find((f) => f.id === filter)?.label}` : ''}.
          </div>
        ) : (
          filtered.map((item) => (
            <IntakeCard
              key={item.id}
              item={{
                ...item,
                ...fieldUpdates[item.id],
              } as IntakeItem}
              allIntakeItems={items}
              onStatusChange={handleStatusChange}
              onFieldChange={handleFieldChange}
              refetch={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
}
