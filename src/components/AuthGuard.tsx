'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/auth';
import { useActivityMonitor } from '@/hooks/useActivityMonitor';
import { Logo } from '@/components/Logo';

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
  const { data: session, status } = useSession();
  const { isAuthenticated, syncFromSession } = useAuthStore();

  // Monitor user activity and redirect to login after 5 min inactivity
  useActivityMonitor();

  // Sync NextAuth session to Zustand store when session changes
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      syncFromSession({
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        image: session.user.image,
      });
    }
  }, [status, session, syncFromSession]);

  // Force PIN change if user has default PIN
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.mustChangePin) {
      router.push('/auth/setup-pin?force=true');
    }
  }, [status, session, router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'loading') return;

    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push('/login');
    }
  }, [isAuthenticated, session, status, router]);

  // Show loading while checking auth
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || (!isAuthenticated && !hasOAuthSession)) {
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
