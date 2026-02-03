import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getQuickRecommendation } from '@/lib/ai/claude';

// POST /api/dispatch/quick-recommend
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobId, truckId, driverId } = body;

  if (!jobId || !truckId || !driverId) {
    return NextResponse.json(
      { error: 'jobId, truckId, and driverId required' },
      { status: 400 }
    );
  }

  const [job, truck, driver] = await Promise.all([
    db.cartingJob.findUnique({
      where: { id: jobId },
      include: { truck: true, driver: true },
    }),
    db.truck.findUnique({ where: { id: truckId } }),
    db.worker.findUnique({ where: { id: driverId } }),
  ]);

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

  const dateOnly = new Date(job.date);
  const truckJobsToday = await db.cartingJob.findMany({
    where: {
      truckId,
      date: dateOnly,
      status: { notIn: ['CANCELLED'] },
    },
    orderBy: { time: 'asc' },
    select: { time: true, borough: true },
  });

  const todayScheduleSummary = truckJobsToday
    .map((j) => `${j.time} ${j.borough}`)
    .join('; ') || 'No other jobs today';

  const result = await getQuickRecommendation({
    job: {
      customer: job.customer,
      address: job.address,
      borough: job.borough,
      time: job.time,
      type: job.type,
    },
    proposedTruckName: truck.name,
    proposedDriverName: driver.name,
    truckType: truck.type,
    driverCerts: driver.certifications,
    todayScheduleSummary,
  });

  return NextResponse.json({
    data: { score: result.score, oneliner: result.oneliner, proceed: result.proceed },
  });
}
