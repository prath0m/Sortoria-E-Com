import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Delivery and coupon choices that shape the quote. Remembered between visits. */
interface PrefsState {
  pincode: string;
  shippingMethod: string;
  guestCoupon: string;
  setPincode: (pincode: string) => void;
  setShippingMethod: (method: string) => void;
  setGuestCoupon: (code: string) => void;
}

export const useCheckoutPrefs = create<PrefsState>()(
  persist(
    (set) => ({
      pincode: '',
      shippingMethod: 'standard',
      guestCoupon: '',
      setPincode: (pincode) => set({ pincode }),
      setShippingMethod: (shippingMethod) => set({ shippingMethod }),
      setGuestCoupon: (guestCoupon) => set({ guestCoupon }),
    }),
    { name: 'sartoria-checkout-prefs', storage: createJSONStorage(() => localStorage) },
  ),
);
