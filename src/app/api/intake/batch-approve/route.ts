import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendConfirmations } from '@/lib/confirmation';
import { detectConflicts } from '@/lib/conflicts';
import type { BatchApproveItem } from '@/types';
import type { Borough, JobType } from '@prisma/client';

const VALID_JOB_TYPES: JobType[] = ['PICKUP', 'DROP_OFF', 'DUMP_OUT', 'SWAP'];
const DEFAULT_BOROUGH: Borough = 'MANHATTAN';

// POST /api/intake/batch-approve — create jobs from preview queue, confirm each, return job IDs + warnings
export async function POST(req: NextRequest) {
  let body: { items: BatchApproveItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 });
  }

  const sorted = [...items].sort((a, b) => {
    const tA = a.timeOverride ?? '23:59';
    const tB = b.timeOverride ?? '23:59';
    return tA.localeCompare(tB);
  });

  const createdIds: string[] = [];
  const warnings: string[] = [];

  for (const it of sorted) {
    const intake = await db.intakeItem.findUnique({
      where: { id: it.intakeItemId },
    });

    if (!intake) {
      warnings.push(`Intake ${it.intakeItemId} not found; skipped`);
      continue;
    }

    const type =
      intake.parsedServiceType && VALID_JOB_TYPES.includes(intake.parsedServiceType as JobType)
        ? (intake.parsedServiceType as JobType)
        : 'PICKUP';
    const date = intake.parsedDate ? new Date(intake.parsedDate) : new Date();
    const time = it.timeOverride ?? intake.parsedTime ?? '09:00';

    const job = await db.cartingJob.create({
      data: {
        type,
        customer: intake.parsedCustomer ?? 'Unknown',
        address: intake.parsedAddress ?? 'TBD',
        borough: DEFAULT_BOROUGH,
        date,
        time,
        containerSize: it.containerSize ?? intake.parsedContainerSize,
        notes: intake.parsedNotes,
        source: intake.source,
        priority: 'NORMAL',
        truckId: it.truckId,
        driverId: it.driverId,
        intakeItemId: intake.id,
      },
    });

    for (const workerId of it.workerIds ?? []) {
      await db.jobWorker.create({
        data: { jobId: job.id, workerId },
      });
    }

    await db.intakeItem.update({
      where: { id: it.intakeItemId },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: 'Dispatcher' },
    });

    try {
      await sendConfirmations(job.id);
    } catch {
      // don't fail the request
    }

    const conflicts = await detectConflicts({
      jobId: job.id,
      date,
      time,
      truckId: it.truckId,
      driverId: it.driverId,
      workerIds: it.workerIds ?? [],
    });
    if (conflicts.length > 0) {
      warnings.push(`${intake.parsedCustomer ?? job.id}: ${conflicts.map((c) => c.message).join('; ')}`);
    }

    createdIds.push(job.id);
  }

  return NextResponse.json({
    data: { jobIds: createdIds, warnings },
  });
}
