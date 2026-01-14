'use client';

import { create } from 'zustand';
import { AUTH_CONFIG } from '@/lib/shared/config';

// Lock timeout should be shorter than logout timeout
// Default: 5 minutes (same as inactivity timeout, but can be different)
const LOCK_TIMEOUT_MINUTES = parseInt(
  process.env.NEXT_PUBLIC_LOCK_TIMEOUT_MINUTES || 
  process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES || 
  '5',
  10
);
export const LOCK_TIMEOUT_MS = LOCK_TIMEOUT_MINUTES * 60 * 1000;

export type LockReason = 'manual' | 'inactivity' | null;

interface LockState {
  isLocked: boolean;
  lockReason: LockReason;
  lastActivityAt: number | null;
  
  // Actions
  lock: (reason?: LockReason) => void;
  unlock: () => void;
  updateActivity: () => void;
  checkAutoLock: () => void;
}

// Get initial lock state from sessionStorage (clears on refresh per requirement)
function getInitialLockState(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = sessionStorage.getItem('seri-app-locked');
  return stored === 'true';
}

export const useLockStore = create<LockState>((set, get) => ({
  isLocked: getInitialLockState(),
  lockReason: null,
  lastActivityAt: typeof window !== 'undefined' ? Date.now() : null,

  lock: (reason: LockReason = 'manual') => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('seri-app-locked', 'true');
    }
    set({ 
      isLocked: true, 
      lockReason: reason,
      lastActivityAt: Date.now(),
    });
  },

  unlock: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('seri-app-locked');
    }
    set({ 
      isLocked: false, 
      lockReason: null,
      lastActivityAt: Date.now(),
    });
  },

  updateActivity: () => {
    set({ lastActivityAt: Date.now() });
  },

  checkAutoLock: () => {
    const state = get();
    if (state.isLocked) return; // Already locked
    
    if (!state.lastActivityAt) {
      // No activity recorded, initialize
      set({ lastActivityAt: Date.now() });
      return;
    }

    const timeSinceActivity = Date.now() - state.lastActivityAt;
    
    if (timeSinceActivity >= LOCK_TIMEOUT_MS) {
      // Auto-lock due to inactivity
      get().lock('inactivity');
    }
  },
}));

