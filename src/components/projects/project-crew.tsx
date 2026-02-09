'use client';

import { X } from 'lucide-react';
import type { ProjectWorkerAssignment, WorkerRole } from '@/types';
import { WORKER_ROLE_LABELS } from '@/types';

const ROLE_COLORS: Record<WorkerRole, string> = {
  FOREMAN: 'bg-amber/20 text-amber border-amber/30',
  LABORER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  OPERATOR: 'bg-purple/20 text-purple border-purple/30',
  DRIVER: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

interface ProjectCrewProps {
  workers: ProjectWorkerAssignment[];
  projectId: string;
  onRemoved: () => void;
}

export function ProjectCrew({ workers, projectId, onRemoved }: ProjectCrewProps) {
  const handleRemove = async (assignmentId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/workers?assignmentId=${assignmentId}`, {
        method: 'DELETE',
      });
      onRemoved();
    } catch (err) {
      console.error('Failed to remove worker:', err);
    }
  };

  if (workers.length === 0) {
    return (
      <div className="text-text-3 text-sm text-center py-8">
        No crew assigned. Use the chat to add workers.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {workers.map((assignment) => {
        const roleColor = ROLE_COLORS[assignment.role] ?? ROLE_COLORS.LABORER;
        return (
          <div
            key={assignment.id}
            className="flex items-center justify-between bg-surface-1 border border-border rounded-lg p-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-text-0 text-sm font-medium truncate">
                {assignment.worker.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleColor}`}>
                {WORKER_ROLE_LABELS[assignment.role]}
              </span>
            </div>
            <button
              onClick={() => handleRemove(assignment.id)}
              className="p-2 rounded text-text-3 hover:text-danger transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              aria-label={`Remove ${assignment.worker.name}`}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
