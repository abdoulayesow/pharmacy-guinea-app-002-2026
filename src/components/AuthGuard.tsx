'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/auth';
import { useLockStore } from '@/stores/lock';
import { useActivityMonitor } from '@/hooks/useActivityMonitor';
import { Logo } from '@/components/Logo';
import { performFirstTimeSync } from '@/lib/client/sync';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component that:
 * 1. Monitors user activity (clicks, keystrokes, etc.)
 * 2. Redirects to login after 5 minutes of inactivity
 * 3. Ensures user is authenticated (either via Google OAuth or PIN)
 * 4. Syncs NextAuth session to Zustand store for consistency
 * 5. Forces PIN change if user has default PIN (mustChangePin flag)
 *
 * Usage: Wrap protected page content with this component
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { isAuthenticated, syncProfileFromSession, initializeActivity, _hasHydrated } = useAuthStore();
  const { isLocked } = useLockStore();

  // Monitor user activity and redirect to login after 5 min inactivity
  useActivityMonitor();

  // Prevent navigation when locked (except login/setup-pin pages)
  useEffect(() => {
    if (isLocked) {
      const isAuthPage = pathname === '/login' || pathname?.includes('/auth/setup-pin');
      if (!isAuthPage) {
        // Don't navigate, just show lock screen
        // Lock screen overlay will handle blocking interaction
      }
    }
  }, [isLocked, pathname]);

  // Sync NextAuth session profile to Zustand store when session changes
  // Note: This only syncs profile data, NOT authentication state
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      syncProfileFromSession({
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        image: session.user.image,
      });
      // Initialize activity timestamp for first-time login
      initializeActivity();
    }
  }, [status, session, syncProfileFromSession, initializeActivity]);

  // Perform initial sync on Google OAuth login
  // This ensures IndexedDB is always synced with PostgreSQL (single source of truth)
  // Triggers when:
  // 1. First login (no localStorage flag)
  // 2. User cleared browser data (empty IndexedDB)
  // 3. Every Google OAuth login (to ensure fresh data)
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && session?.user?.role) {
      // Always sync on Google login to ensure data consistency across devices/browsers
      console.log('[AuthGuard] User authenticated - checking if initial sync needed');

      // Check IndexedDB to see if it's empty (user cleared data)
      import('@/lib/client/db').then(({ db }) => {
        db.products.count().then(productCount => {
          const shouldSync = productCount === 0; // Empty IndexedDB = need sync

          if (shouldSync) {
            console.log('[AuthGuard] IndexedDB is empty - starting initial sync');
            performFirstTimeSync(session.user.role as 'OWNER' | 'EMPLOYEE')
              .then(result => {
                if (result.success) {
                  console.log(`[AuthGuard] ✅ Initial sync success: ${result.pulled} records`);
                } else {
                  console.error('[AuthGuard] ❌ Initial sync failed:', result.errors);
                }
              })
              .catch(err => {
                console.error('[AuthGuard] ❌ Initial sync error:', err);
              });
          } else {
            console.log(`[AuthGuard] IndexedDB has data (${productCount} products) - skipping initial sync`);
          }
        });
      });
    }
  }, [status, session]);

  // Force PIN change if user has default PIN
  // Skip if already on setup-pin page to prevent redirect loop
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.mustChangePin) {
      // Check if we're already on the setup-pin page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/setup-pin')) {
        router.push('/auth/setup-pin?force=true');
      }
    }
  }, [status, session, router]);

  // Redirect if not authenticated
  // Wait for both NextAuth session AND Zustand hydration to complete
  useEffect(() => {
    if (status === 'loading') return;
    if (!_hasHydrated) return; // Wait for Zustand to hydrate from localStorage

    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push('/login');
    }
  }, [isAuthenticated, session, status, router, _hasHydrated]);

  // Show loading while checking auth
  // Wait for both NextAuth and Zustand hydration before deciding
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || !_hasHydrated || (!isAuthenticated && !hasOAuthSession)) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="animate-pulse">
          <Logo variant="icon" size="lg" />
        </div>
      </div>
    );
  }

  // If user must change PIN, show loading while redirecting
  if (session?.user?.mustChangePin) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="animate-pulse">
          <Logo variant="icon" size="lg" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
