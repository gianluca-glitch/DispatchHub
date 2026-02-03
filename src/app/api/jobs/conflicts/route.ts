import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectConflicts } from '@/lib/conflicts';

// GET /api/jobs/conflicts?jobId=X&date=YYYY-MM-DD (optionally truckId, driverId to override)
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  const date = req.nextUrl.searchParams.get('date');
  const truckIdParam = req.nextUrl.searchParams.get('truckId');
  const driverIdParam = req.nextUrl.searchParams.get('driverId');

  if (!jobId || !date) {
    return NextResponse.json({ error: 'jobId and date required' }, { status: 400 });
  }

  const dateObj = new Date(date);
  let truckId = truckIdParam ?? undefined;
  let driverId = driverIdParam ?? undefined;
  let time: string | undefined;

  if (!truckId || !driverId) {
    const job = await db.cartingJob.findUnique({
      where: { id: jobId },
      select: { truckId: true, driverId: true, time: true },
    });
    if (job) {
      truckId = truckId ?? job.truckId ?? undefined;
      driverId = driverId ?? job.driverId ?? undefined;
      time = job.time;
    }
  }

  const conflicts = await detectConflicts({
    jobId,
    date: dateObj,
    time,
    truckId,
    driverId,
  });

  return NextResponse.json({ data: conflicts });
}
