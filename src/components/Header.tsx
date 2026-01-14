'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Logo } from './Logo';
import { UserAvatar } from './UserAvatar';
import { NotificationBadge } from './NotificationBadge';
import { useAuthStore } from '@/stores/auth';
import { useLockStore } from '@/stores/lock';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { cn } from '@/lib/utils';

export function Header() {
  const { data: session } = useSession();
  const { currentUser } = useAuthStore();
  const { isOnline, pendingCount } = useSyncStatus();
  const { isLocked, lock } = useLockStore();

  // Get user info from OAuth session or Zustand store
  const userName = session?.user?.name || currentUser?.name;
  const userImage = session?.user?.image || currentUser?.image;

  return (
    <header className="bg-gray-900 border-b border-gray-700 dark:bg-gray-950 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Logo variant="icon-simple" size="md" />
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-white">Seri</h1>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                <div
                  className={cn(
                    'w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full',
                    isOnline ? 'bg-emerald-500' : 'bg-gray-500'
                  )}
                />
                <span className="text-xs text-gray-400 font-medium">
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
                {pendingCount > 0 && (
                  <>
                    <span className="text-gray-600">&#8226;</span>
                    <span className="text-xs text-amber-400 font-medium">
                      {pendingCount}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification badge for urgent payment reminders */}
            <NotificationBadge />

            {/* Lock button */}
            <button
              onClick={() => lock('manual')}
              disabled={isLocked}
              className={cn(
                'flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg transition-all duration-200',
                'bg-transparent hover:bg-slate-700/50 active:scale-95',
                'border-0 focus:outline-none focus:ring-2 focus:ring-slate-500/50',
                isLocked && 'opacity-50 cursor-not-allowed'
              )}
              title="Verrouiller l'application"
              aria-label="Verrouiller l'application"
            >
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
            </button>

            {/* User avatar with link to settings */}
            <Link href="/parametres" className="flex-shrink-0">
              <UserAvatar
                name={userName}
                image={userImage}
                size="sm"
                className="hover:ring-emerald-400/50 transition-all cursor-pointer"
              />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
