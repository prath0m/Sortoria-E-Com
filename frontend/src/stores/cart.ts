import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Guest cart, kept in localStorage. Prices here are display hints only; every total shown to the
 * shopper comes from the server's pricing engine. Signed-in carts live on the server.
 */
export interface CartLine {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  brand: string | null;
  variantLabel: string;
  image: string | null;
  pricePaise: number;
  mrpPaise: number;
  quantity: number;
  maxQuantity: number;
  savedForLater: boolean;
}

export const MAX_PER_LINE = 10;

interface CartState {
  lines: CartLine[];
  drawerOpen: boolean;
  /** Bumped on every add so the fly-to-cart animation and badge can react. */
  lastAddedAt: number;
  add: (line: Omit<CartLine, 'quantity' | 'savedForLater'>, quantity?: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  setSaved: (variantId: number, saved: boolean) => void;
  clear: () => void;
  setDrawerOpen: (open: boolean) => void;
}

const clampQty = (qty: number, max: number) => Math.max(1, Math.min(qty, Math.min(max, MAX_PER_LINE)));

export const useGuestCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      drawerOpen: false,
      lastAddedAt: 0,
      add: (line, quantity = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.variantId === line.variantId);
          const lines = existing
            ? s.lines.map((l) =>
                l.variantId === line.variantId
                  ? { ...l, ...line, savedForLater: false, quantity: clampQty(l.quantity + quantity, line.maxQuantity) }
                  : l,
              )
            : [...s.lines, { ...line, savedForLater: false, quantity: clampQty(quantity, line.maxQuantity) }];
          return { lines, lastAddedAt: Date.now() };
        }),
      setQuantity: (variantId, quantity) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: clampQty(quantity, l.maxQuantity) } : l)),
        })),
      remove: (variantId) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),
      setSaved: (variantId, saved) =>
        set((s) => ({ lines: s.lines.map((l) => (l.variantId === variantId ? { ...l, savedForLater: saved } : l)) })),
      clear: () => set({ lines: [] }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: 'sartoria-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

export const activeLines = (lines: CartLine[]) => lines.filter((l) => !l.savedForLater);
export const itemCount = (lines: CartLine[]) => activeLines(lines).reduce((n, l) => n + l.quantity, 0);
