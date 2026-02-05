import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseVoiceIntent } from '@/lib/ai/claude';
import type { VoiceCommandActionItem } from '@/types';

interface JobContextBody {
  id?: string;
  customer?: string;
  address?: string;
  truckId?: string;
  truckName?: string;
  driverId?: string;
  driverName?: string;
}

// POST /api/dispatch/voice-command
// Body: { text, date?, conversationHistory?: Array<{role, content}>, jobContext?: JobContextBody }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = (body.text as string)?.trim();
  const dateParam = (body.date as string) ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateParam + 'T12:00:00');
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const conversationHistory = (body.conversationHistory as { role: string; content: string }[]) ?? [];
  const jobContext = body.jobContext as JobContextBody | null | undefined;

  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  const [jobs, trucks, workers] = await Promise.all([
    db.cartingJob.findMany({
      where: { date: dateOnly, status: { notIn: ['CANCELLED'] } },
      include: {
        truck: true,
        driver: true,
        workers: { include: { worker: true } },
      },
      orderBy: { time: 'asc' },
    }),
    db.truck.findMany(),
    db.worker.findMany(),
  ]);

  // Compact pipe-delimited schedule for AI (jobId, time, customer 30chars, borough, truck, driver, status only)
  const header = 'ID|Time|Customer|Borough|Truck|Driver|Status';
  const jobLines = jobs.map((j) =>
    [
      j.id,
      j.time,
      (j.customer ?? '').slice(0, 30),
      j.borough,
      j.truck?.name ?? '—',
      j.driver?.name ?? '—',
      j.status,
    ].join('|')
  );
  const scheduleContext =
    header +
    '\n' +
    jobLines.join('\n') +
    '\nTrucks: ' +
    trucks.map((t) => `${t.name} (id=${t.id})`).join(', ') +
    '\nWorkers: ' +
    workers.map((w) => `${w.name} (id=${w.id})`).join(', ') +
    (jobContext && (jobContext.id || jobContext.customer)
      ? '\nFOCUS JOB: id=' +
        (jobContext.id ?? '?') +
        ' customer=' +
        (jobContext.customer ?? '?').slice(0, 30) +
        ' truck=' +
        (jobContext.truckName ?? jobContext.truckId ?? '?') +
        ' driver=' +
        (jobContext.driverName ?? jobContext.driverId ?? '?')
      : '');

  let parsed: {
    type: 'update' | 'scenario' | 'query';
    message: string;
    actions: VoiceCommandActionItem[];
    autoApply: boolean;
  };
  try {
    parsed = await parseVoiceIntent(text, scheduleContext, conversationHistory);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to parse intent';
    const status =
      message.includes('API key') ? 401 :
      message.includes('Rate limit') ? 429 :
      message.includes('overloaded') || message.includes('unavailable') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const resolveTruckId = (idOrName: string | undefined): string | null => {
    if (!idOrName) return null;
    const t = trucks.find((x) => x.id === idOrName || x.name.toLowerCase().includes(idOrName.toLowerCase()));
    return t?.id ?? null;
  };
  const resolveDriverId = (idOrName: string | undefined): string | null => {
    if (!idOrName) return null;
    const w = workers.find((x) => x.id === idOrName || x.name.toLowerCase().includes(idOrName.toLowerCase()));
    return w?.id ?? null;
  };

  let appliedCount = 0;
  if (parsed.autoApply && parsed.actions?.length) {
    for (const act of parsed.actions) {
      const job = jobs.find((j) => j.id === act.jobId);
      if (!job) continue;

      try {
        if (act.action === 'assign_driver') {
          const driverId = act.params?.driverId ?? resolveDriverId(act.params?.driverName);
          if (driverId) {
            await db.cartingJob.update({
              where: { id: act.jobId },
              data: { driverId },
            });
            appliedCount++;
          }
        } else if (act.action === 'assign_truck') {
          const truckId = act.params?.truckId ?? resolveTruckId(act.params?.truckName);
          if (truckId) {
            await db.cartingJob.update({
              where: { id: act.jobId },
              data: { truckId },
            });
            appliedCount++;
          }
        } else if (act.action === 'mark_complete') {
          await db.cartingJob.update({
            where: { id: act.jobId },
            data: { status: 'COMPLETED' },
          });
          appliedCount++;
        } else if (act.action === 'mark_delayed') {
          await db.cartingJob.update({
            where: { id: act.jobId },
            data: { status: 'DELAYED' },
          });
          appliedCount++;
        } else if (act.action === 'swap_truck') {
          const newTruckId = act.params?.newTruckId ?? resolveTruckId(act.params?.newTruckName);
          if (newTruckId) {
            await db.cartingJob.update({
              where: { id: act.jobId },
              data: { truckId: newTruckId },
            });
            appliedCount++;
          }
        } else if (act.action === 'swap_driver') {
          const newDriverId = act.params?.newDriverId ?? resolveDriverId(act.params?.newDriverName);
          if (newDriverId) {
            await db.cartingJob.update({
              where: { id: act.jobId },
              data: { driverId: newDriverId },
            });
            appliedCount++;
          }
        } else if (act.action === 'reschedule') {
          const newDate = act.params?.newDate;
          const newTime = act.params?.newTime;
          if (newDate) {
            const updateData: { date: Date; time?: string } = {
              date: new Date(newDate + 'T12:00:00'),
            };
            if (newTime) updateData.time = newTime;
            await db.cartingJob.update({
              where: { id: act.jobId },
              data: updateData,
            });
            appliedCount++;
          }
        }
      } catch (_) {
        // Skip failed action, continue with others
      }
    }
  }

  return NextResponse.json({
    type: parsed.type,
    message: parsed.message,
    actions: parsed.actions ?? [],
    autoApply: parsed.autoApply,
    applied: appliedCount > 0,
    appliedCount,
  });
}
