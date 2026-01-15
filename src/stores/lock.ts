'use client';

import { create } from 'zustand';
import { AUTH_COMPUTED } from '@/lib/shared/config';

// Use unified timeout from AUTH_CONFIG (single source of truth)
export const LOCK_TIMEOUT_MS = AUTH_COMPUTED.INACTIVITY_TIMEOUT_MS;

export type LockReason = 'manual' | 'inactivity' | null;

interface LockState {
  isLocked: boolean;
  lockReason: LockReason;
  _hasHydrated: boolean;

  // Actions
  lock: (reason?: LockReason) => void;
  unlock: () => void;
  setHasHydrated: (state: boolean) => void;
}

// Initial lock state is always false - page refresh should clear the lock
// The lock is only meant to persist during SPA navigation, not across refreshes
function getInitialLockState(): boolean {
  // Always start unlocked on page load/refresh
  // Clear any stale lock state from sessionStorage
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('seri-app-locked');
  }
  return false;
}

export const useLockStore = create<LockState>((set) => ({
  isLocked: getInitialLockState(),
  lockReason: null,
  _hasHydrated: false,

  setHasHydrated: (state) => {
    set({ _hasHydrated: state });
  },

  lock: (reason: LockReason = 'manual') => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('seri-app-locked', 'true');
    }
    set({
      isLocked: true,
      lockReason: reason,
    });
  },

  unlock: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('seri-app-locked');
    }
    set({
      isLocked: false,
      lockReason: null,
    });
  },
}));

