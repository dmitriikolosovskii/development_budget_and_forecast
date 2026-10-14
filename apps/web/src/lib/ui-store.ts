import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Project tabs that remember their last sub-section. */
export type SectionTab = 'materials' | 'construction' | 'marketing';

export interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  lastSection: Partial<Record<SectionTab, string>>;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setLastSection: (tab: SectionTab, section: string) => void;
}

/** Client-only UI state (never server data). `mobileNavOpen` is not persisted. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      lastSection: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setLastSection: (tab, section) =>
        set((s) => ({ lastSection: { ...s.lastSection, [tab]: section } })),
    }),
    {
      name: 'kairon-ui',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, lastSection: s.lastSection }),
    },
  ),
);
