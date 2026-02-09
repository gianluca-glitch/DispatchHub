import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';

// POST /api/projects/[id]/workers — assign worker
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { workerId, role } = body;

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    const validRoles = ['DRIVER', 'LABORER', 'FOREMAN', 'OPERATOR'];
    const workerRole = validRoles.includes(role) ? role : 'LABORER';

    const worker = await db.worker.findUnique({ where: { id: workerId }, select: { name: true } });
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const project = await db.demoProject.findUnique({ where: { id: params.id }, select: { name: true } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const assignment = await db.projectWorker.create({
      data: {
        projectId: params.id,
        workerId,
        role: workerRole,
      },
      include: { worker: true },
    });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'assign_worker',
      module: 'projects',
      detail: `${worker.name} (${workerRole}) → ${project.name}`,
      projectId: params.id,
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Worker already assigned to this project' }, { status: 409 });
    }
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to assign worker to project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to assign worker' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/workers — remove worker
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId query param required' }, { status: 400 });
    }

    const assignment = await db.projectWorker.findUnique({
      where: { id: assignmentId },
      include: { worker: true, project: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await db.projectWorker.delete({ where: { id: assignmentId } });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'remove_worker',
      module: 'projects',
      detail: `${assignment.worker.name} removed from ${assignment.project.name}`,
      projectId: params.id,
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to remove worker from project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to remove worker' }, { status: 500 });
  }
}
