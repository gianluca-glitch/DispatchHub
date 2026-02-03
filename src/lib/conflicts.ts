// DispatchHub — Conflict Detection Engine
// Checks for scheduling conflicts across the ENTIRE schedule
// Runs on every edit, every approval, every assignment change

import { db } from '@/lib/db';
import type { Conflict } from '@/types';

interface ConflictCheckInput {
  jobId: string;
  date: Date;
  time?: string;
  truckId?: string | null;
  driverId?: string | null;
  workerIds?: string[];
  projectId?: string | null;
}

export async function detectConflicts(input: ConflictCheckInput): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const { jobId, date, time, truckId, driverId, workerIds = [], projectId } = input;

  // 1. TRUCK DOUBLE-BOOK
  // Same truck assigned to another job on the same date
  if (truckId) {
    const truckConflicts = await db.cartingJob.findMany({
      where: {
        id: { not: jobId },
        truckId,
        date,
        status: { notIn: ['CANCELLED'] },
      },
      select: { id: true, customer: true, time: true, address: true },
    });

    for (const conflict of truckConflicts) {
      const truck = await db.truck.findUnique({ where: { id: truckId }, select: { name: true } });
      conflicts.push({
        type: 'TRUCK_DOUBLE_BOOK',
        severity: time === conflict.time ? 'CRITICAL' : 'WARNING',
        message: `${truck?.name ?? 'Truck'} is also assigned to ${conflict.customer} at ${conflict.time} (${conflict.address})`,
        affectedJobId: conflict.id,
        affectedTruckId: truckId,
      });
    }
  }

  // 2. DRIVER DOUBLE-BOOK
  // Same driver assigned to another job at overlapping time
  if (driverId) {
    const driverConflicts = await db.cartingJob.findMany({
      where: {
        id: { not: jobId },
        driverId,
        date,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      select: { id: true, customer: true, time: true },
    });

    if (driverConflicts.length > 0) {
      const driver = await db.worker.findUnique({ where: { id: driverId }, select: { name: true } });
      for (const conflict of driverConflicts) {
        conflicts.push({
          type: 'DRIVER_DOUBLE_BOOK',
          severity: time === conflict.time ? 'CRITICAL' : 'WARNING',
          message: `${driver?.name ?? 'Driver'} is also assigned to ${conflict.customer} at ${conflict.time}`,
          affectedJobId: conflict.id,
          affectedWorkerId: driverId,
        });
      }
    }
  }

  // 3. WORKER OUT-SICK
  // Any assigned worker flagged as out-sick
  const allWorkerIds = driverId ? [driverId, ...workerIds] : workerIds;
  if (allWorkerIds.length > 0) {
    const sickWorkers = await db.worker.findMany({
      where: {
        id: { in: allWorkerIds },
        status: 'OUT_SICK',
      },
      select: { id: true, name: true },
    });

    for (const sick of sickWorkers) {
      conflicts.push({
        type: 'WORKER_OUT_SICK',
        severity: 'CRITICAL',
        message: `${sick.name} is flagged OUT SICK today`,
        affectedWorkerId: sick.id,
      });
    }
  }

  // 4. PROJECT RESOURCE LOCK
  // Assigning a truck/worker that's locked to an active demo project
  if (truckId) {
    const lockedProjects = await db.projectTruck.findMany({
      where: {
        truckId,
        project: {
          phase: { in: ['ACTIVE_DEMO', 'CARTING'] },
          id: projectId ? { not: projectId } : undefined,
        },
      },
      include: { project: { select: { name: true } } },
    });

    for (const lock of lockedProjects) {
      conflicts.push({
        type: 'PROJECT_RESOURCE_LOCK',
        severity: 'WARNING',
        message: `Truck is assigned to active project: ${lock.project.name}`,
        affectedTruckId: truckId,
      });
    }
  }

  return conflicts;
}

// Quick check for the inline editor — lightweight version
export async function quickConflictCheck(
  jobId: string,
  field: string,
  newValue: string,
  date: Date
): Promise<Conflict[]> {
  if (field === 'truckId') {
    return detectConflicts({ jobId, date, truckId: newValue });
  }
  if (field === 'driverId') {
    return detectConflicts({ jobId, date, driverId: newValue });
  }
  return [];
}
