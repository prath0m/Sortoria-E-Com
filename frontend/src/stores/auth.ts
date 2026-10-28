import { create } from 'zustand';
import { api, onSessionChange, refreshSession, setAccessToken } from '@/api/client';
import type { AuthResponse, User } from '@/api/types';

type Status = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  user: User | null;
  status: Status;
  /** Restore a session from the refresh cookie on page load. */
  bootstrap: () => Promise<void>;
  setSession: (data: AuthResponse) => void;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
}

const loginListeners = new Set<(user: User) => void>();

/** Runs after any sign-in (used to merge the guest cart and wishlist into the account). */
export function onLogin(listener: (user: User) => void) {
  loginListeners.add(listener);
  return () => loginListeners.delete(listener);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'unknown',

  bootstrap: async () => {
    if (get().status !== 'unknown') return;
    if (!document.cookie.split('; ').some((c) => c.startsWith('sartoria_has_session='))) {
      set({ status: 'anonymous' });
      return;
    }
    const data = await refreshSession<User>().catch(() => null);
    if (data) {
      setAccessToken(data.access);
      set({ user: data.user, status: 'authenticated' });
    } else {
      set({ status: 'anonymous' });
    }
  },

  setSession: ({ access, user }) => {
    setAccessToken(access);
    set({ user, status: 'authenticated' });
    loginListeners.forEach((fn) => fn(user));
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await api('/auth/logout/', { method: 'POST', noRetry: true }).catch(() => undefined);
    setAccessToken(null);
    set({ user: null, status: 'anonymous' });
  },
}));

onSessionChange((token) => {
  if (!token && useAuth.getState().status === 'authenticated') {
    useAuth.setState({ user: null, status: 'anonymous' });
  }
});

export const isStaff = (user: User | null) => user?.role === 'admin' || user?.role === 'manager';
