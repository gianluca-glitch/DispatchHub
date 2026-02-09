import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';

// GET /api/projects — list all projects with counts
export async function GET() {
  try {
    const projects = await db.demoProject.findMany({
      include: {
        assignedWorkers: { include: { worker: true } },
        assignedTrucks: { include: { truck: true } },
        _count: { select: { projectNotes: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const data = projects.map((p) => ({
      ...p,
      notesCount: p._count.projectNotes,
      _count: undefined,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Projects GET]', err);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects — create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, address, borough, clientName, clientPhone, phase, startDate, endDate } = body;

    if (!name || !address || !borough || !clientName) {
      return NextResponse.json(
        { error: 'name, address, borough, and clientName are required' },
        { status: 400 }
      );
    }

    const project = await db.demoProject.create({
      data: {
        name,
        address,
        borough,
        customer: clientPhone ? `${clientName} (${clientPhone})` : clientName,
        phase: phase ?? 'PLANNING',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 90 * 86400000),
      },
    });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'create_project',
      module: 'projects',
      detail: `${project.name} — ${project.address}`,
      projectId: project.id,
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: 'Failed to create project',
      error: message,
    });
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
