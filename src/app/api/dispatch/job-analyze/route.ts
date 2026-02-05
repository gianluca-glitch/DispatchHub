import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeJob } from '@/lib/ai/claude';
import { detectConflicts } from '@/lib/conflicts';
import type { JobAnalysisResponse, Conflict } from '@/types';

type Action = 'initial' | 'swap_truck' | 'swap_driver' | 'reschedule' | 'freeform';

// POST /api/dispatch/job-analyze
// Returns JobAnalysisResponse. When action + newDriverId/newTruckId are provided, returns IMPACT of that change.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;
  const dateParam = (body.date as string) ?? new Date().toISOString().slice(0, 10);
  const action = (body.action as Action) ?? 'initial';
  const truckId = body.truckId as string | null | undefined;
  const driverId = body.driverId as string | null | undefined;
  const newTruckId = body.newTruckId as string | null | undefined;
  const newDriverId = body.newDriverId as string | null | undefined;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const [y, m, d] = dateParam.split('-').map(Number);
  const dateOnly = new Date(Date.UTC(y, m - 1, d));

  const [job, jobs, workers, trucks] = await Promise.all([
    db.cartingJob.findUnique({
      where: { id: jobId },
      include: { truck: true, driver: true },
    }),
    db.cartingJob.findMany({
      where: { date: dateOnly, status: { notIn: ['CANCELLED'] } },
      include: { truck: true, driver: true },
      orderBy: { time: 'asc' },
    }),
    db.worker.findMany(),
    db.truck.findMany(),
  ]);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const workerJobCount = new Map<string, number>();
  jobs.forEach((j) => {
    if (j.driverId) workerJobCount.set(j.driverId, (workerJobCount.get(j.driverId) ?? 0) + 1);
  });
  const truckJobCount = new Map<string, number>();
  jobs.forEach((j) => {
    if (j.truckId) truckJobCount.set(j.truckId, (truckJobCount.get(j.truckId) ?? 0) + 1);
  });

  const byTruck = new Map<string, typeof jobs>();
  jobs.forEach((j) => {
    if (!j.truckId) return;
    const list = byTruck.get(j.truckId) ?? [];
    list.push(j);
    byTruck.set(j.truckId, list);
  });
  const truckRoutes = Array.from(byTruck.entries()).map(([tid, truckJobs]) => {
    const truck = truckJobs[0].truck!;
    return {
      truckId: tid,
      truckName: truck.name,
      stops: truckJobs.map((j) => ({
        jobId: j.id,
        customer: j.customer,
        address: j.address,
        borough: j.borough,
        time: j.time,
      })),
    };
  });

  // For impact analysis: use newTruckId/newDriverId when provided (e.g. preview state)
  const effectiveTruckId = newTruckId !== undefined ? newTruckId : (truckId !== undefined ? truckId : job.truckId);
  const effectiveDriverId = newDriverId !== undefined ? newDriverId : (driverId !== undefined ? driverId : job.driverId);
  const effectiveTruck = effectiveTruckId ? trucks.find((t) => t.id === effectiveTruckId) : null;
  const effectiveDriver = effectiveDriverId ? workers.find((w) => w.id === effectiveDriverId) : null;

  const analysisInput = {
    job: {
      id: job.id,
      customer: job.customer,
      address: job.address,
      borough: job.borough,
      date: job.date.toISOString().slice(0, 10),
      time: job.time,
      type: job.type,
      status: job.status,
      truckId: effectiveTruckId,
      truckName: effectiveTruck?.name ?? null,
      driverId: effectiveDriverId,
      driverName: effectiveDriver?.name ?? null,
      notes: job.notes,
    },
    action,
    proposedTruckId: newTruckId ?? truckId,
    proposedTruckName: (newTruckId ?? truckId) ? trucks.find((t) => t.id === (newTruckId ?? truckId))?.name ?? null : undefined,
    proposedDriverId: newDriverId ?? driverId,
    proposedDriverName: (newDriverId ?? driverId) ? workers.find((w) => w.id === (newDriverId ?? driverId))?.name ?? null : undefined,
    todayJobs: jobs.map((j) => ({
      id: j.id,
      customer: j.customer,
      address: j.address,
      borough: j.borough,
      time: j.time,
      truckId: j.truckId,
      truckName: j.truck?.name ?? null,
      driverId: j.driverId,
      driverName: j.driver?.name ?? null,
    })),
    truckRoutes,
    workers: workers.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      status: w.status,
      todayJobCount: workerJobCount.get(w.id) ?? 0,
    })),
    trucks: trucks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      todayJobCount: truckJobCount.get(t.id) ?? 0,
    })),
  };

  try {
    const [conflicts, aiResult] = await Promise.all([
      detectConflicts({
        jobId,
        date: dateOnly,
        time: job.time,
        truckId: effectiveTruckId ?? undefined,
        driverId: effectiveDriverId ?? undefined,
      }),
      analyzeJob(analysisInput),
    ]);

    const workerById = new Map(workers.map((w) => [w.id, w]));
    const truckById = new Map(trucks.map((t) => [t.id, t]));

    const workersOut: JobAnalysisResponse['workers'] = (aiResult.workerRecs ?? []).slice(0, 3).map((rec) => {
      const w = workerById.get(rec.workerId);
      return {
        id: rec.workerId,
        name: rec.name,
        score: rec.score,
        reason: rec.reason,
        role: w?.role ?? 'DRIVER',
        status: w?.status ?? 'AVAILABLE',
      };
    });

    const trucksOut: JobAnalysisResponse['trucks'] = (aiResult.truckRecs ?? []).slice(0, 3).map((rec) => {
      const t = truckById.get(rec.truckId);
      return {
        id: rec.truckId,
        name: rec.name,
        type: rec.type ?? (t?.type ?? 'VAN'),
        reason: rec.reason,
        status: t?.status ?? 'AVAILABLE',
        jobCount: truckJobCount.get(rec.truckId) ?? 0,
      };
    });

    const topWorker = workersOut[0]
      ? {
          id: workersOut[0].id,
          name: workersOut[0].name,
          score: workersOut[0].score,
          reason: workersOut[0].reason,
          role: workersOut[0].role,
        }
      : null;

    const response: JobAnalysisResponse = {
      impactSummary: aiResult.impactSummary ?? 'No summary.',
      conflicts: conflicts as Conflict[],
      warnings: aiResult.warnings ?? [],
      topWorker,
      workers: workersOut,
      trucks: trucksOut,
    };

    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    console.error('[job-analyze]', message, e);
    return NextResponse.json(
      {
        error: message,
        impactSummary: message,
        conflicts: [],
        warnings: [],
        topWorker: null,
        workers: [],
        trucks: [],
      } as JobAnalysisResponse,
      { status: 500 }
    );
  }
}
