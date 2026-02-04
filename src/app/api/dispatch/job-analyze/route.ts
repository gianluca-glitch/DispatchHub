import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeJob } from '@/lib/ai/claude';
import type { JobAnalysis } from '@/types';

type Action = 'initial' | 'swap_truck' | 'swap_driver' | 'reschedule' | 'freeform';

// POST /api/dispatch/job-analyze
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;
  const dateParam = (body.date as string) ?? new Date().toISOString().slice(0, 10);
  const action = (body.action as Action) ?? 'initial';
  const truckId = body.truckId as string | null | undefined;
  const driverId = body.driverId as string | null | undefined;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const dateOnly = new Date(dateParam + 'T12:00:00');

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

  const effectiveTruckId = truckId !== undefined ? truckId : job.truckId;
  const effectiveDriverId = driverId !== undefined ? driverId : job.driverId;
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
    proposedTruckId: truckId,
    proposedTruckName: truckId ? trucks.find((t) => t.id === truckId)?.name ?? null : undefined,
    proposedDriverId: driverId,
    proposedDriverName: driverId ? workers.find((w) => w.id === driverId)?.name ?? null : undefined,
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
    const result: JobAnalysis = await analyzeJob(analysisInput);
    return NextResponse.json(result);
  } catch (e) {
    console.error('job-analyze', e);
    return NextResponse.json(
      {
        error: 'Analysis failed',
        conflicts: [],
        recommendations: [],
        warnings: [],
        impactSummary: 'Analysis failed.',
        workerRecs: [],
      },
      { status: 500 }
    );
  }
}
