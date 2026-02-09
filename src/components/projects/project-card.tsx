'use client';

import { MapPin, Users, Truck } from 'lucide-react';
import type { DemoProject } from '@/types';
import { PHASE_COLORS, PHASE_LABELS } from '@/types';

interface ProjectCardProps {
  project: DemoProject;
  selected: boolean;
  onClick: () => void;
}

export function ProjectCard({ project, selected, onClick }: ProjectCardProps) {
  const phaseColor = PHASE_COLORS[project.phase] ?? PHASE_COLORS.PLANNING;
  const workerCount = project.assignedWorkers?.length ?? 0;
  const truckCount = project.assignedTrucks?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors min-h-[44px] ${
        selected
          ? 'bg-amber/10 border-amber/30'
          : 'bg-surface-1 border-border hover:border-text-3'
      }`}
    >
      {/* Name + Phase */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-text-0 text-sm font-medium truncate">{project.name}</h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${phaseColor}`}>
          {PHASE_LABELS[project.phase]}
        </span>
      </div>

      {/* Address */}
      <div className="flex items-center gap-1 text-text-2 text-xs mb-2">
        <MapPin size={11} className="shrink-0" />
        <span className="truncate">{project.address}</span>
      </div>

      {/* Client */}
      <p className="text-text-3 text-xs truncate mb-2">{project.customer}</p>

      {/* Counts */}
      <div className="flex items-center gap-3 text-text-3 text-xs">
        <span className="flex items-center gap-1">
          <Users size={11} />
          {workerCount}
        </span>
        <span className="flex items-center gap-1">
          <Truck size={11} />
          {truckCount}
        </span>
      </div>
    </button>
  );
}
