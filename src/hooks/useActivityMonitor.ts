'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuthStore, INACTIVITY_TIMEOUT_MS } from '@/stores/auth';
import { useLockStore, LOCK_TIMEOUT_MS } from '@/stores/lock';

// Check interval increased to 60s for better battery life on mobile
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Hook to monitor user activity and redirect to login after inactivity.
 *
 * Optimizations for mobile battery life:
 * - Uses visibility API to pause checks when tab is hidden
 * - 60-second check interval instead of 30 seconds
 * - Throttled activity updates (max once per 30 seconds)
 *
 * Flow:
 * - Tracks user interactions (clicks, key presses, touches, scrolls)
 * - Updates lastActivityAt in Zustand store on activity
 * - Redirects to /login after 5 minutes of inactivity (PIN re-entry required)
 * - Only active when user has a valid Google OAuth session
 */
export function useActivityMonitor() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { updateActivity, logout, lastActivityAt } = useAuthStore();
  const { isLocked, lock, updateActivity: updateLockActivity, checkAutoLock } = useLockStore();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  // Throttled activity update (max once per 30 seconds to reduce store updates)
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 30 * 1000;

  const checkInactivity = useCallback(() => {
    if (!lastActivityAt) return;

    const timeSinceActivity = Date.now() - lastActivityAt;

    // First, check if we should auto-lock (shorter timeout)
    if (!isLocked && timeSinceActivity >= LOCK_TIMEOUT_MS) {
      // Auto-lock due to inactivity
      lock('inactivity');
      return;
    }

    // Then check if we should logout (longer timeout)
    if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
      // User has been inactive for > logout timeout
      // Logout from Zustand (requires PIN re-entry) but keep Google session
      logout();
      router.push('/login');
    }
  }, [lastActivityAt, logout, router, isLocked, lock]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > THROTTLE_MS) {
      lastUpdateRef.current = now;
      updateActivity();
      // Also update lock store activity (for auto-lock timing)
      updateLockActivity();
    }
  }, [updateActivity, updateLockActivity]);

  // Set up activity listeners
  useEffect(() => {
    // Only monitor if user has Google session
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    // Initialize activity on mount
    updateActivity();
    updateLockActivity();

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [status, session, handleActivity, updateActivity]);

  // Handle visibility changes for battery optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      
      // When tab becomes visible, check inactivity immediately
      if (isVisibleRef.current) {
        checkInactivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkInactivity]);

  // Check for inactivity and redirect
  useEffect(() => {
    // Only check if user has Google session
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    // Check every 60 seconds (only when visible for battery optimization)
    checkIntervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        checkInactivity();
      }
    }, CHECK_INTERVAL_MS);

    // Initial check
    checkInactivity();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [status, session, checkInactivity]);
}
