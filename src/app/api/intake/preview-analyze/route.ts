import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectConflicts, type TentativeJob } from '@/lib/conflicts';
import { analyzePreviewAssignment } from '@/lib/ai/claude';
import type { PreviewAnalyzeRequest, PreviewAnalysis } from '@/types';

// POST /api/intake/preview-analyze — run conflict engine + AI analysis for a proposed assignment
export async function POST(req: NextRequest) {
  let body: PreviewAnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { intakeItemId, truckId, driverId, workerIds, timeOverride, otherPreviews } = body;

  const intake = await db.intakeItem.findUnique({
    where: { id: intakeItemId },
  });

  if (!intake) {
    return NextResponse.json({ error: 'Intake item not found' }, { status: 404 });
  }

  const targetDate = intake.parsedDate ? new Date(intake.parsedDate) : new Date();
  const time = timeOverride ?? intake.parsedTime ?? '09:00';

  // All confirmed jobs for that date
  const existingJobs = await db.cartingJob.findMany({
    where: {
      date: targetDate,
      status: { notIn: ['CANCELLED'] },
    },
    include: {
      truck: { select: { name: true } },
      driver: { select: { name: true } },
      workers: { select: { workerId: true } },
    },
  });

  // Workers with job count for that date
  const allWorkerIds = existingJobs.flatMap((j) => [
    ...(j.driverId ? [j.driverId] : []),
    ...j.workers.map((w) => w.workerId),
  ]);
  const workerCounts = new Map<string, number>();
  for (const id of allWorkerIds) workerCounts.set(id, (workerCounts.get(id) ?? 0) + 1);
  const workers = await db.worker.findMany({
    select: { id: true, name: true, role: true, status: true, certifications: true },
  });
  const workersWithCount = workers.map((w) => ({
    id: w.id,
    name: w.name,
    role: w.role,
    status: w.status,
    certifications: w.certifications,
    jobCountToday: workerCounts.get(w.id) ?? 0,
  }));

  // Trucks with job count for that date
  const truckIdsUsed = existingJobs.map((j) => j.truckId).filter(Boolean) as string[];
  const truckCounts = new Map<string, number>();
  for (const id of truckIdsUsed) truckCounts.set(id, (truckCounts.get(id) ?? 0) + 1);
  const trucks = await db.truck.findMany({
    select: { id: true, name: true, type: true, status: true, currentLocation: true },
  });
  const trucksWithCount = trucks.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    status: t.status,
    currentLocation: t.currentLocation,
    jobCountToday: truckCounts.get(t.id) ?? 0,
  }));

  const tentativeJobs: TentativeJob[] = otherPreviews.map((p) => ({
    jobId: p.intakeItemId,
    truckId: p.truckId,
    driverId: p.driverId,
    time: p.time,
  }));

  const conflictResults = await detectConflicts({
    jobId: intakeItemId,
    date: targetDate,
    time,
    truckId: truckId ?? undefined,
    driverId: driverId ?? undefined,
    workerIds: workerIds ?? [],
    tentativeJobs,
  });

  const parsed = {
    customer: intake.parsedCustomer,
    address: intake.parsedAddress,
    borough: (intake as any).parsedBorough ?? null,
    serviceType: intake.parsedServiceType,
    date: intake.parsedDate,
    time: intake.parsedTime,
    containerSize: intake.parsedContainerSize,
    notes: intake.parsedNotes,
  };

  const assignment = {
    truckId: truckId ?? null,
    driverId: driverId ?? null,
    workerIds: workerIds ?? [],
    timeOverride: timeOverride ?? null,
  };

  const otherPreviewsForAi = otherPreviews.map((p) => ({
    intakeItemId: p.intakeItemId,
    truckId: p.truckId,
    driverId: p.driverId,
    workerIds: p.workerIds ?? [],
    time: p.time,
  }));

  let analysis: PreviewAnalysis;
  try {
    analysis = await analyzePreviewAssignment({
      parsed,
      assignment,
      existingJobs: existingJobs.map((j) => ({
        id: j.id,
        customer: j.customer,
        address: j.address,
        borough: j.borough,
        time: j.time,
        truckId: j.truckId,
        truckName: j.truck?.name,
        driverId: j.driverId,
        driverName: j.driver?.name,
        workerIds: j.workers.map((w) => w.workerId),
      })),
      otherPreviews: otherPreviewsForAi,
      workers: workersWithCount,
      trucks: trucksWithCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'AI analysis failed', detail: String(e) },
      { status: 500 }
    );
  }

  analysis.conflicts = conflictResults;

  return NextResponse.json({ data: analysis });
}
