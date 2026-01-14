'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Shield, Check, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { savePinOfflineFirst } from '@/lib/client/sync';

type SetupStep = 'enter' | 'confirm';

// Loading fallback
function SetupPinLoading() {
  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <div className="animate-pulse">
        <Logo variant="icon" size="lg" />
      </div>
    </div>
  );
}

function SetupPinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update: updateSession } = useSession();
  
  // Check if this is a forced PIN change (default PIN)
  const isForced = searchParams.get('force') === 'true';

  const [step, setStep] = useState<SetupStep>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
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

  // Block browser back button when forced
  useEffect(() => {
    if (isForced) {
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      };
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isForced]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Check database directly to verify mustChangePin status
  // This prevents redirect loops when JWT token is stale
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const checkDatabase = async () => {
        try {
          // Check database directly via API
          const response = await fetch('/api/auth/check-pin-status', {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            // If database says mustChangePin is false, but session says true, refresh session
            if (!data.mustChangePin && session?.user?.mustChangePin) {
              console.log('[Setup PIN] Database shows PIN already changed, refreshing session...');
              await updateSession();
              // Wait a bit for session to update, then redirect
              setTimeout(() => {
                router.push('/dashboard');
              }, 500);
            } else if (!data.mustChangePin && !isForced) {
              // Database says no need to change PIN, and we're not forced
              router.push('/dashboard');
            }
          }
        } catch (error) {
          console.error('[Setup PIN] Failed to check database:', error);
          // Fall back to session-based check
          if (!isForced && session?.user?.hasPin && !session?.user?.mustChangePin) {
            router.push('/dashboard');
          }
        }
      };
      
      checkDatabase();
    }
  }, [status, session, router, isForced, updateSession]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleNumberClick = (num: string) => {
    if (step === 'enter' && pin.length < 4) {
      setPin(pin + num);
      setError('');
    } else if (step === 'confirm' && confirmPin.length < 4) {
      setConfirmPin(confirmPin + num);
      setError('');
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
    setError('');
  };

  const handleClear = () => {
    if (step === 'enter') {
      setPin('');
    } else {
      setConfirmPin('');
    }
    setError('');
  };

  // Move to confirm step when first PIN is complete
  useEffect(() => {
    if (pin.length === 4 && step === 'enter') {
      setTimeout(() => setStep('confirm'), 200);
    }
  }, [pin, step]);

  // Auto-submit when confirm PIN is complete
  useEffect(() => {
    if (confirmPin.length === 4 && step === 'confirm' && !isLoading) {
      handleSubmit();
    }
  }, [confirmPin]);

  const handleSubmit = async () => {
    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas');
      triggerShake();
      setConfirmPin('');
      return;
    }

    if (!session?.user?.id) {
      setError('Session invalide');
      triggerShake();
      return;
    }

    setIsLoading(true);

    try {
      // OFFLINE-FIRST: Save PIN locally first, then sync to server
      const result = await savePinOfflineFirst(session.user.id, pin);

      if (result.success) {
        // Also call API to clear mustChangePin flag (when online)
        if (isOnline) {
          try {
            const response = await fetch('/api/auth/setup-pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ pin, confirmPin, clearMustChangePin: true }),
            });
            
            if (response.ok) {
              // Force session refresh to update mustChangePin in JWT token
              await updateSession();
              
              // Wait for session to actually update (check multiple times)
              let attempts = 0;
              let sessionUpdated = false;
              while (attempts < 10 && !sessionUpdated) {
                await new Promise(resolve => setTimeout(resolve, 200));
                const updatedSession = await fetch('/api/auth/session', {
                  credentials: 'include',
                }).then(r => r.json());
                
                if (updatedSession?.user && !updatedSession.user.mustChangePin) {
                  sessionUpdated = true;
                  break;
                }
                attempts++;
              }
              
              if (!sessionUpdated) {
                console.warn('[Setup PIN] Session did not update after PIN change, but continuing anyway');
              }
            }
          } catch (apiError) {
            // Non-blocking - PIN is saved locally, flag will sync later
            console.log('[Setup PIN] API call to clear flag failed:', apiError);
          }
        }
        
        // PIN saved locally - navigate immediately (optimistic UI)
        router.push('/dashboard');
      } else {
        setError(result.error || 'Erreur lors de la configuration');
        triggerShake();
        setConfirmPin('');
      }
    } catch (error) {
      console.error('Setup PIN error:', error);
      setError('Erreur lors de la configuration');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('enter');
    setConfirmPin('');
    setError('');
  };

  const currentPin = step === 'enter' ? pin : confirmPin;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col">
      {/* Header */}
      <div className="relative pt-12 sm:pt-16 pb-8 sm:pb-12 px-4">
        <div className="max-w-md mx-auto text-center space-y-6 sm:space-y-8">
          <div className="flex justify-center">
            <Logo variant="full" size="lg" />
          </div>
          <div>
            <h1 className="text-4xl sm:text-5xl text-white tracking-tight font-bold">
              Seri
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pb-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Welcome Message */}
          <div className="mb-4">
            {isForced ? (
              // Forced PIN change - show warning style
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="font-semibold text-amber-400 text-lg">
                    Changement de PIN requis
                  </div>
                  <div className="text-sm font-medium text-amber-200/80">
                    Vous devez changer le PIN par defaut (1234)
                  </div>
                </div>
              </div>
            ) : (
              // Normal PIN setup
              <div className="bg-emerald-500 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-400 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-900" />
                </div>
                <div>
                  <div className="font-semibold text-white text-lg">
                    Bienvenue, {session?.user?.name}
                  </div>
                  <div className="text-sm font-medium text-emerald-100">
                    Configurez votre code PIN
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PIN Entry Card */}
          <div
            className={cn(
              'bg-slate-900 rounded-2xl border border-slate-700 p-6',
              shake && 'animate-shake'
            )}
          >
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  step === 'enter'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-500 text-white'
                )}
              >
                {step === 'confirm' ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="w-8 h-0.5 bg-slate-600" />
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  step === 'confirm'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                )}
              >
                2
              </div>
            </div>

            <h3 className="text-center mb-6 text-white font-semibold text-xl">
              {step === 'enter' 
                ? (isForced ? 'Choisissez un nouveau PIN' : 'Choisissez un code PIN') 
                : 'Confirmez le code PIN'}
            </h3>

            {/* PIN Display */}
            <div className="flex justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-200',
                    currentPin.length > i
                      ? 'border-emerald-500 bg-emerald-900/20'
                      : 'border-slate-600 bg-slate-800'
                  )}
                >
                  {currentPin.length > i && (
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

              {/* Clear/Back button */}
              <button
                onClick={step === 'confirm' ? handleBack : handleClear}
                className="h-14 rounded-lg font-medium text-sm bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all"
              >
                {step === 'confirm' ? 'Retour' : 'Effacer'}
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

            {/* Submit Button */}
            {step === 'confirm' && (
              <Button
                onClick={handleSubmit}
                disabled={confirmPin.length !== 4 || isLoading}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base rounded-xl active:scale-[0.98] transition-all"
              >
                {isLoading ? 'Configuration...' : 'Confirmer le PIN'}
              </Button>
            )}
          </div>

          {/* Info text */}
          <p className="text-center text-slate-400 text-sm mt-4">
            {isForced 
              ? 'Pour votre securite, veuillez choisir un nouveau code PIN personnel.'
              : 'Ce code PIN vous permettra de vous connecter rapidement, meme hors ligne.'}
          </p>

          {/* Offline indicator */}
          {!isOnline && (
            <div className="mt-4 flex items-center justify-center gap-2 text-amber-400 text-sm">
              <WifiOff className="w-4 h-4" />
              <span>Mode hors ligne - PIN sera synchronise plus tard</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function SetupPinPage() {
  return (
    <Suspense fallback={<SetupPinLoading />}>
      <SetupPinContent />
    </Suspense>
  );
}
