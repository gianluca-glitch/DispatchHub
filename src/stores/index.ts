// DispatchHub — Client State (Zustand)
// Lightweight client-side state for UI concerns
// Server data lives in React Query / SWR — this is for UI-only state

import { create } from 'zustand';
import type { PreviewAssignment, ScenarioInput, ScenarioResult } from '@/types';

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

// ── COMMAND CENTER (dispatch scenario + route display) ──

interface CommandCenterStore {
  selectedTruckRoutes: string[];
  highlightedJobId: string | null;
  showAllRoutes: boolean;

  activeScenario: ScenarioInput | null;
  scenarioResult: ScenarioResult | null;
  scenarioLoading: boolean;
  scenarioHistory: { input: ScenarioInput; result: ScenarioResult }[];
  showFloatingScenario: boolean;

  selectedCards: { truckId: string | null; driverId: string | null; workerIds: string[] };
  previewJobId: string | null;

  setSelectedRoutes: (truckIds: string[]) => void;
  toggleRoute: (truckId: string) => void;
  setShowAllRoutes: (show: boolean) => void;
  setHighlightedJob: (jobId: string | null) => void;

  setScenario: (scenario: ScenarioInput | null) => void;
  setScenarioResult: (result: ScenarioResult | null) => void;
  setScenarioLoading: (loading: boolean) => void;
  setShowFloatingScenario: (show: boolean) => void;
  clearScenario: () => void;
  pushScenarioHistory: (input: ScenarioInput, result: ScenarioResult) => void;

  selectCard: (type: 'truck' | 'driver' | 'worker', id: string) => void;
  clearCards: () => void;
  setPreviewJob: (jobId: string | null) => void;

  reset: () => void;
}

const defaultCommandCenter = {
  selectedTruckRoutes: [] as string[],
  highlightedJobId: null as string | null,
  showAllRoutes: true,
  activeScenario: null as ScenarioInput | null,
  scenarioResult: null as ScenarioResult | null,
  scenarioLoading: false,
  scenarioHistory: [] as { input: ScenarioInput; result: ScenarioResult }[],
  showFloatingScenario: false,
  selectedCards: { truckId: null as string | null, driverId: null as string | null, workerIds: [] as string[] },
  previewJobId: null as string | null,
};

export const useCommandCenterStore = create<CommandCenterStore>((set, get) => ({
  ...defaultCommandCenter,

  setSelectedRoutes: (truckIds) => set({ selectedTruckRoutes: truckIds }),
  toggleRoute: (truckId) =>
    set((state) => ({
      selectedTruckRoutes: state.selectedTruckRoutes.includes(truckId)
        ? state.selectedTruckRoutes.filter((id) => id !== truckId)
        : [...state.selectedTruckRoutes, truckId],
    })),
  setShowAllRoutes: (show) => set({ showAllRoutes: show }),
  setHighlightedJob: (jobId) => set({ highlightedJobId: jobId }),

  setScenario: (scenario) => set({ activeScenario: scenario }),
  setScenarioResult: (result) => set({ scenarioResult: result }),
  setScenarioLoading: (loading) => set({ scenarioLoading: loading }),
  setShowFloatingScenario: (show) => set({ showFloatingScenario: show }),
  clearScenario: () =>
    set({
      scenarioResult: null,
      showFloatingScenario: false,
      activeScenario: null,
      scenarioLoading: false,
    }),
  pushScenarioHistory: (input, result) =>
    set((state) => ({
      scenarioHistory: [...state.scenarioHistory, { input, result }],
    })),

  selectCard: (type, id) =>
    set((state) => {
      const cards = { ...state.selectedCards };
      if (type === 'truck') {
        cards.truckId = id;
      } else if (type === 'driver') {
        cards.driverId = id;
      } else {
        cards.workerIds = cards.workerIds.includes(id)
          ? cards.workerIds.filter((w) => w !== id)
          : [...cards.workerIds, id];
      }
      return { selectedCards: cards };
    }),
  clearCards: () => set({ selectedCards: { truckId: null, driverId: null, workerIds: [] } }),
  setPreviewJob: (jobId) => set({ previewJobId: jobId }),

  reset: () => set(defaultCommandCenter),
}));
