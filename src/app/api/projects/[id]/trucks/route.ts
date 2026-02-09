import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';

// POST /api/projects/[id]/trucks — assign truck
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { truckId } = body;

    if (!truckId) {
      return NextResponse.json({ error: 'truckId is required' }, { status: 400 });
    }

    const truck = await db.truck.findUnique({ where: { id: truckId }, select: { name: true } });
    if (!truck) {
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
    }

    const project = await db.demoProject.findUnique({ where: { id: params.id }, select: { name: true } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const assignment = await db.projectTruck.create({
      data: {
        projectId: params.id,
        truckId,
      },
      include: { truck: true },
    });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'assign_truck',
      module: 'projects',
      detail: `${truck.name} → ${project.name}`,
      projectId: params.id,
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Truck already assigned to this project' }, { status: 409 });
    }
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to assign truck to project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to assign truck' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/trucks — remove truck
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId query param required' }, { status: 400 });
    }

    const assignment = await db.projectTruck.findUnique({
      where: { id: assignmentId },
      include: { truck: true, project: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await db.projectTruck.delete({ where: { id: assignmentId } });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'remove_truck',
      module: 'projects',
      detail: `${assignment.truck.name} removed from ${assignment.project.name}`,
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
      detail: `Failed to remove truck from project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to remove truck' }, { status: 500 });
  }
}
