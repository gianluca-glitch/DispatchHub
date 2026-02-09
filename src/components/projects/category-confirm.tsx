'use client';

import { useProjectStore } from '@/stores';
import { NOTE_CATEGORY_LABELS, NOTE_CATEGORY_COLORS } from '@/types';
import type { NoteCategory } from '@/types';
import { Check, X } from 'lucide-react';

const CATEGORIES: NoteCategory[] = [
  'general', 'workers', 'equipment', 'purchase_orders',
  'schedule', 'client', 'budget', 'change_orders', 'permits',
];

export function CategoryConfirm() {
  const { noteConfirmation, setNoteConfirmation } = useProjectStore();

  if (!noteConfirmation) return null;

  const handleConfirm = async (category: NoteCategory) => {
    try {
      await fetch(`/api/projects/${noteConfirmation.projectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteConfirmation.noteContent,
          category,
          createdBy: 'ai',
        }),
      });
    } catch (err) {
      console.error('Failed to save note:', err);
    }
    setNoteConfirmation(null);
  };

  const handleDismiss = () => setNoteConfirmation(null);

  const catColor = NOTE_CATEGORY_COLORS[noteConfirmation.suggestedCategory] ?? NOTE_CATEGORY_COLORS.general;

  return (
    <div className="bg-surface-1 border border-amber/30 rounded-lg p-3 space-y-2">
      <p className="text-text-1 text-sm">
        Filing under{' '}
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${catColor}`}>
          {NOTE_CATEGORY_LABELS[noteConfirmation.suggestedCategory]}
        </span>
        {' '}for <strong className="text-text-0">{noteConfirmation.projectName}</strong>
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleConfirm(noteConfirmation.suggestedCategory)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber text-black text-xs font-medium hover:bg-amber/90 min-h-[44px] transition-colors"
        >
          <Check size={14} />
          Confirm
        </button>

        {/* Category picker */}
        <select
          onChange={(e) => handleConfirm(e.target.value as NoteCategory)}
          defaultValue=""
          className="h-[44px] px-2 rounded bg-surface-2 border border-border text-text-1 text-xs"
        >
          <option value="" disabled>Change category...</option>
          {CATEGORIES.filter((c) => c !== noteConfirmation.suggestedCategory).map((c) => (
            <option key={c} value={c}>{NOTE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <button
          onClick={handleDismiss}
          className="p-1.5 rounded text-text-3 hover:text-text-0 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
