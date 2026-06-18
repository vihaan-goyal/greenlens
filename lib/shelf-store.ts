import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * "Your shelf" — the products you've actually looked up, newest first, kept in
 * localStorage so the shelf survives reloads. This is *history*, not a rating:
 * it stores only product ids; everything shown (scores, alternatives) is still
 * recomputed from the repository at read time, never persisted (CLAUDE.md).
 */
interface ShelfState {
  /** Canonical product ids, most-recently-viewed first. */
  ids: string[];
  /** Flips true once persisted state has rehydrated on the client, so the UI
   *  can avoid a flash of the empty/SSR shelf before localStorage loads. */
  hydrated: boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const MAX_SHELF = 24;

export const useShelf = create<ShelfState>()(
  persist(
    (set) => ({
      ids: [],
      hydrated: false,
      add: (id) =>
        set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, MAX_SHELF) })),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'greenlens.shelf',
      // Persist only the list; `hydrated` is a runtime flag, not stored.
      partialize: (s) => ({ ids: s.ids }),
      onRehydrateStorage: () => () => {
        // Runs after localStorage has loaded; mark hydrated reactively so
        // subscribed components re-render out of the SSR/empty state.
        useShelf.setState({ hydrated: true });
      },
    },
  ),
);
