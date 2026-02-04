'use client';

import { useEffect, useRef } from 'react';
import { useCommandCenterStore } from '@/stores';
import { useRoutes } from '@/hooks';
import { RouteMap } from './route-map';
import { ResourceCards } from './resource-cards';

export interface CommandCenterProps {
  selectedDate: string;
  onJobSelect: (jobId: string) => void;
  onApplied?: () => void;
}

export function CommandCenter({ selectedDate, onJobSelect, onApplied }: CommandCenterProps) {
  const { data: routesData, refetch: refetchRoutes } = useRoutes(selectedDate);
  const routes = routesData ?? [];
  const highlightedJobId = useCommandCenterStore((s) => s.highlightedJobId);
  const prevJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (highlightedJobId && highlightedJobId !== prevJobIdRef.current) {
      prevJobIdRef.current = highlightedJobId;
      onJobSelect(highlightedJobId);
    } else if (!highlightedJobId) {
      prevJobIdRef.current = null;
    }
  }, [highlightedJobId, onJobSelect]);

  const handleApplied = () => {
    refetchRoutes();
    onApplied?.();
  };

  return (
    <div className="flex flex-col h-full bg-surface-0 border-l border-border min-w-0">
      <div className="flex-[1_1_50%] min-h-0 shrink-0 p-3">
        <RouteMap routes={routes} selectedDate={selectedDate} />
      </div>
      <div className="flex-shrink-0 p-3 pt-0">
        <ResourceCards routes={routes} />
      </div>
    </div>
  );
}
