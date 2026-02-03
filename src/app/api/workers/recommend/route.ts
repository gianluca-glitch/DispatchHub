import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getWorkerRecommendations } from '@/lib/ai/claude';

// POST /api/workers/recommend — get AI-ranked worker recommendations for a job
export async function POST(req: NextRequest) {
  const { jobContext } = await req.json();

  if (!jobContext) {
    return NextResponse.json({ error: 'jobContext required' }, { status: 400 });
  }

  // Get available workers
  const workers = await db.worker.findMany({
    where: { status: { in: ['AVAILABLE', 'ON_SITE'] } },
    select: { id: true, name: true, role: true, certifications: true, currentAssignment: true },
  });

  if (workers.length === 0) {
    return NextResponse.json({ data: [], message: 'No available workers' });
  }

  const recommendations = await getWorkerRecommendations(jobContext, workers);

  // Enrich with full worker data
  const enriched = await Promise.all(
    recommendations.map(async (rec: any) => {
      const worker = await db.worker.findUnique({ where: { id: rec.workerId } });
      return { ...rec, worker };
    })
  );

  return NextResponse.json({ data: enriched });
}
