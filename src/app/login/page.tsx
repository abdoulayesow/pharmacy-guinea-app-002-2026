'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { signIn, useSession } from 'next-auth/react';
import { User, ChevronLeft, KeyRound } from 'lucide-react';
import { db, seedInitialData } from '@/lib/db';
import { useAuthStore } from '@/stores/auth';
import { verifyPin } from '@/lib/client/auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
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

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { login, isAuthenticated, incrementFailedAttempts, resetFailedAttempts, isLocked, clearExpiredLock } = useAuthStore();

  const [step, setStep] = useState<'main' | 'profile' | 'pin'>('main');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Initialize database with seed data
  useEffect(() => {
    seedInitialData();
  }, []);

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

  // Check if any users have PIN set (for showing PIN login option)
  const usersWithPin = users.filter((u) => u.pinHash);

  // Handle OAuth session
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user) {
      // Check if user needs PIN setup
      if (!(session.user as { hasPin?: boolean }).hasPin) {
        router.push('/auth/setup-pin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [session, sessionStatus, router]);

  // Redirect if already authenticated via Zustand (PIN login)
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

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
    // Check if account is locked
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
      let jwtToken: string | undefined;

      if (navigator.onLine) {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: selectedUser, pin }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.token) {
              isApiSuccess = true;
              jwtToken = data.token;
              // Store JWT token in localStorage
              localStorage.setItem('seri-jwt-token', jwtToken!);
              console.log('✅ Authenticated via API');
            }
          } else if (response.status === 401 || response.status === 404) {
            // Invalid credentials from API
            incrementFailedAttempts();
            setError('Code PIN incorrect');
            triggerShake();
            setPin('');
            setIsLoading(false);
            return;
          }
          // If other error, fall through to offline verification
        } catch (apiError) {
          console.log('⚠️ API auth failed, falling back to offline:', apiError);
          // Fall through to offline verification
        }
      }

      // Fallback to offline verification (when API fails or offline)
      if (!isApiSuccess) {
        console.log('🔄 Using offline authentication');

        if (!user.pinHash) {
          setError('PIN non configuré');
          triggerShake();
          setIsLoading(false);
          return;
        }

        const isPinValid = await verifyPin(pin, user.pinHash);

        if (!isPinValid) {
          // Incorrect PIN
          incrementFailedAttempts();
          setError('Code PIN incorrect');
          triggerShake();
          setPin('');
          setIsLoading(false);
          return;
        }
        console.log('✅ Authenticated offline');
      }

      // PIN is correct - reset failed attempts and log in
      resetFailedAttempts();
      login(user);
      router.push('/dashboard');
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
          {/* Main Login Options */}
          {step === 'main' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-center mb-6 text-white font-semibold text-xl">
                Connexion
              </h2>

              <div className="space-y-4">
                {/* Google Sign In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || !navigator.onLine}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-all duration-200 border-2 border-slate-600 bg-white hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleLogo className="w-5 h-5" />
                  <span className="font-semibold text-gray-700">
                    {isGoogleLoading ? 'Connexion...' : 'Continuer avec Google'}
                  </span>
                </button>

                {/* Offline indicator */}
                {!navigator.onLine && (
                  <p className="text-center text-amber-400 text-sm">
                    Connexion Google non disponible hors ligne
                  </p>
                )}

                {/* Divider - only show if users with PIN exist */}
                {usersWithPin.length > 0 && (
                  <>
                    <div className="flex items-center gap-4 my-6">
                      <div className="flex-1 h-px bg-slate-700" />
                      <span className="text-slate-500 text-sm">ou</span>
                      <div className="flex-1 h-px bg-slate-700" />
                    </div>

                    {/* PIN Login Button */}
                    <button
                      onClick={() => setStep('profile')}
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-all duration-200 border-2 border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-750 active:scale-[0.98]"
                    >
                      <KeyRound className="w-5 h-5 text-emerald-400" />
                      <span className="font-semibold text-white">
                        Connexion avec PIN
                      </span>
                    </button>
                  </>
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

          {/* Step 2: Profile Selection (for PIN login) */}
          {step === 'profile' && (
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
                    <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center">
                      <User className="w-7 h-7 text-slate-300" />
                    </div>
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

          {/* Step 3: PIN Entry */}
          {step === 'pin' && selectedUserData && (
            <div>
              {/* Selected Profile Display */}
              <div className="mb-4">
                <button
                  onClick={handleBackToProfile}
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Changer de profil</span>
                </button>

                <div className="bg-emerald-500 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-400 flex items-center justify-center">
                    <User className="w-6 h-6 text-emerald-900" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-lg">
                      {selectedUserData.name}
                    </div>
                    <div className="text-sm font-medium text-emerald-100">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
