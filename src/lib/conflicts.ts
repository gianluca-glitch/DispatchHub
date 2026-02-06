// DispatchHub — Conflict Detection Engine
// Checks for scheduling conflicts across the ENTIRE schedule
// Runs on every edit, every approval, every assignment change

import { db } from '@/lib/db';
import { formatTime } from '@/lib/utils';
import type { Conflict } from '@/types';

export interface TentativeJob {
  jobId: string;
  truckId: string | null;
  driverId: string | null;
  time: string;
  customer?: string;
}

interface ConflictCheckInput {
  jobId: string;
  date: Date;
  time?: string;
  truckId?: string | null;
  driverId?: string | null;
  workerIds?: string[];
  projectId?: string | null;
  /** When checking preview assignments, pass other intake previews as tentatively booked */
  tentativeJobs?: TentativeJob[];
}

// ── Estimated job durations in minutes ──
const DURATION: Record<string, number> = {
  DUMP_OUT: 45,
  PICKUP: 30,
  DROP_OFF: 30,
};
const DEFAULT_DURATION = 30;

/** Parse "HH:MM" to minutes since midnight. Returns NaN for invalid input. */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

/**
 * Check if two job time windows actually overlap.
 * Conservative: returns true if either time is missing/invalid (can't prove they don't overlap).
 */
function timesOverlap(
  timeA: string | null | undefined,
  typeA: string | null | undefined,
  timeB: string | null | undefined,
  typeB: string | null | undefined,
): boolean {
  if (!timeA || !timeB) return true;
  const startA = parseTimeToMinutes(timeA);
  const startB = parseTimeToMinutes(timeB);
  if (isNaN(startA) || isNaN(startB)) return true;

  const endA = startA + (DURATION[typeA ?? ''] ?? DEFAULT_DURATION);
  const endB = startB + (DURATION[typeB ?? ''] ?? DEFAULT_DURATION);

  return startA < endB && startB < endA;
}

