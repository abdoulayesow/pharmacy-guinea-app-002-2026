'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { signIn, useSession } from 'next-auth/react';
import { User, ChevronLeft, KeyRound, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuthStore, INACTIVITY_TIMEOUT_MS } from '@/stores/auth';
import { verifyPin } from '@/lib/client/auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

// Google logo SVG component
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Login Flow States:
 * 1. NO Google session → Show Google-only login
 * 2. Google session + active (< 5min) → Redirect to dashboard
 * 3. Google session + inactive (> 5min) → Show PIN-only login
 */
type LoginMode = 'loading' | 'google-only' | 'pin-only';

// Helper component to auto-select single user
function SingleUserAutoSelect({
  user,
  onSelect,
}: {
  user: { id: string; name: string; role: string; image?: string | null };
  onSelect: (userId: string) => void;
}) {
  useEffect(() => {
    onSelect(user.id);
  }, [user.id, onSelect]);

  return (
    <div className="flex items-center justify-center py-4">
      <div className="animate-pulse text-slate-400 text-sm">
        Chargement...
      </div>
    </div>
  );
}

// Loading fallback component
function LoginLoading() {
  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <div className="animate-pulse">
        <Logo variant="icon" size="lg" />
      </div>
    </div>
  );
}

// Main login content component (uses useSearchParams)
function LoginPageContent() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const {
    login,
    isAuthenticated,
    isInactive,
    lastActivityAt,
    incrementFailedAttempts,
    resetFailedAttempts,
    isLocked,
    clearExpiredLock,
  } = useAuthStore();

  const [step, setStep] = useState<'main' | 'profile' | 'pin'>('main');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Track if we've already redirected to prevent infinite loops
  const hasRedirectedRef = useRef(false);

  // Get callback URL from query params using Next.js hook (works with client-side navigation)
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  // Reset redirect ref when URL changes (for client-side navigation reuse)
  const prevCallbackUrlRef = useRef(callbackUrl);
  useEffect(() => {
    if (prevCallbackUrlRef.current !== callbackUrl) {
      hasRedirectedRef.current = false;
      prevCallbackUrlRef.current = callbackUrl;
    }
  }, [callbackUrl]);

  // Track online status after mount to avoid hydration mismatch
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize database schema and sync Google session user to IndexedDB
  useEffect(() => {
    // Database schema is auto-initialized by Dexie on first access
    // Sync Google session user to IndexedDB if not already present
    const syncSessionUserToIndexedDB = async () => {
      if (session?.user && sessionStatus === 'authenticated') {
        try {
          const existingUser = await db.users.get(session.user.id);
          if (!existingUser) {
            // User not in IndexedDB - create it from session
            await db.users.put({
              id: session.user.id,
              name: session.user.name || 'Utilisateur',
              role: (session.user.role as 'OWNER' | 'EMPLOYEE') || 'EMPLOYEE',
              image: session.user.image || null,
              email: session.user.email || null,
              createdAt: new Date(),
            });
            console.log('[Login] Synced Google session user to IndexedDB:', session.user.id);
          } else {
            // Update existing user with latest session data (name, image might have changed)
            await db.users.update(session.user.id, {
              name: session.user.name || existingUser.name,
              image: session.user.image || existingUser.image,
              role: (session.user.role as 'OWNER' | 'EMPLOYEE') || existingUser.role,
            });
          }
        } catch (error) {
          console.error('[Login] Error syncing session user to IndexedDB:', error);
        }
      }
    };
    
    syncSessionUserToIndexedDB();
  }, [session, sessionStatus]);

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

  // Check if any users have PIN set
  const usersWithPin = users.filter((u) => u.pinHash);

  // Determine login mode based on Google session and activity
  const loginMode: LoginMode = useMemo(() => {
    // Still loading session
    if (sessionStatus === 'loading') return 'loading';

    // No Google session → Google-only login
    if (sessionStatus !== 'authenticated' || !session?.user) {
      return 'google-only';
    }

    // Has Google session → check if this is first login or returning user
    // First login (lastActivityAt is null): will redirect to dashboard (show loading)
    if (!lastActivityAt) {
      return 'loading';
    }

    // Returning user: check if inactive > 5min → PIN required
    if (isInactive()) {
      return 'pin-only';
    }

    // Google session + recently active → will redirect to dashboard
    return 'loading';
  }, [sessionStatus, session, lastActivityAt, isInactive]);

  // Handle redirects based on auth state
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (hasRedirectedRef.current) return; // Prevent duplicate redirects

    const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;

    // If authenticated via Zustand (PIN), go to callback URL
    if (isAuthenticated) {
      hasRedirectedRef.current = true;
      router.push(callbackUrl);
      return;
    }

    // If Google session but must change PIN, redirect to PIN setup
    if (hasGoogleSession && (session.user as { mustChangePin?: boolean }).mustChangePin) {
      hasRedirectedRef.current = true;
      router.push('/auth/setup-pin?force=true');
      return;
    }

    // If Google session but no PIN setup, go to PIN setup first
    if (hasGoogleSession && !(session.user as { hasPin?: boolean }).hasPin) {
      hasRedirectedRef.current = true;
      router.push('/auth/setup-pin');
      return;
    }

    // If Google session exists and user is still active (or first login), go to callback URL
    // First login: lastActivityAt is null, we initialize it and go to callback URL
    // Returning user: check if inactive > 5min
    if (hasGoogleSession) {
      if (!lastActivityAt) {
        // First time after Google login - set activity and go to callback URL
        hasRedirectedRef.current = true;
        useAuthStore.getState().updateActivity();
        router.push(callbackUrl);
        return;
      } else if (!isInactive()) {
        // User is still active (< 5 min since last activity)
        hasRedirectedRef.current = true;
        useAuthStore.getState().updateActivity();
        router.push(callbackUrl);
        return;
      }
      // Otherwise: inactive > 5min, stay on login page for PIN entry
    }
  }, [sessionStatus, session, isAuthenticated, lastActivityAt, isInactive, router, callbackUrl]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError('Erreur de connexion Google');
      setIsGoogleLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleProfileSelect = (userId: string) => {
    setSelectedUser(userId);
    setStep('pin');
    setPin('');
    setError('');
  };

  const handleBackToProfile = () => {
    setStep('profile');
    setPin('');
    setError('');
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleLogin = async () => {
    clearExpiredLock();
    if (isLocked()) {
      setError('Compte verrouille. Reessayez dans 30 minutes.');
      triggerShake();
      return;
    }

    if (!selectedUser) {
      setError('Selectionnez un profil');
      triggerShake();
      return;
    }

    if (pin.length !== 4) {
      setError('Le code PIN doit avoir 4 chiffres');
      triggerShake();
      return;
    }

    setIsLoading(true);

    try {
      const user = users.find((u) => u.id === selectedUser);
      if (!user) {
        setError('Utilisateur non trouve');
        triggerShake();
        setIsLoading(false);
        return;
      }

      // Try API authentication first (when online)
      let isApiSuccess = false;

      if (isOnline) {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: selectedUser, pin }),
          });

          if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                              isApiSuccess = true;
                              // JWT is now stored in httpOnly cookie by the server
                              console.log('[Auth] Authenticated via API (cookie set)');
                            }
                          } else if (response.status === 401 || response.status === 404) {
            incrementFailedAttempts();
            setError('Code PIN incorrect');
            triggerShake();
            setPin('');
            setIsLoading(false);
            return;
          }
        } catch (apiError) {
          console.log('[Auth] API auth failed, falling back to offline:', apiError);
        }
      }

      // Fallback to offline verification
      if (!isApiSuccess) {
        console.log('[Auth] Using offline authentication');

        if (!user.pinHash) {
          setError('PIN non configure');
          triggerShake();
          setIsLoading(false);
          return;
        }

        const isPinValid = await verifyPin(pin, user.pinHash);

        if (!isPinValid) {
          incrementFailedAttempts();
          setError('Code PIN incorrect');
          triggerShake();
          setPin('');
          setIsLoading(false);
          return;
        }
        console.log('[Auth] Authenticated offline');
      }

      // PIN is correct - reset failed attempts and log in
      resetFailedAttempts();
      login(user);
      router.push(callbackUrl);
    } catch (error) {
      console.error('Login error:', error);
      setError('Erreur de connexion');
      triggerShake();
      setIsLoading(false);
    }
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === 4 && selectedUser && !isLoading && step === 'pin') {
      handleLogin();
    }
  }, [pin]);

  // Get selected user data
  const selectedUserData = users.find((u) => u.id === selectedUser);

  // Loading state
  if (loginMode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="animate-pulse">
          <Logo variant="icon" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col">
      {/* Header with Logo and Branding */}
      <div className="relative pt-12 sm:pt-16 pb-8 sm:pb-12 px-4">
        <div className="max-w-md mx-auto text-center space-y-6 sm:space-y-8">
          {/* Pharmacy Logo with Full Branding */}
          <div className="flex justify-center">
            <Logo variant="full" size="lg" />
          </div>

          {/* App Name */}
          <div>
            <h1 className="text-4xl sm:text-5xl text-white tracking-tight font-bold">
              Seri
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pb-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* ============================================ */}
          {/* GOOGLE-ONLY MODE: User not logged into Google */}
          {/* ============================================ */}
          {loginMode === 'google-only' && step === 'main' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-center mb-6 text-white font-semibold text-xl">
                Connexion
              </h2>

              <div className="space-y-4">
                {/* Google Sign In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || !isOnline}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-all duration-200 border-2 border-slate-600 bg-white hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleLogo className="w-5 h-5" />
                  <span className="font-semibold text-gray-700">
                    {isGoogleLoading ? 'Connexion...' : 'Continuer avec Google'}
                  </span>
                </button>

                {/* Offline indicator */}
                {!isOnline && (
                  <p className="text-center text-amber-400 text-sm">
                    Connexion Google non disponible hors ligne
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm text-center">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* PIN-ONLY MODE: User has Google session but inactive */}
          {/* ============================================ */}
          {loginMode === 'pin-only' && step === 'main' && (
            <div className="space-y-4">
              {/* Session User Profile - Prominent Display */}
              {session?.user && (
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 flex items-center gap-4 shadow-lg shadow-emerald-500/20 mb-4">
                  {/* Large Avatar */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center bg-white/20 ring-3 ring-white/30 shadow-lg flex-shrink-0">
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-semibold text-white text-xl">
                        {(session.user.name || 'Utilisateur')
                          .split(/\s+/)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-xl mb-1 truncate">
                      {session.user.name || 'Utilisateur'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-50 flex-shrink-0" />
                      <p className="text-sm font-medium text-emerald-50">
                        Session expiree - Entrez votre PIN
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PIN Login Card */}
              <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
                <h2 className="text-center mb-6 text-white font-semibold text-xl">
                  Verification PIN
                </h2>

                {/* Show profile selection if multiple users, otherwise go straight to PIN */}
                {usersWithPin.length > 1 ? (
                  <div className="space-y-3">
                    <p className="text-slate-400 text-sm text-center mb-4">
                      Selectionnez votre profil
                    </p>
                    {usersWithPin.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleProfileSelect(user.id)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 border-2 border-slate-700 hover:border-emerald-500/50 bg-slate-800 hover:bg-slate-750 active:scale-[0.98]"
                      >
                        <UserAvatar
                          name={user.name}
                          image={user.image || undefined}
                          size="md"
                        />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-white">
                            {user.name}
                          </div>
                          <div className="text-sm text-slate-400">
                            {user.role === 'OWNER' ? 'Proprietaire' : 'Employe'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : usersWithPin.length === 1 ? (
                  // Single user - show their info then PIN pad will show
                  <SingleUserAutoSelect
                    user={usersWithPin[0]}
                    onSelect={handleProfileSelect}
                  />
                ) : (
                  // No users with PIN - show message
                  <div className="text-center py-8">
                    <p className="text-slate-400 mb-4">
                      Aucun profil avec PIN configure
                    </p>
                    <button
                      onClick={handleGoogleSignIn}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                      Se reconnecter avec Google
                    </button>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* PROFILE SELECTION (for PIN-only mode with multiple users) */}
          {/* ============================================ */}
          {loginMode === 'pin-only' && step === 'profile' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
              <button
                onClick={() => setStep('main')}
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Retour</span>
              </button>

              <h2 className="text-center mb-6 text-white font-semibold text-xl">
                Selectionnez votre profil
              </h2>
              <div className="space-y-3">
                {usersWithPin.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleProfileSelect(user.id)}
                    className="w-full flex items-center gap-4 p-5 rounded-xl transition-all duration-200 border-2 border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-750 active:scale-[0.98]"
                  >
                    <UserAvatar
                      name={user.name}
                      image={user.image || undefined}
                      size="lg"
                    />
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-lg text-white">
                        {user.name}
                      </div>
                      <div className="text-sm font-medium text-slate-400">
                        {user.role === 'OWNER' ? 'Proprietaire' : 'Employe'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* PIN ENTRY */}
          {/* ============================================ */}
          {step === 'pin' && selectedUserData && (
            <div>
              {/* Selected Profile Display - Prominent */}
              <div className="mb-6">
                {/* Show "Change profile" button only if multiple users */}
                {usersWithPin.length > 1 && (
                  <button
                    onClick={handleBackToProfile}
                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Changer de profil</span>
                  </button>
                )}

                {/* Prominent Profile Card */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 flex items-center gap-4 shadow-lg shadow-emerald-500/20">
                  {/* Large Avatar */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center bg-white/20 ring-3 ring-white/30 shadow-lg flex-shrink-0">
                    {selectedUserData.image ? (
                      <img
                        src={selectedUserData.image}
                        alt={selectedUserData.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-semibold text-white text-xl">
                        {selectedUserData.name
                          .split(/\s+/)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-xl mb-1 truncate">
                      {selectedUserData.name}
                    </div>
                    <div className="text-sm font-medium text-emerald-50">
                      {selectedUserData.role === 'OWNER' ? 'Proprietaire' : 'Employe'}
                    </div>
                  </div>
                </div>
              </div>

              {/* PIN Entry Card */}
              <div
                className={cn(
                  'bg-slate-900 rounded-2xl border border-slate-700 p-6',
                  shake && 'animate-shake'
                )}
              >
                <h3 className="text-center mb-6 text-white font-semibold text-xl">
                  Code PIN
                </h3>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-6">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-200',
                        pin.length > i
                          ? 'border-emerald-500 bg-emerald-900/20'
                          : 'border-slate-600 bg-slate-800'
                      )}
                    >
                      {pin.length > i && (
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}

                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumberClick(num.toString())}
                      className="h-14 rounded-lg text-lg font-semibold bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 hover:border-emerald-500 active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}

                  {/* Clear button */}
                  <button
                    onClick={handleClear}
                    className="h-14 rounded-lg font-medium text-sm bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all"
                  >
                    Effacer
                  </button>

                  {/* Zero button */}
                  <button
                    onClick={() => handleNumberClick('0')}
                    className="h-14 rounded-lg text-lg font-semibold bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 hover:border-emerald-500 active:scale-95 transition-all"
                  >
                    0
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={handleDelete}
                    className="h-14 rounded-lg font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all text-xl"
                  >
                    &#8592;
                  </button>
                </div>

                {/* Login Button */}
                <Button
                  onClick={handleLogin}
                  disabled={!selectedUser || pin.length !== 4 || isLoading}
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base rounded-xl active:scale-[0.98] transition-all"
                >
                  {isLoading ? 'Connexion...' : 'Se connecter'}
                </Button>

                {/* Forgot PIN Link */}
                <div className="text-center mt-4">
                  <Link
                    href="/auth/reset-pin"
                    className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    PIN oublie?
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper with Suspense boundary for useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}
