import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface UIStore {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarOpen: true,
      sidebarCollapsed: false,

      setTheme: (theme) => set({ theme }),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      toggleSidebarCollapse: () =>
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        })),
    }),
    {
      name: "acmp-ui-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
