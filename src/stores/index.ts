// DispatchHub — Client State (Zustand)
// Lightweight client-side state for UI concerns
// Server data lives in React Query / SWR — this is for UI-only state

import { create } from 'zustand';

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
