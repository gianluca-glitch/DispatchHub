import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ApplyChange {
  jobId: string;
  newTruckId?: string;
  newDriverId?: string;
  newWorkerIds?: string[];
  newTime?: string;
  newStatus?: string;
}

// POST /api/dispatch/apply-scenario
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { changes, reason } = body as {
    changes: ApplyChange[];
    reason: string;
  };

  if (!Array.isArray(changes) || !reason?.trim()) {
    return NextResponse.json(
      { error: 'changes (array) and reason (string) required' },
      { status: 400 }
    );
  }

  const updatedIds: string[] = [];

  await db.$transaction(async (tx) => {
    for (const change of changes) {
      const { jobId, newTruckId, newDriverId, newWorkerIds, newTime, newStatus } = change;
      if (!jobId) continue;

      const current = await tx.cartingJob.findUnique({
        where: { id: jobId },
        include: { truck: true, driver: true, workers: true },
      });

      if (!current) continue;

      const updateData: Record<string, unknown> = {};
      const logEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      if (newTruckId !== undefined && newTruckId !== current.truckId) {
        const newTruck = await tx.truck.findUnique({ where: { id: newTruckId }, select: { name: true } });
        updateData.truckId = newTruckId;
        logEntries.push({
          field: 'truckId',
          oldValue: current.truck?.name ?? current.truckId ?? null,
          newValue: newTruck?.name ?? newTruckId,
        });
      }
      if (newDriverId !== undefined && newDriverId !== current.driverId) {
        const newDriver = await tx.worker.findUnique({ where: { id: newDriverId }, select: { name: true } });
        updateData.driverId = newDriverId;
        logEntries.push({
          field: 'driverId',
          oldValue: current.driver?.name ?? current.driverId ?? null,
          newValue: newDriver?.name ?? newDriverId,
        });
      }
      if (newTime !== undefined && newTime !== current.time) {
        updateData.time = newTime;
        logEntries.push({ field: 'time', oldValue: current.time, newValue: newTime });
      }
      if (newStatus !== undefined && newStatus !== current.status) {
        updateData.status = newStatus;
        logEntries.push({ field: 'status', oldValue: current.status, newValue: newStatus });
      }

      if (Object.keys(updateData).length > 0) {
        await tx.cartingJob.update({
          where: { id: jobId },
          data: updateData,
        });
      }

      if (newWorkerIds !== undefined) {
        const currentWorkerIds = current.workers.map((w) => w.workerId).sort();
        const nextIds = [...new Set(newWorkerIds)].sort();
        const same =
          currentWorkerIds.length === nextIds.length &&
          currentWorkerIds.every((id, i) => id === nextIds[i]);
        if (!same) {
          await tx.jobWorker.deleteMany({ where: { jobId } });
          for (const workerId of nextIds) {
            await tx.jobWorker.create({
              data: { jobId, workerId },
            });
          }
          logEntries.push({
            field: 'workerIds',
            oldValue: currentWorkerIds.length ? currentWorkerIds.join(',') : null,
            newValue: nextIds.length ? nextIds.join(',') : null,
          });
        }
      }

      for (const entry of logEntries) {
        await tx.changeLog.create({
          data: {
            entityType: 'job',
            entityId: jobId,
            entityName: current.customer,
            field: entry.field,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            jobId,
            userName: 'Dispatcher',
          },
        });
      }

      if (logEntries.length > 0) {
        await tx.changeLog.create({
          data: {
            entityType: 'job',
            entityId: jobId,
            entityName: current.customer,
            field: 'scenario_reason',
            oldValue: null,
            newValue: reason,
            jobId,
            userName: 'Dispatcher',
          },
        });
        updatedIds.push(jobId);
      }
    }
  });

  return NextResponse.json({ data: { updatedIds } });
}
