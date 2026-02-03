import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/workers
export async function GET() {
  const workers = await db.worker.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ data: workers });
}
