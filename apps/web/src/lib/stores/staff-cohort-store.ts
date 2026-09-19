import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface Cohort {
  id: string;
  name: string;
}

interface StaffCohortStore {
  // Global cohort selection (persisted in localStorage)
  globalCohortId: string | null;
  globalCohort: Cohort | null;
  
  // Available cohorts (populated from API)
  cohorts: Cohort[];
  
  // Actions
  setGlobalCohort: (cohort: Cohort | null) => void;
  setGlobalCohortById: (cohortId: string | null) => void;
  setCohorts: (cohorts: Cohort[]) => void;
  
  // Initialize global cohort from available cohorts (e.g., pick first if none selected)
  initializeGlobalCohort: () => void;
}

export const useStaffCohortStore = create<StaffCohortStore>()(
  persist(
    (set, get) => ({
      globalCohortId: null,
      globalCohort: null,
      cohorts: [],

      setGlobalCohort: (cohort) =>
        set({
          globalCohort: cohort,
          globalCohortId: cohort?.id || null,
        }),

      setGlobalCohortById: (cohortId) => {
        const { cohorts } = get();
        const cohort = cohorts.find((c) => c.id === cohortId) || null;
        set({
          globalCohortId: cohortId,
          globalCohort: cohort,
        });
      },

      setCohorts: (cohorts) => {
        const { globalCohortId } = get();
        // Update globalCohort reference if we have a stored ID
        const globalCohort = globalCohortId
          ? cohorts.find((c) => c.id === globalCohortId) || null
          : null;
        set({ cohorts, globalCohort });
      },

      initializeGlobalCohort: () => {
        const { cohorts, globalCohortId, globalCohort } = get();
        
        // If we already have a valid global cohort, do nothing
        if (globalCohort && cohorts.some((c) => c.id === globalCohort.id)) {
          return;
        }
        
        // If we have a stored ID but no cohort object, try to find it
        if (globalCohortId && !globalCohort) {
          const found = cohorts.find((c) => c.id === globalCohortId);
          if (found) {
            set({ globalCohort: found });
            return;
          }
        }
        
        // Otherwise, default to the first cohort
        if (cohorts.length > 0) {
          set({
            globalCohort: cohorts[0],
            globalCohortId: cohorts[0].id,
          });
        }
      },
    }),
    {
      name: "acmp-staff-cohort-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist the cohort ID, not the full object or list
      partialize: (state) => ({
        globalCohortId: state.globalCohortId,
      }),
    }
  )
);
