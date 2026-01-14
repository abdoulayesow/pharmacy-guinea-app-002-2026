'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

// Inactivity timeout in milliseconds (5 minutes)
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  lastActivityAt: number | null; // Timestamp of last user activity
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  login: (user: User) => void;
  logout: () => void;
  updateActivity: () => void; // Update last activity timestamp
  isInactive: () => boolean; // Check if user has been inactive > 5 min
  incrementFailedAttempts: () => void;
  resetFailedAttempts: () => void;
  isLocked: () => boolean;
  clearExpiredLock: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastActivityAt: null,
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      login: (user) =>
        set({
          currentUser: user,
          isAuthenticated: true,
          failedAttempts: 0,
          lockedUntil: null,
          lastActivityAt: Date.now(),
        }),

      logout: () =>
        set({
          currentUser: null,
          isAuthenticated: false,
          lastActivityAt: null,
        }),

      updateActivity: () => {
        set({ lastActivityAt: Date.now() });
      },

      isInactive: () => {
        const { lastActivityAt } = get();
        if (!lastActivityAt) return true;
        return Date.now() - lastActivityAt > INACTIVITY_TIMEOUT_MS;
      },

      incrementFailedAttempts: () => {
        const newAttempts = get().failedAttempts + 1;
        // Lock after 5 failed attempts for 30 minutes
        if (newAttempts >= 5) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + 30);
          set({
            failedAttempts: newAttempts,
            lockedUntil: lockUntil,
          });
        } else {
          set({ failedAttempts: newAttempts });
        }
      },

      resetFailedAttempts: () =>
        set({
          failedAttempts: 0,
          lockedUntil: null,
        }),

      isLocked: () => {
        const { lockedUntil } = get();
        if (!lockedUntil) return false;
        // Just check if locked - don't reset state here (causes React render issues)
        return new Date() <= new Date(lockedUntil);
      },

      clearExpiredLock: () => {
        const { lockedUntil } = get();
        if (lockedUntil && new Date() > new Date(lockedUntil)) {
          set({ lockedUntil: null, failedAttempts: 0 });
        }
      },
    }),
    {
      name: 'seri-auth',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
        lastActivityAt: state.lastActivityAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
