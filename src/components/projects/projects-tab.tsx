'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useProjectStore } from '@/stores';
import { ProjectList } from './project-list';
import { ProjectDetail } from './project-detail';
import { ProjectChat } from './project-chat';

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

export function ProjectsTab() {
  const {
    selectedProjectId,
    projectDetailOpen,
    setSelectedProject,
    projectChatOpen,
    setProjectChatOpen,
  } = useProjectStore();

  const isMobile = useIsMobile();

  const handleSelectProject = (id: string) => {
    setSelectedProject(id);
  };

  const handleBack = () => {
    setSelectedProject(null);
  };

  // ── MOBILE LAYOUT ──────────────────────────────────────
  if (isMobile) {
    return (
      <div className="h-full flex flex-col relative">
        {/* Chat overlay on mobile */}
        {projectChatOpen && (
          <div className="absolute inset-0 z-30 bg-surface-0 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
              <span className="text-text-0 text-sm font-semibold">Project Brain</span>
              <button
                onClick={() => setProjectChatOpen(false)}
                className="p-2 rounded text-text-3 hover:text-text-0 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ProjectChat />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-h-0">
          {projectDetailOpen && selectedProjectId ? (
            <ProjectDetail projectId={selectedProjectId} onBack={handleBack} />
          ) : (
            <ProjectList selectedId={selectedProjectId} onSelect={handleSelectProject} />
          )}
        </div>

        {/* Floating chat button */}
        {!projectChatOpen && (
          <button
            onClick={() => setProjectChatOpen(true)}
            className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-amber text-black flex items-center justify-center shadow-lg hover:bg-amber/90 transition-colors"
            aria-label="Open Project Brain chat"
          >
            <MessageSquare size={22} />
          </button>
        )}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────
  return (
    <div className="h-full flex gap-0 overflow-hidden">
      {/* Left panel — project list (hidden when detail open) */}
      {!projectDetailOpen && (
        <div className="w-80 shrink-0 border-r border-border bg-surface-0 overflow-hidden">
          <ProjectList selectedId={selectedProjectId} onSelect={handleSelectProject} />
        </div>
      )}

      {/* Middle panel — project detail (shown when selected) */}
      {projectDetailOpen && selectedProjectId && (
        <div className="flex-1 min-w-0 border-r border-border bg-surface-0 overflow-hidden">
          <ProjectDetail projectId={selectedProjectId} onBack={handleBack} />
        </div>
      )}

      {/* Right panel — chat (always visible on desktop) */}
      <div className={`${projectDetailOpen ? 'w-96' : 'flex-1'} shrink-0 overflow-hidden`}>
        <ProjectChat />
      </div>
    </div>
  );
}
