// DispatchHub — Client State (Zustand)
// Lightweight client-side state for UI concerns
// Server data lives in React Query / SWR — this is for UI-only state

import { create } from 'zustand';
import type { PreviewAssignment } from '@/types';

interface DispatchStore {
  selectedDate: string;                     // Current dispatch date (YYYY-MM-DD)
  setSelectedDate: (date: string) => void;
  selectedJobId: string | null;             // Job dashboard modal
  setSelectedJobId: (id: string | null) => void;
  micActive: boolean;                       // Voice dispatch recording
  setMicActive: (active: boolean) => void;
}

export const useDispatchStore = create<DispatchStore>((set) => ({
  selectedDate: new Date().toISOString().split('T')[0],
  setSelectedDate: (date) => set({ selectedDate: date }),
  selectedJobId: null,
  setSelectedJobId: (id) => set({ selectedJobId: id }),
  micActive: false,
  setMicActive: (active) => set({ micActive: active }),
}));


interface UiStore {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;
  showChangeLog: boolean;
  setShowChangeLog: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeTab: 'dispatch',
  setActiveTab: (tab) => set({ activeTab: tab }),
  showSearch: false,
  setShowSearch: (show) => set({ showSearch: show }),
  showChangeLog: false,
  setShowChangeLog: (show) => set({ showChangeLog: show }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

// ── PREVIEW / SANDBOX (intake assignment experiments, nothing persists until Confirm) ──

interface PreviewStore {
  previews: Record<string, PreviewAssignment>;
  activePreviewId: string | null;
  setPreview: (intakeItemId: string, updates: Partial<PreviewAssignment>) => void;
  clearPreview: (intakeItemId: string) => void;
  clearAllPreviews: () => void;
  setActivePreview: (intakeItemId: string | null) => void;
  getOtherPreviews: (excludeId: string) => { intakeItemId: string; truckId: string; driverId: string; workerIds: string[]; time: string }[];
}

const defaultPreview = (intakeItemId: string): PreviewAssignment => ({
  intakeItemId,
  truckId: null,
  driverId: null,
  workerIds: [],
  timeOverride: null,
  containerSize: null,
  analysis: null,
  analysisLoading: false,
});

export const usePreviewStore = create<PreviewStore>((set, get) => ({
  previews: {},
  activePreviewId: null,

  setPreview: (intakeItemId, updates) =>
    set((state) => ({
      previews: {
        ...state.previews,
        [intakeItemId]: {
          ...(state.previews[intakeItemId] ?? defaultPreview(intakeItemId)),
          ...updates,
        },
      },
    })),

  clearPreview: (intakeItemId) =>
    set((state) => {
      const next = { ...state.previews };
      delete next[intakeItemId];
      return {
        previews: next,
        activePreviewId: state.activePreviewId === intakeItemId ? null : state.activePreviewId,
      };
    }),

  clearAllPreviews: () => set({ previews: {}, activePreviewId: null }),

  setActivePreview: (intakeItemId) => set({ activePreviewId: intakeItemId }),

  getOtherPreviews: (excludeId) => {
    const { previews } = get();
    return Object.values(previews)
      .filter(
        (p) =>
          p.intakeItemId !== excludeId &&
          p.truckId != null &&
          p.driverId != null
      )
      .map((p) => ({
        intakeItemId: p.intakeItemId,
        truckId: p.truckId!,
        driverId: p.driverId!,
        workerIds: p.workerIds ?? [],
        time: p.timeOverride ?? '',
      }));
  },
}));
