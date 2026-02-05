// DispatchHub — Data Hooks (SWR with dedup)
// Import: import { useJobs, useWorkers, useTrucks } from '@/hooks';

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import type { CartingJob, Worker, Truck, IntakeItem, DemoProject, ChangeLogEntry, Conflict, TruckRoute } from '@/types';

const SWR_OPTIONS = {
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

// Routes API returns { data, routes, unassigned }
interface RoutesResponse {
  routes?: TruckRoute[];
  data?: TruckRoute[];
  unassigned?: Array<{ jobId: string; time: string; customer: string; address: string; borough: string }>;
}
async function routesFetcher(url: string): Promise<RoutesResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// ── Jobs ────────────────────────────────────────────────────

export function useJobs(date: string) {
  const key = date ? `/api/jobs?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR<CartingJob[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

export function useJob(id: string | null) {
  const key = id ? `/api/jobs/${id}` : null;
  const { data, error, isLoading, mutate } = useSWR<CartingJob>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Workers ─────────────────────────────────────────────────

export function useWorkers() {
  const key = '/api/workers';
  const { data, error, isLoading, mutate } = useSWR<Worker[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Trucks ──────────────────────────────────────────────────

export function useTrucks() {
  const key = '/api/trucks';
  const { data, error, isLoading, mutate } = useSWR<Truck[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Intake ───────────────────────────────────────────────────

export function useIntake() {
  const key = '/api/intake';
  const { data, error, isLoading, mutate } = useSWR<IntakeItem[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Projects ────────────────────────────────────────────────

export function useProjects() {
  const key = '/api/projects';
  const { data, error, isLoading, mutate } = useSWR<DemoProject[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Change Log ───────────────────────────────────────────────

export function useChangeLog(limit = 50) {
  const key = `/api/changelog?limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR<ChangeLogEntry[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Dispatch routes ──────────────────────────────────────────

export function useRoutes(date: string) {
  const key = date ? `/api/dispatch/routes?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR<RoutesResponse>(key, routesFetcher, SWR_OPTIONS);
  const routes = data?.routes ?? data?.data ?? [];
  const unassigned = data?.unassigned ?? [];
  return {
    data: Array.isArray(routes) ? routes : [],
    unassigned: Array.isArray(unassigned) ? unassigned : [],
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

// ── Conflicts ────────────────────────────────────────────────

export function useConflicts(jobId: string | null, date: string) {
  const key = jobId && date ? `/api/jobs/conflicts?jobId=${jobId}&date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR<Conflict[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
}

/** Schedule-wide conflicts for a date (no jobId). Used by dispatch sidebar. */
export function useScheduleConflicts(date: string) {
  const key = date ? `/api/jobs/conflicts?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR<Conflict[]>(key, fetcher, SWR_OPTIONS);
  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? String(error) : null,
    refetch: mutate,
  };
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
