import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';

// PATCH /api/projects/[id]/notes/[noteId] — update note category
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { category } = body;

    const validCategories = [
      'general', 'workers', 'equipment', 'purchase_orders',
      'schedule', 'client', 'budget', 'change_orders', 'permits',
    ];

    if (category && !validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const data: Record<string, string> = {};
    if (category) data.category = category;

    const note = await db.projectNote.update({
      where: { id: params.noteId },
      data,
    });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'update_project',
      module: 'projects',
      detail: `Changed note category to ${category}`,
      projectId: params.id,
    });

    return NextResponse.json({ data: note });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to update note ${params.noteId}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/notes/[noteId] — remove note
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    await db.projectNote.delete({ where: { id: params.noteId } });

    logActivity({
      userId: 'fabio',
      userName: 'Fabio',
      action: 'update_project',
      module: 'projects',
      detail: `Deleted note ${params.noteId}`,
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
      detail: `Failed to delete note ${params.noteId}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
