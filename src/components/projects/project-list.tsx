'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useProjects } from '@/hooks';
import { ProjectCard } from './project-card';
import type { DemoProject, ProjectPhase } from '@/types';

type FilterKey = 'active' | 'upcoming' | 'past';

const FILTER_PHASES: Record<FilterKey, ProjectPhase[]> = {
  active: ['ACTIVE_DEMO', 'CARTING', 'CLEANUP'],
  upcoming: ['PLANNING'],
  past: ['COMPLETE'],
};

interface ProjectListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProjectList({ selectedId, onSelect }: ProjectListProps) {
  const { data: projects, loading } = useProjects();
  const [filter, setFilter] = useState<FilterKey>('active');
  const [search, setSearch] = useState('');

  const allProjects = projects ?? [];
  const searchLower = search.toLowerCase();

  const filtered = allProjects
    .filter((p: DemoProject) => FILTER_PHASES[filter].includes(p.phase))
    .filter((p: DemoProject) =>
      !search ||
      p.name.toLowerCase().includes(searchLower) ||
      p.address.toLowerCase().includes(searchLower) ||
      p.customer.toLowerCase().includes(searchLower)
    );

  const counts = {
    active: allProjects.filter((p: DemoProject) => FILTER_PHASES.active.includes(p.phase)).length,
    upcoming: allProjects.filter((p: DemoProject) => FILTER_PHASES.upcoming.includes(p.phase)).length,
    past: allProjects.filter((p: DemoProject) => FILTER_PHASES.past.includes(p.phase)).length,
  };

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'upcoming', label: `Upcoming (${counts.upcoming})` },
    { key: 'past', label: `Past (${counts.past})` },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Search */}
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-10 pl-8 pr-3 rounded bg-surface-1 border border-border text-text-0 text-sm placeholder:text-text-3 focus:outline-none focus:border-amber"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pb-2 shrink-0">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium min-h-[36px] transition-colors ${
              filter === f.key
                ? 'bg-amber/15 text-amber'
                : 'bg-surface-2 text-text-3 hover:text-text-1'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Project cards */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {loading && (
          <p className="text-text-3 text-sm text-center py-8">Loading projects...</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-text-3 text-sm text-center py-8">
            {search ? 'No matches found.' : 'No projects in this category.'}
          </p>
        )}
        {filtered.map((project: DemoProject) => (
          <ProjectCard
            key={project.id}
            project={project}
            selected={project.id === selectedId}
            onClick={() => onSelect(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
