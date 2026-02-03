import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/trucks
export async function GET() {
  const trucks = await db.truck.findMany({
    include: { assignedDriver: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ data: trucks });
}
