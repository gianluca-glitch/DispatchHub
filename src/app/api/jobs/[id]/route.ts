import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/jobs/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await db.cartingJob.findUnique({
    where: { id: params.id },
    include: {
      truck: true,
      driver: true,
      workers: { include: { worker: true } },
      project: true,
      confirmations: true,
    },
  });

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: job });
}

// PATCH /api/jobs/[id] — update fields + log changes
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const jobId = params.id;

  // Get current values for change log
  const current = await db.cartingJob.findUnique({
    where: { id: jobId },
    include: { truck: true, driver: true },
  });

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Build update data (only provided fields)
  const updateData: Record<string, any> = {};
  const logEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

  const fields = ['type', 'status', 'customer', 'address', 'borough', 'time', 'containerSize', 'notes', 'priority', 'truckId', 'driverId'];

  for (const field of fields) {
    if (body[field] !== undefined && body[field] !== (current as any)[field]) {
      const oldVal = String((current as any)[field] ?? '');
      const newVal = String(body[field] ?? '');

      // Resolve display names for truck/driver
      let oldDisplay = oldVal;
      let newDisplay = newVal;

      if (field === 'truckId') {
        oldDisplay = current.truck?.name ?? oldVal;
        if (body[field]) {
          const newTruck = await db.truck.findUnique({ where: { id: body[field] }, select: { name: true } });
          newDisplay = newTruck?.name ?? newVal;
        }
      }
      if (field === 'driverId') {
        oldDisplay = current.driver?.name ?? oldVal;
        if (body[field]) {
          const newDriver = await db.worker.findUnique({ where: { id: body[field] }, select: { name: true } });
          newDisplay = newDriver?.name ?? newVal;
        }
      }

      updateData[field] = body[field];
      logEntries.push({ field, oldValue: oldDisplay, newValue: newDisplay });
    }
  }

  // Handle date separately (needs Date conversion)
  if (body.date && new Date(body.date).toISOString() !== current.date.toISOString()) {
    updateData.date = new Date(body.date);
    logEntries.push({
      field: 'date',
      oldValue: current.date.toISOString().split('T')[0],
      newValue: body.date,
    });
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ data: current, changed: false });
  }

  // Update job
  const updated = await db.cartingJob.update({
    where: { id: jobId },
    data: updateData,
    include: { truck: true, driver: true, project: true },
  });

  // Write change log entries
  for (const entry of logEntries) {
    await db.changeLog.create({
      data: {
        entityType: 'job',
        entityId: jobId,
        entityName: updated.customer,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        jobId: jobId,
        userName: 'Dispatcher', // TODO: replace with auth user
      },
    });
  }

  return NextResponse.json({ data: updated, changed: true, changes: logEntries });
}
