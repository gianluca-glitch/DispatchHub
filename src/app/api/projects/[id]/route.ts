import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';

// GET /api/projects/[id] — single project with all relations
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await db.demoProject.findUnique({
      where: { id: params.id },
      include: {
        assignedWorkers: { include: { worker: true } },
        assignedTrucks: { include: { truck: true } },
        projectNotes: { orderBy: { createdAt: 'desc' } },
        jobs: { orderBy: { date: 'asc' } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error('[Project GET]', err);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PATCH /api/projects/[id] — update project fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const allowed = [
      'name', 'address', 'borough', 'customer', 'phase',
      'startDate', 'endDate', 'cartingNeeds', 'notes',
      'estimatedCost', 'actualCost',
    ];

    const data: Record<string, unknown> = {};
    const changes: string[] = [];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'startDate' || key === 'endDate') {
          data[key] = new Date(body[key]);
        } else {
          data[key] = body[key];
        }
        changes.push(`${key}: ${String(body[key]).slice(0, 50)}`);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const project = await db.demoProject.update({
      where: { id: params.id },
      data,
    });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'update_project',
      module: 'projects',
      detail: changes.join(', '),
      projectId: project.id,
    });

    return NextResponse.json({ data: project });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to update project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — delete project
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await db.demoProject.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await db.demoProject.delete({ where: { id: params.id } });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'update_project',
      module: 'projects',
      detail: `Deleted project: ${project.name}`,
      projectId: project.id,
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to delete project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
