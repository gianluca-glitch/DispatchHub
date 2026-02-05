'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { JOB_TYPE_LABELS, type JobType } from '@/types';
import { cn } from '@/lib/utils';

const JOB_TYPES: JobType[] = ['PICKUP', 'DROP_OFF', 'DUMP_OUT'];

export interface ParsedFieldsProps {
  item: {
    parsedCustomer: string | null;
    parsedPhone: string | null;
    parsedEmail: string | null;
    parsedServiceType: string | null;
    parsedAddress: string | null;
    parsedDate: string | null;
    parsedTime: string | null;
    parsedContainerSize: string | null;
    parsedNotes: string | null;
  };
  confidence: number;
  editMode: boolean;
  onFieldChange: (field: string, value: string | null) => void;
}

const LOW_CONFIDENCE = 70;

function Field({
  label,
  value,
  displayValue,
  lowConfidence,
  editMode,
  children,
}: {
  label: string;
  value: string | null;
  displayValue?: string | null;
  lowConfidence?: boolean;
  editMode: boolean;
  children: React.ReactNode;
}) {
  const shown = displayValue !== undefined ? displayValue : value;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-3 text-xs font-medium">{label}</span>
      {editMode ? (
        children
      ) : (
        <span
          className={cn(
            'text-sm font-mono text-text-1 py-1',
            lowConfidence && 'bg-amber/10 border border-amber/30 rounded px-2'
          )}
        >
          {shown ?? '—'}
        </span>
      )}
    </div>
  );
}

export function ParsedFields({
  item,
  confidence,
  editMode,
  onFieldChange,
}: ParsedFieldsProps) {
  const lowConfidence = confidence < LOW_CONFIDENCE;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <Field
        label="Customer"
        value={item.parsedCustomer}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono"
          defaultValue={item.parsedCustomer ?? ''}
          onBlur={(e) => onFieldChange('parsedCustomer', e.target.value.trim() || null)}
        />
      </Field>
      <Field
        label="Phone"
        value={item.parsedPhone}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono"
          defaultValue={item.parsedPhone ?? ''}
          onBlur={(e) => onFieldChange('parsedPhone', e.target.value.trim() || null)}
        />
      </Field>
      <Field
        label="Email"
        value={item.parsedEmail}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono"
          defaultValue={item.parsedEmail ?? ''}
          onBlur={(e) => onFieldChange('parsedEmail', e.target.value.trim() || null)}
        />
      </Field>
      <Field
        label="Service type"
        value={item.parsedServiceType}
        displayValue={
          item.parsedServiceType
            ? JOB_TYPE_LABELS[item.parsedServiceType as JobType] ?? item.parsedServiceType
            : null
        }
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Select
          value={item.parsedServiceType ?? '__none__'}
          onValueChange={(v) => onFieldChange('parsedServiceType', v === '__none__' ? null : v)}
        >
          <SelectTrigger className="h-9 bg-surface-1 font-mono">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {JOB_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Address"
        value={item.parsedAddress}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono sm:col-span-2"
          defaultValue={item.parsedAddress ?? ''}
          onBlur={(e) => onFieldChange('parsedAddress', e.target.value.trim() || null)}
        />
      </Field>
      <Field
        label="Date"
        value={item.parsedDate}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          type="date"
          className="h-9 bg-surface-1 font-mono"
          defaultValue={item.parsedDate ?? ''}
          onBlur={(e) => onFieldChange('parsedDate', e.target.value.trim() || null)}
        />
      </Field>
      <Field
        label="Time"
        value={item.parsedTime}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono w-24"
          defaultValue={item.parsedTime ?? ''}
          placeholder="HH:MM"
          onBlur={(e) => onFieldChange('parsedTime', e.target.value.trim() || null)}
        />
      </Field>
      <Field
        label="Container size"
        value={item.parsedContainerSize}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono w-24"
          defaultValue={item.parsedContainerSize ?? ''}
          placeholder="20yd"
          onBlur={(e) =>
            onFieldChange('parsedContainerSize', e.target.value.trim() || null)
          }
        />
      </Field>
      <Field
        label="Notes"
        value={item.parsedNotes}
        lowConfidence={lowConfidence}
        editMode={editMode}
      >
        <Input
          className="h-9 bg-surface-1 font-mono sm:col-span-2"
          defaultValue={item.parsedNotes ?? ''}
          onBlur={(e) => onFieldChange('parsedNotes', e.target.value.trim() || null)}
        />
      </Field>
    </div>
  );
}
