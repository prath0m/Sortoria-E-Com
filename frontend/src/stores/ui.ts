import { create } from 'zustand';

interface UIState {
  searchOpen: boolean;
  mobileNavOpen: boolean;
  quickViewSlug: string | null;
  setSearchOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  openQuickView: (slug: string) => void;
  closeQuickView: () => void;
}

export const useUI = create<UIState>((set) => ({
  searchOpen: false,
  mobileNavOpen: false,
  quickViewSlug: null,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  openQuickView: (quickViewSlug) => set({ quickViewSlug }),
  closeQuickView: () => set({ quickViewSlug: null }),
}));
