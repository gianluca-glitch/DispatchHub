import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/intake — all IntakeItems sorted by receivedAt desc
export async function GET() {
  const items = await db.intakeItem.findMany({
    orderBy: { receivedAt: 'desc' },
  });
  return NextResponse.json({ data: items });
}
