import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/logs?module=projects&action=error&limit=100
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

    const where: Record<string, string> = {};
    if (module) where.module = module;
    if (action) where.action = action;

    const logs = await db.activityLog.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error('[AdminLogs] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
