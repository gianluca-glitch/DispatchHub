import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';

// GET /api/projects/[id]/notes — all notes for project
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const notes = await db.projectNote.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: notes });
  } catch (err) {
    console.error('[ProjectNotes GET]', err);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST /api/projects/[id]/notes — create note with category
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { content, category, createdBy } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const validCategories = [
      'general', 'workers', 'equipment', 'purchase_orders',
      'schedule', 'client', 'budget', 'change_orders', 'permits',
    ];
    const noteCategory = validCategories.includes(category) ? category : 'general';

    const note = await db.projectNote.create({
      data: {
        projectId: params.id,
        content,
        category: noteCategory,
        createdBy: createdBy ?? 'fabio',
      },
    });

    logActivity({
      userId: createdBy ?? 'fabio',
      userName: createdBy === 'ai' ? 'AI' : 'Fabio',
      action: 'add_note',
      module: 'projects',
      detail: `[${noteCategory}] ${content.slice(0, 100)}`,
      projectId: params.id,
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system',
      userName: 'System',
      action: 'error',
      module: 'projects',
      detail: `Failed to add note to project ${params.id}`,
      error: message,
    });
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
