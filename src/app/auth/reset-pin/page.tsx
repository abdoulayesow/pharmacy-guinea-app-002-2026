'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { KeyRound, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { db } from '@/lib/client/db';

/**
 * PIN Reset Flow:
 * 1. User clicks "Forgot PIN" on login page
 * 2. User re-authenticates with Google to prove identity
 * 3. After successful Google auth, user sets a new PIN
 *
 * This ensures only the legitimate user can reset their PIN.
 */
export default function ResetPinPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated with Google, clear PIN and redirect to setup
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      handlePinReset();
    }
  }, [status, session]);

  const handlePinReset = async () => {
    if (!session?.user?.id) return;

    try {
      // Clear the PIN locally
      await db.users.update(session.user.id, { pinHash: undefined });
      console.log('[Auth] PIN cleared locally for reset');

      // Redirect to PIN setup page
      router.push('/auth/setup-pin');
    } catch (error) {
      console.error('[Auth] Failed to clear PIN:', error);
      setError('Erreur lors de la reinitialisation');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Force re-authentication with Google
      await signIn('google', {
        callbackUrl: '/auth/reset-pin',
        prompt: 'select_account', // Force account selection
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError('Erreur de connexion Google');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/login');
  };

  // Loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="animate-pulse">
          <Logo variant="icon" size="lg" />
        </div>
      </div>
    );
  }

  // If authenticated, show processing state
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <Logo variant="icon" size="lg" />
          </div>
          <p className="text-white">Reinitialisation en cours...</p>
        </div>
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
          {/* Back button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Retour</span>
          </button>

          {/* Warning Card */}
          <div className="mb-4">
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="font-semibold text-amber-400 text-lg">
                  Reinitialiser le PIN
                </div>
                <div className="text-sm text-amber-200/80 mt-1">
                  Pour des raisons de securite, vous devez vous reconnecter avec 
                  Google pour reinitialiser votre code PIN.
                </div>
              </div>
            </div>
          </div>

          {/* Reset Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <h2 className="text-center mb-2 text-white font-semibold text-xl">
              PIN oublie?
            </h2>
            <p className="text-center text-slate-400 text-sm mb-6">
              Reconnectez-vous avec Google pour creer un nouveau code PIN.
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Google Sign In Button */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-14 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-base rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
              {isLoading ? 'Connexion...' : 'Se reconnecter avec Google'}
            </Button>
          </div>

          {/* Info text */}
          <p className="text-center text-slate-500 text-xs mt-4">
            Apres la connexion Google, vous pourrez creer un nouveau code PIN.
          </p>
        </div>
      </div>
    </div>
  );
}

