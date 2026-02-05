import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectConflicts, detectAllConflictsForDate } from '@/lib/conflicts';

// GET /api/jobs/conflicts?date=YYYY-MM-DD — schedule-wide conflicts for the day
// GET /api/jobs/conflicts?jobId=X&date=YYYY-MM-DD — conflicts for a single job (optional truckId, driverId)
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  const date = req.nextUrl.searchParams.get('date');
  const truckIdParam = req.nextUrl.searchParams.get('truckId');
  const driverIdParam = req.nextUrl.searchParams.get('driverId');

  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 });
  }

  const dateObj = new Date(date + 'T12:00:00');
  const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

  // Schedule-wide: no jobId — single batched call
  if (!jobId) {
    const all = await detectAllConflictsForDate(dateOnly);
    return NextResponse.json({ data: all });
  }

  // Single-job mode
  let truckId = truckIdParam ?? undefined;
  let driverId = driverIdParam ?? undefined;
  let time: string | undefined;

  const job = await db.cartingJob.findUnique({
    where: { id: jobId },
    select: { truckId: true, driverId: true, time: true },
  });
  if (job) {
    truckId = truckId ?? job.truckId ?? undefined;
    driverId = driverId ?? job.driverId ?? undefined;
    time = job.time;
  }

  const conflicts = await detectConflicts({
    jobId,
    date: dateOnly,
    time,
    truckId,
    driverId,
  });

  return NextResponse.json({ data: conflicts });
}
