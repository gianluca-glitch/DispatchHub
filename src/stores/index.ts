// DispatchHub — Client State (Zustand)
// Lightweight client-side state for UI concerns
// Server data lives in React Query / SWR — this is for UI-only state

import { create } from 'zustand';
import type { PreviewAssignment, ScenarioInput, ScenarioResult, JobAnalysis, JobAnalysisFeedEntry } from '@/types';

export type SidebarMessage = {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'scenario' | 'update' | 'query';
  data?: unknown;
};

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

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarMessages: SidebarMessage[];
  addSidebarMessage: (msg: SidebarMessage) => void;
  clearSidebarMessages: () => void;

  activeScenario: ScenarioInput | null;
  scenarioResult: ScenarioResult | null;
  scenarioLoading: boolean;
  scenarioHistory: { input: ScenarioInput; result: ScenarioResult }[];
  showFloatingScenario: boolean;
  dispatchRefetchTrigger: number;
  triggerDispatchRefetch: () => void;

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

  jobAnalysis: JobAnalysis | null;
  jobAnalysisLoading: boolean;
  jobAnalysisFeed: JobAnalysisFeedEntry[];
  setJobAnalysis: (a: JobAnalysis | null) => void;
  setJobAnalysisLoading: (loading: boolean) => void;
  addToJobAnalysisFeed: (entry: JobAnalysisFeedEntry) => void;
  clearJobAnalysis: () => void;

  modifiedFields: Record<string, any>;
  setModifiedField: (field: string, value: any) => void;
  clearModifiedFields: () => void;

  reset: () => void;
}

const defaultCommandCenter = {
  selectedTruckRoutes: [] as string[],
  highlightedJobId: null as string | null,
  showAllRoutes: true,
  sidebarOpen: true,
  sidebarMessages: [] as SidebarMessage[],
  activeScenario: null as ScenarioInput | null,
  scenarioResult: null as ScenarioResult | null,
  scenarioLoading: false,
  scenarioHistory: [] as { input: ScenarioInput; result: ScenarioResult }[],
  showFloatingScenario: false,
  dispatchRefetchTrigger: 0,
  selectedCards: { truckId: null as string | null, driverId: null as string | null, workerIds: [] as string[] },
  previewJobId: null as string | null,

  jobAnalysis: null as JobAnalysis | null,
  jobAnalysisLoading: false,
  jobAnalysisFeed: [] as JobAnalysisFeedEntry[],

  modifiedFields: {} as Record<string, any>,
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

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  addSidebarMessage: (msg) =>
    set((state) => ({ sidebarMessages: [...state.sidebarMessages, msg] })),
  clearSidebarMessages: () => set({ sidebarMessages: [] }),

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
  triggerDispatchRefetch: () =>
    set((state) => ({ dispatchRefetchTrigger: state.dispatchRefetchTrigger + 1 })),
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

  setJobAnalysis: (jobAnalysis) => set({ jobAnalysis }),
  setJobAnalysisLoading: (jobAnalysisLoading) => set({ jobAnalysisLoading }),
  addToJobAnalysisFeed: (entry) =>
    set((state) => ({ jobAnalysisFeed: [...state.jobAnalysisFeed, entry] })),
  clearJobAnalysis: () =>
    set({ jobAnalysis: null, jobAnalysisFeed: [], jobAnalysisLoading: false }),

  setModifiedField: (field, value) =>
    set((state) => ({
      modifiedFields: { ...state.modifiedFields, [field]: value },
    })),
  clearModifiedFields: () => set({ modifiedFields: {} }),

  reset: () => set(defaultCommandCenter),
}));
