// DispatchHub — Data Hooks
// Starter hooks using native fetch. Swap to React Query/SWR when ready.
// Import: import { useJobs, useWorkers, useTrucks } from '@/hooks';

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CartingJob, Worker, Truck, IntakeItem, DemoProject, ChangeLogEntry, Conflict } from '@/types';

// ── Generic fetcher ─────────────────────────────────────────

function useFetch<T>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { refetch(); }, [refetch, ...deps]);

  return { data, loading, error, refetch };
}

// ── Jobs ────────────────────────────────────────────────────

export function useJobs(date: string) {
  return useFetch<CartingJob[]>(`/api/jobs?date=${date}`, [date]);
}

export function useJob(id: string | null) {
  return useFetch<CartingJob>(id ? `/api/jobs/${id}` : '', [id]);
}

// ── Workers ─────────────────────────────────────────────────

export function useWorkers() {
  return useFetch<Worker[]>('/api/workers');
}

// ── Trucks ──────────────────────────────────────────────────

export function useTrucks() {
  return useFetch<Truck[]>('/api/trucks');
}

// ── Intake ──────────────────────────────────────────────────

export function useIntake() {
  return useFetch<IntakeItem[]>('/api/intake');
}

// ── Projects ────────────────────────────────────────────────

export function useProjects() {
  return useFetch<DemoProject[]>('/api/projects');
}

// ── Change Log ──────────────────────────────────────────────

export function useChangeLog(limit = 50) {
  return useFetch<ChangeLogEntry[]>(`/api/changelog?limit=${limit}`);
}

// ── Conflicts ───────────────────────────────────────────────

export function useConflicts(jobId: string | null, date: string) {
  return useFetch<Conflict[]>(
    jobId ? `/api/jobs/conflicts?jobId=${jobId}&date=${date}` : '',
    [jobId, date]
  );
}

// ── Global Search ───────────────────────────────────────────

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setResults(json.data ?? []);
      } finally {
        setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timeout);
  }, [query]);

  return { results, loading };
}
