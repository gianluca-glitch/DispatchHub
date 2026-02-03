import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendConfirmations } from '@/lib/confirmation';
import type { Borough, JobType } from '@prisma/client';

const VALID_JOB_TYPES: JobType[] = ['PICKUP', 'DROP_OFF', 'DUMP_OUT', 'SWAP'];
const DEFAULT_BOROUGH: Borough = 'MANHATTAN';

// POST /api/intake/approve — create CartingJob from intake, fire confirmations, mark intake APPROVED
// Optional body: truckId, driverId, workerIds[], timeOverride (from preview/sandbox)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    intakeItemId,
    truckId = null,
    driverId = null,
    workerIds = [],
    timeOverride = null,
    containerSizeOverride = null,
  } = body;

  if (!intakeItemId) {
    return NextResponse.json({ error: 'intakeItemId required' }, { status: 400 });
  }

  const intake = await db.intakeItem.findUnique({
    where: { id: intakeItemId },
  });

  if (!intake) {
    return NextResponse.json({ error: 'Intake item not found' }, { status: 404 });
  }

  const type = intake.parsedServiceType && VALID_JOB_TYPES.includes(intake.parsedServiceType as JobType)
    ? (intake.parsedServiceType as JobType)
    : 'PICKUP';
  const date = intake.parsedDate ? new Date(intake.parsedDate) : new Date();
  const time = timeOverride ?? intake.parsedTime ?? '09:00';
  const containerSize = containerSizeOverride ?? intake.parsedContainerSize;

  const job = await db.cartingJob.create({
    data: {
      type,
      customer: intake.parsedCustomer ?? 'Unknown',
      address: intake.parsedAddress ?? 'TBD',
      borough: DEFAULT_BOROUGH,
      date,
      time,
      containerSize,
      notes: intake.parsedNotes,
      source: intake.source,
      priority: 'NORMAL',
      truckId: truckId || undefined,
      driverId: driverId || undefined,
      intakeItemId: intake.id,
    },
    include: { truck: true, driver: true },
  });

  for (const workerId of Array.isArray(workerIds) ? workerIds : []) {
    await db.jobWorker.create({
      data: { jobId: job.id, workerId },
    });
  }

  await db.intakeItem.update({
    where: { id: intakeItemId },
    data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: 'Dispatcher' },
  });

  try {
    await sendConfirmations(job.id);
  } catch {
    // Job is created; confirmations may fail (e.g. no API keys). Don't fail the request.
  }

  return NextResponse.json({ data: job }, { status: 201 });
}