export async function detectConflicts(input: ConflictCheckInput): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const { jobId, date, time, truckId, driverId, workerIds = [], projectId, tentativeJobs = [] } = input;

  // Fetch the current job's type so we can compute time overlap.
  // Run in parallel with truck name lookup to fix the N+1 query.
  const [currentJob, truck] = await Promise.all([
    db.cartingJob.findUnique({ where: { id: jobId }, select: { type: true } }),
    truckId ? db.truck.findUnique({ where: { id: truckId }, select: { name: true } }) : null,
  ]);
  const currentType = currentJob?.type ?? null;
  const truckName = truck?.name ?? 'Truck';

  // 1. TRUCK DOUBLE-BOOK (DB jobs + tentative)
  if (truckId) {
    const truckConflicts = await db.cartingJob.findMany({
      where: {
        id: { not: jobId },
        truckId,
        date,
        status: { notIn: ['CANCELLED'] },
      },
      select: { id: true, customer: true, time: true, address: true, type: true },
    });

    for (const conflict of truckConflicts) {
      if (!timesOverlap(time, currentType, conflict.time, conflict.type)) continue;
      conflicts.push({
        type: 'TRUCK_DOUBLE_BOOK',
        severity: time === conflict.time ? 'CRITICAL' : 'WARNING',
        message: `${truckName} is also assigned to ${conflict.customer} at ${formatTime(conflict.time)} (${conflict.address})`,
        affectedJobId: conflict.id,
        affectedTruckId: truckId,
      });
    }

    for (const t of tentativeJobs) {
      if (t.jobId === jobId || !t.truckId) continue;
      if (t.truckId === truckId) {
        if (!timesOverlap(time, currentType, t.time, null)) continue;
        conflicts.push({
          type: 'TRUCK_DOUBLE_BOOK',
          severity: time === t.time ? 'CRITICAL' : 'WARNING',
          message: `${truckName} is tentatively assigned to ${t.customer ?? 'another intake'} at ${formatTime(t.time)}`,
          affectedJobId: t.jobId,
          affectedTruckId: truckId,
        });
      }
    }
  }

  // 2. DRIVER DOUBLE-BOOK (DB jobs + tentative)
  if (driverId) {
    const driverConflicts = await db.cartingJob.findMany({
      where: {
        id: { not: jobId },
        driverId,
        date,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      select: { id: true, customer: true, time: true, type: true },
    });

    const driver = await db.worker.findUnique({ where: { id: driverId }, select: { name: true } });
    for (const conflict of driverConflicts) {
      if (!timesOverlap(time, currentType, conflict.time, conflict.type)) continue;
      conflicts.push({
        type: 'DRIVER_DOUBLE_BOOK',
        severity: time === conflict.time ? 'CRITICAL' : 'WARNING',
        message: `${driver?.name ?? 'Driver'} is also assigned to ${conflict.customer} at ${formatTime(conflict.time)}`,
        affectedJobId: conflict.id,
        affectedWorkerId: driverId,
      });
    }

    for (const t of tentativeJobs) {
      if (t.jobId === jobId || !t.driverId) continue;
      if (t.driverId === driverId) {
        if (!timesOverlap(time, currentType, t.time, null)) continue;
        conflicts.push({
          type: 'DRIVER_DOUBLE_BOOK',
          severity: time === t.time ? 'CRITICAL' : 'WARNING',
          message: `${driver?.name ?? 'Driver'} is tentatively assigned to ${t.customer ?? 'another intake'} at ${formatTime(t.time)}`,
          affectedJobId: t.jobId,
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

/** Batched schedule-wide conflict detection. Max 4 DB queries, rest in memory. */
export async function detectAllConflictsForDate(date: Date): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();
  const dedupe = (c: Conflict) => {
    const key = `${c.type}:${c.affectedJobId ?? ''}:${c.affectedTruckId ?? ''}:${c.affectedWorkerId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    conflicts.push(c);
  };

  // Query 1: All active jobs for the date with truck and driver relations
  const jobs = await db.cartingJob.findMany({
    where: { date, status: { notIn: ['CANCELLED'] } },
    include: {
      truck: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true } },
    },
  });

  // Query 2: All workers with OUT_SICK status
  const sickWorkers = await db.worker.findMany({
    where: { status: 'OUT_SICK' },
    select: { id: true, name: true },
  });
  const sickIds = new Set(sickWorkers.map((w) => w.id));
  const sickByName = new Map(sickWorkers.map((w) => [w.id, w.name]));

  // Query 3: All active project truck locks (project phase ACTIVE_DEMO or CARTING)
  const projectLocks = await db.projectTruck.findMany({
    where: { project: { phase: { in: ['ACTIVE_DEMO', 'CARTING'] } } },
    include: { project: { select: { id: true, name: true } } },
  });
  // truckId -> { projectId, projectName } (if truck locked to a project)
  const truckToLock = new Map<string, { projectId: string; projectName: string }>();
  for (const lock of projectLocks) {
    truckToLock.set(lock.truckId, { projectId: lock.projectId, projectName: lock.project.name });
  }

  // ── In-memory: truck double-books (group by truckId, skip unassigned) ──
  const byTruck = new Map<string, typeof jobs>();
  for (const job of jobs) {
    if (!job.truckId) continue;
    if (!byTruck.has(job.truckId)) byTruck.set(job.truckId, []);
    byTruck.get(job.truckId)!.push(job);
  }
  for (const [truckId, group] of byTruck) {
    if (group.length < 2) continue;
    const truckName = group[0].truck?.name ?? 'Truck';
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (!timesOverlap(a.time, a.type, b.time, b.type)) continue;
        const severity = a.time === b.time ? 'CRITICAL' : 'WARNING';
        dedupe({
          type: 'TRUCK_DOUBLE_BOOK',
          severity,
          message: `${truckName} is also assigned to ${b.customer} at ${formatTime(b.time)} (${b.address})`,
          affectedJobId: b.id,
          affectedTruckId: truckId,
        });
        dedupe({
          type: 'TRUCK_DOUBLE_BOOK',
          severity,
          message: `${truckName} is also assigned to ${a.customer} at ${formatTime(a.time)} (${a.address})`,
          affectedJobId: a.id,
          affectedTruckId: truckId,
        });
      }
    }
  }

  // ── In-memory: driver double-books (group by driverId, skip unassigned, exclude COMPLETED) ──
  const activeJobs = jobs.filter((j) => j.status !== 'COMPLETED');
  const byDriver = new Map<string, typeof activeJobs>();
  for (const job of activeJobs) {
    if (!job.driverId) continue;
    if (!byDriver.has(job.driverId)) byDriver.set(job.driverId, []);
    byDriver.get(job.driverId)!.push(job);
  }
  for (const [driverId, group] of byDriver) {
    if (group.length < 2) continue;
    const driverName = group[0].driver?.name ?? 'Driver';
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (!timesOverlap(a.time, a.type, b.time, b.type)) continue;
        const severity = a.time === b.time ? 'CRITICAL' : 'WARNING';
        dedupe({
          type: 'DRIVER_DOUBLE_BOOK',
          severity,
          message: `${driverName} is also assigned to ${b.customer} at ${formatTime(b.time)}`,
          affectedJobId: b.id,
          affectedWorkerId: driverId,
        });
        dedupe({
          type: 'DRIVER_DOUBLE_BOOK',
          severity,
          message: `${driverName} is also assigned to ${a.customer} at ${formatTime(a.time)}`,
          affectedJobId: a.id,
          affectedWorkerId: driverId,
        });
      }
    }
  }

  // ── In-memory: worker out-sick ──
  for (const job of jobs) {
    if (!job.driverId || !sickIds.has(job.driverId)) continue;
    const name = sickByName.get(job.driverId) ?? 'Worker';
    dedupe({
      type: 'WORKER_OUT_SICK',
      severity: 'CRITICAL',
      message: `${name} is flagged OUT SICK today`,
      affectedJobId: job.id,
      affectedWorkerId: job.driverId,
    });
  }

  // ── In-memory: project resource lock ──
  for (const job of jobs) {
    if (!job.truckId) continue;
    const lock = truckToLock.get(job.truckId);
    if (!lock) continue;
    if (lock.projectId === (job.projectId ?? null)) continue; // same project is fine
    dedupe({
      type: 'PROJECT_RESOURCE_LOCK',
      severity: 'WARNING',
      message: `Truck is assigned to active project: ${lock.projectName}`,
      affectedJobId: job.id,
      affectedTruckId: job.truckId,
    });
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
