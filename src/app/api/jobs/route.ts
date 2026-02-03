import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/jobs?date=2026-02-02
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');

  const where = date
    ? { date: new Date(date) }
    : {};

  const jobs = await db.cartingJob.findMany({
    where,
    include: {
      truck: true,
      driver: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { time: 'asc' },
  });

  return NextResponse.json({ data: jobs });
}

// POST /api/jobs — create a new job
export async function POST(req: NextRequest) {
  const body = await req.json();

  const job = await db.cartingJob.create({
    data: {
      type: body.type,
      customer: body.customer,
      address: body.address,
      borough: body.borough,
      date: new Date(body.date),
      time: body.time,
      containerSize: body.containerSize,
      notes: body.notes,
      source: body.source ?? 'FORM',
      priority: body.priority ?? 'NORMAL',
      truckId: body.truckId,
      driverId: body.driverId,
      projectId: body.projectId,
      intakeItemId: body.intakeItemId,
    },
    include: { truck: true, driver: true },
  });

  return NextResponse.json({ data: job }, { status: 201 });
}
