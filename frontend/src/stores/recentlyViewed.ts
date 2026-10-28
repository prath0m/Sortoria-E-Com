import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface RecentlyViewedState {
  ids: number[];
  add: (id: number) => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      ids: [],
      add: (id) => set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, 12) })),
    }),
    { name: 'sartoria-recently-viewed', storage: createJSONStorage(() => localStorage) },
  ),
);
