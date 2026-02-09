'use client';

import { useState } from 'react';
import { useProjectNotes } from '@/hooks';
import { ProjectNoteCard } from './project-note';
import type { NoteCategory } from '@/types';
import { NOTE_CATEGORY_LABELS, NOTE_CATEGORY_COLORS } from '@/types';

const ALL_CATEGORIES: NoteCategory[] = [
  'general', 'workers', 'equipment', 'purchase_orders',
  'schedule', 'client', 'budget', 'change_orders', 'permits',
];

interface ProjectNotesProps {
  projectId: string;
}

export function ProjectNotes({ projectId }: ProjectNotesProps) {
  const { data: notes, loading } = useProjectNotes(projectId);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>('all');

  if (loading) {
    return <div className="text-text-3 text-sm text-center py-8">Loading notes...</div>;
  }

  const filtered = (notes ?? []).filter((n) =>
    categoryFilter === 'all' ? true : n.category === categoryFilter
  );

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
            categoryFilter === 'all'
              ? 'bg-amber/15 text-amber'
              : 'bg-surface-2 text-text-3 hover:text-text-1'
          }`}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = (notes ?? []).filter((n) => n.category === cat).length;
          if (count === 0) return null;
          const color = categoryFilter === cat
            ? NOTE_CATEGORY_COLORS[cat]
            : 'bg-surface-2 text-text-3 hover:text-text-1';
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap min-h-[36px] border transition-colors ${color}`}
            >
              {NOTE_CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="text-text-3 text-sm text-center py-8">
          {(notes ?? []).length === 0
            ? 'No notes yet. Use the chat to add notes.'
            : 'No notes in this category.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <ProjectNoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
