import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Guest wishlist: product ids in localStorage, merged into the account on sign-in. */
interface WishlistState {
  ids: number[];
  toggle: (id: number) => boolean;
  clear: () => void;
}

export const useGuestWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const has = get().ids.includes(id);
        set({ ids: has ? get().ids.filter((x) => x !== id) : [id, ...get().ids] });
        return !has;
      },
      clear: () => set({ ids: [] }),
    }),
    { name: 'sartoria-wishlist', storage: createJSONStorage(() => localStorage) },
  ),
);
