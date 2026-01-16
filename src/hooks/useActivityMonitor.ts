'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthStore, INACTIVITY_TIMEOUT_MS } from '@/stores/auth';
import { useLockStore } from '@/stores/lock';

// Check interval increased to 60s for better battery life on mobile
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Hook to monitor user activity and trigger lock after inactivity.
 *
 * Optimizations for mobile battery life:
 * - Uses visibility API to pause checks when tab is hidden
 * - 60-second check interval instead of 30 seconds
 * - Throttled activity updates (max once per 30 seconds)
 *
 * Flow:
 * - Tracks user interactions (clicks, key presses, touches, scrolls)
 * - Updates lastActivityAt in auth store (single source of truth)
 * - Triggers lock('inactivity') after 5 minutes of inactivity
 * - AppLockGuard handles the redirect to /login for PIN re-entry
 * - Only active when user has a valid Google OAuth session
 */
export function useActivityMonitor() {
  const { data: session, status } = useSession();
  const { updateActivity, lastActivityAt } = useAuthStore();
  const { isLocked, lock } = useLockStore();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  // Throttled activity update (max once per 30 seconds to reduce store updates)
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 30 * 1000;

  const checkInactivity = useCallback(() => {
    // Don't check if no activity recorded yet (fresh session)
    if (!lastActivityAt) return;

    const timeSinceActivity = Date.now() - lastActivityAt;

    // Check if we should trigger inactivity lock (redirects to login via AppLockGuard)
    if (!isLocked && timeSinceActivity >= INACTIVITY_TIMEOUT_MS) {
      // Auto-lock due to inactivity
      // AppLockGuard will handle the redirect to login page for PIN re-entry
      lock('inactivity');
    }
  }, [lastActivityAt, isLocked, lock]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > THROTTLE_MS) {
      lastUpdateRef.current = now;
      // Update auth store only (single source of truth for activity)
      updateActivity();
    }
  }, [updateActivity]);

  // Set up activity listeners
  useEffect(() => {
    // Only monitor if user has Google session
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    // Initialize activity on mount
    updateActivity();

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
