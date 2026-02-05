import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeScenario } from '@/lib/ai/claude';
import type { ScenarioInput } from '@/types';

// POST /api/dispatch/scenario-analyze
export async function POST(req: NextRequest) {
  const body = await req.json();
  const scenario = body.scenario as ScenarioInput;
  const dateParam = body.date as string | undefined;
  const date = dateParam ? new Date(dateParam) : new Date();
  const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  if (!scenario?.type) {
    return NextResponse.json({ error: 'scenario.type required' }, { status: 400 });
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

  const todayJobs = jobs.map((j) => ({
    id: j.id,
    customer: j.customer,
    address: j.address,
    borough: j.borough,
    time: j.time,
    type: j.type,
    status: j.status,
    truckId: j.truckId,
    truckName: j.truck?.name ?? null,
    driverId: j.driverId,
    driverName: j.driver?.name ?? null,
    workerIds: j.workers.map((w) => w.workerId),
    workerNames: j.workers.map((w) => w.worker.name),
  }));

  const truckJobCount = new Map<string, number>();
  for (const j of jobs) {
    if (j.truckId) truckJobCount.set(j.truckId, (truckJobCount.get(j.truckId) ?? 0) + 1);
  }
  const trucksPayload = trucks.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    status: t.status,
    currentLocation: t.currentLocation,
    todayJobCount: truckJobCount.get(t.id) ?? 0,
  }));

  const workerJobCount = new Map<string, number>();
  for (const j of jobs) {
    if (j.driverId) workerJobCount.set(j.driverId, (workerJobCount.get(j.driverId) ?? 0) + 1);
    for (const w of j.workers) workerJobCount.set(w.workerId, (workerJobCount.get(w.workerId) ?? 0) + 1);
  }
  const workersPayload = workers.map((w) => ({
    id: w.id,
    name: w.name,
    role: w.role,
    status: w.status,
    certifications: w.certifications,
    todayJobCount: workerJobCount.get(w.id) ?? 0,
  }));

  const byTruck = new Map<string, typeof jobs>();
  for (const job of jobs) {
    if (!job.truckId) continue;
    const list = byTruck.get(job.truckId) ?? [];
    list.push(job);
    byTruck.set(job.truckId, list);
  }

  const truckRoutes = Array.from(byTruck.entries()).map(([truckId, truckJobs]) => {
    const truck = truckJobs[0].truck!;
    return {
      truckId,
      truckName: truck.name,
      stops: truckJobs.map((j, idx) => ({
        jobId: j.id,
        customer: j.customer,
        address: j.address,
        borough: j.borough,
        time: j.time,
        type: j.type,
        status: j.status,
        sequence: idx,
      })),
    };
  });

  const result = await analyzeScenario({
    scenario,
    todayJobs: todayJobs,
    trucks: trucksPayload,
    workers: workersPayload,
    truckRoutes,
  });

  return NextResponse.json({ data: result });
}
