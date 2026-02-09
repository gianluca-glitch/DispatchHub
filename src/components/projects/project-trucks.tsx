'use client';

import { X } from 'lucide-react';
import type { ProjectTruckAssignment } from '@/types';
import { TRUCK_TYPE_LABELS } from '@/types';

interface ProjectTrucksProps {
  trucks: ProjectTruckAssignment[];
  projectId: string;
  onRemoved: () => void;
}

export function ProjectTrucks({ trucks, projectId, onRemoved }: ProjectTrucksProps) {
  const handleRemove = async (assignmentId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/trucks?assignmentId=${assignmentId}`, {
        method: 'DELETE',
      });
      onRemoved();
    } catch (err) {
      console.error('Failed to remove truck:', err);
    }
  };

  if (trucks.length === 0) {
    return (
      <div className="text-text-3 text-sm text-center py-8">
        No trucks assigned. Use the chat to add trucks.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trucks.map((assignment) => (
        <div
          key={assignment.id}
          className="flex items-center justify-between bg-surface-1 border border-border rounded-lg p-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-0 text-sm font-medium truncate">
              {assignment.truck.name}
            </span>
            <span className="text-text-3 text-xs">
              {TRUCK_TYPE_LABELS[assignment.truck.type] ?? assignment.truck.type}
            </span>
          </div>
          <button
            onClick={() => handleRemove(assignment.id)}
            className="p-2 rounded text-text-3 hover:text-danger transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label={`Remove ${assignment.truck.name}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
