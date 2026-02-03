'use client';

import { usePreviewStore } from '@/stores';
import { useIntake, useTrucks, useWorkers } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

function EfficiencyCircle({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const deg = pct * 360;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-6 h-6 shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, #2b2f3a ${deg}deg)`,
        }}
      />
      <div className="absolute inset-[2px] rounded-full bg-surface-0 flex items-center justify-center">
        <span className="text-[10px] font-mono font-bold text-text-0">{Math.round(score)}</span>
      </div>
    </div>
  );
}

export function PreviewSummary() {
  const previews = usePreviewStore((s) => s.previews);
  const clearAllPreviews = usePreviewStore((s) => s.clearAllPreviews);
  const { data: intakeItems = [] } = useIntake();
  const { data: trucks = [] } = useTrucks();
  const { data: workers = [] } = useWorkers();
  const [scheduling, setScheduling] = useState(false);

  const ready = Object.values(previews).filter(
    (p) => p.truckId != null && p.driverId != null
  );
  if (ready.length < 2) return null;

  const getCustomer = (intakeItemId: string) =>
    intakeItems?.find((i) => i.id === intakeItemId)?.parsedCustomer ?? '—';
  const getTruckName = (truckId: string) =>
    trucks?.find((t) => t.id === truckId)?.name ?? truckId;
  const getDriverName = (driverId: string) =>
    workers?.find((w) => w.id === driverId)?.name ?? driverId;

  const handleScheduleAll = async () => {
    setScheduling(true);
    try {
      const items = ready.map((p) => ({
        intakeItemId: p.intakeItemId,
        truckId: p.truckId!,
        driverId: p.driverId!,
        workerIds: p.workerIds ?? [],
        timeOverride: p.timeOverride,
        containerSize: p.containerSize ?? undefined,
      }));
      const res = await fetch('/api/intake/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Batch approve failed');
      const { jobIds = [], warnings = [] } = json.data ?? {};
      clearAllPreviews();
      toast.success(`${jobIds.length} jobs created and confirmations sent`);
      if (warnings.length > 0) {
        warnings.forEach((w: string) => toast.warning(w));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch approve failed');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border-2 border-amber/40 bg-surface-0 shadow-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-0">Preview Queue: {ready.length} items ready</span>
      </div>
      <ul className="space-y-2 max-h-48 overflow-y-auto text-sm text-text-2">
        {ready.map((p) => (
          <li key={p.intakeItemId} className="flex items-center gap-2">
            <EfficiencyCircle score={p.analysis?.efficiencyScore ?? 0} />
            <span className="truncate flex-1">{getCustomer(p.intakeItemId)}</span>
            <span className="text-text-3 font-mono text-xs truncate">{getTruckName(p.truckId!)}</span>
            <span className="text-text-3 text-xs truncate">{getDriverName(p.driverId!)}</span>
            <span className="text-text-3 font-mono text-xs">{p.timeOverride ?? '—'}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-500 text-white flex-1"
          onClick={handleScheduleAll}
          disabled={scheduling}
        >
          <Check className="h-3.5 w-3.5" />
          <span className="ml-1">Schedule All</span>
        </Button>
        <Button size="sm" variant="outline" onClick={clearAllPreviews}>
          <X className="h-3.5 w-3.5" />
          <span className="ml-1">Clear All</span>
        </Button>
      </div>
    </div>
  );
}
