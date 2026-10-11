// ============================================
// FARMSHIFT — AUTH STORE
// Mirrors the session kept in localStorage (see services/api.ts) for UI components.
// The app works fully without signing in; accounts only add saved plans.
// ============================================

import { create } from 'zustand';
import { AUTH_EVENT, fetchMe, hasSessionHint, signOut as apiSignOut, type AccountUser } from '@/services/api';

interface AuthState {
  user: AccountUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (user: AccountUser | null) => void;
  signOut: (everywhere?: boolean) => Promise<void>;
}

let listening = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  hydrate: async () => {
    if (typeof window !== 'undefined' && !listening) {
      listening = true;
      // api.ts announces sign-out / expiry; keep the UI in step.
      window.addEventListener(AUTH_EVENT, () => {
        if (!hasSessionHint()) set({ user: null });
      });
    }
    if (get().hydrated) return;
    if (!hasSessionHint()) {
      set({ hydrated: true });
      return;
    }
    try {
      set({ user: await fetchMe(), hydrated: true });
    } catch {
      set({ user: null, hydrated: true });
    }
  },
  signOut: async (everywhere = false) => {
    await apiSignOut(everywhere);
    set({ user: null });
  },
}));
