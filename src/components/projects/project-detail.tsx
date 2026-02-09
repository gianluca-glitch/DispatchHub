'use client';

import { ArrowLeft, MapPin } from 'lucide-react';
import { useProject } from '@/hooks';
import { useProjectStore } from '@/stores';
import { PHASE_COLORS, PHASE_LABELS, BOROUGH_LABELS } from '@/types';
import { ProjectCrew } from './project-crew';
import { ProjectTrucks } from './project-trucks';
import { ProjectNotes } from './project-notes';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

const TABS = [
  { key: 'crew' as const, label: 'Crew' },
  { key: 'trucks' as const, label: 'Trucks' },
  { key: 'notes' as const, label: 'Notes' },
];

export function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const { data: project, loading, refetch } = useProject(projectId);
  const { projectDetailTab, setProjectDetailTab } = useProjectStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-3 text-sm">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-3 text-sm">Project not found</p>
      </div>
    );
  }

  const phaseColor = PHASE_COLORS[project.phase] ?? PHASE_COLORS.PLANNING;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-text-3 hover:text-text-0 text-xs mb-2 min-h-[44px] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to projects
        </button>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-text-0 text-lg font-semibold truncate">{project.name}</h2>
            <div className="flex items-center gap-1 text-text-2 text-xs mt-0.5">
              <MapPin size={11} />
              <span className="truncate">{project.address}</span>
            </div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${phaseColor}`}>
            {PHASE_LABELS[project.phase]}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
          <span className="text-text-2">
            <span className="text-text-3">Client:</span> {project.customer}
          </span>
          <span className="text-text-2">
            <span className="text-text-3">Borough:</span> {BOROUGH_LABELS[project.borough]}
          </span>
          <span className="text-text-2 font-mono">
            <span className="text-text-3">Start:</span> {formatDate(project.startDate)}
          </span>
          <span className="text-text-2 font-mono">
            <span className="text-text-3">End:</span> {formatDate(project.endDate)}
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setProjectDetailTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium text-center min-h-[44px] transition-colors ${
              projectDetailTab === tab.key
                ? 'text-amber border-b-2 border-amber'
                : 'text-text-3 hover:text-text-1'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {projectDetailTab === 'crew' && (
          <ProjectCrew
            workers={project.assignedWorkers ?? []}
            projectId={projectId}
            onRemoved={refetch}
          />
        )}
        {projectDetailTab === 'trucks' && (
          <ProjectTrucks
            trucks={project.assignedTrucks ?? []}
            projectId={projectId}
            onRemoved={refetch}
          />
        )}
        {projectDetailTab === 'notes' && (
          <ProjectNotes projectId={projectId} />
        )}
      </div>
    </div>
  );
}
