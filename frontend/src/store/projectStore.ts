import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectStoreState {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProjectId: (id) => set({ activeProjectId: id }),
    }),
    {
      name: 'project-store',
      partialize: (state) => ({ activeProjectId: state.activeProjectId }),
    },
  ),
);
