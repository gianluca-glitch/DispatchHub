'use client';

import type { ProjectNote as ProjectNoteType, NoteCategory } from '@/types';
import { NOTE_CATEGORY_LABELS, NOTE_CATEGORY_COLORS } from '@/types';

interface ProjectNoteProps {
  note: ProjectNoteType;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function ProjectNoteCard({ note }: ProjectNoteProps) {
  const category = note.category as NoteCategory;
  const catColor = NOTE_CATEGORY_COLORS[category] ?? NOTE_CATEGORY_COLORS.general;
  const catLabel = NOTE_CATEGORY_LABELS[category] ?? 'General';

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${catColor}`}>
          {catLabel}
        </span>
        <span className="text-text-3 text-[10px] font-mono">{formatTimestamp(note.createdAt)}</span>
        <span className="text-text-3 text-[10px] ml-auto">{note.createdBy}</span>
      </div>
      <p className="text-text-1 text-sm break-words whitespace-pre-wrap">{note.content}</p>
    </div>
  );
}
