'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuthStore, INACTIVITY_TIMEOUT_MS } from '@/stores/auth';

/**
 * Hook to monitor user activity and redirect to login after inactivity.
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
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Throttled activity update (max once per 30 seconds to reduce store updates)
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 30 * 1000;

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > THROTTLE_MS) {
      lastUpdateRef.current = now;
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

  // Check for inactivity and redirect
  useEffect(() => {
    // Only check if user has Google session
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    const checkInactivity = () => {
      if (!lastActivityAt) return;

      const timeSinceActivity = Date.now() - lastActivityAt;

      if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
        // User has been inactive for > 5 minutes
        // Logout from Zustand (requires PIN re-entry) but keep Google session
        logout();
        router.push('/login');
      }
    };

    // Check every 30 seconds
    checkIntervalRef.current = setInterval(checkInactivity, 30 * 1000);

    // Initial check
    checkInactivity();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [status, session, lastActivityAt, logout, router]);
}
