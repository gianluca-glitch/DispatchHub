import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { TruckRoute, RoutePoint, Borough, TruckType, TruckStatus, JobType, JobStatus } from '@/types';

// GET /api/dispatch/routes?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const jobs = await db.cartingJob.findMany({
    where: {
      date: dateOnly,
      status: { notIn: ['CANCELLED'] },
      truckId: { not: null },
    },
    include: {
      truck: { include: { assignedDriver: true } },
      driver: true,
      workers: { include: { worker: true } },
    },
    orderBy: { time: 'asc' },
  });

  // Group by truckId
  const byTruck = new Map<string | null, typeof jobs>();
  for (const job of jobs) {
    if (!job.truckId) continue;
    const list = byTruck.get(job.truckId) ?? [];
    list.push(job);
    byTruck.set(job.truckId, list);
  }

  const routes: TruckRoute[] = [];

  for (const [truckId, truckJobs] of byTruck) {
    if (!truckId || truckJobs.length === 0) continue;
    const truck = truckJobs[0].truck!;
    const driver = truckJobs[0].driver ?? truck.assignedDriver;
    const driverName = driver?.name ?? null;
    const driverId = driver?.id ?? null;

    const stops: RoutePoint[] = truckJobs.map((job, idx) => ({
      jobId: job.id,
      customer: job.customer,
      address: job.address,
      borough: job.borough as Borough,
      time: job.time,
      type: job.type as JobType,
      status: job.status as JobStatus,
      sequence: idx,
      lat: truck.lastGpsLat ?? null,
      lng: truck.lastGpsLng ?? null,
      truckId: truck.id,
      truckName: truck.name,
    }));

    const boroughs = [...new Set(stops.map((s) => s.borough))];
    let currentStopIndex = -1;
    for (let i = stops.length - 1; i >= 0; i--) {
      if (stops[i].status === 'IN_PROGRESS' || stops[i].status === 'COMPLETED') {
        currentStopIndex = i;
        break;
      }
    }

    routes.push({
      truckId: truck.id,
      truckName: truck.name,
      truckType: truck.type as TruckType,
      truckStatus: truck.status as TruckStatus,
      driverName,
      driverId,
      stops,
      totalJobs: stops.length,
      boroughs,
      currentStopIndex,
    });
  }

  return NextResponse.json({ data: routes });
}
