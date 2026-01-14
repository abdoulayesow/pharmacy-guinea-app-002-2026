'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

type SetupStep = 'enter' | 'confirm';

export default function SetupPinPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [step, setStep] = useState<SetupStep>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // If user already has PIN, redirect to dashboard
  useEffect(() => {
    if (session?.user?.hasPin) {
      router.push('/dashboard');
    }
  }, [session, router]);

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

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, confirmPin }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Erreur lors de la configuration');
        triggerShake();
        setConfirmPin('');
      }
    } catch (error) {
      console.error('Setup PIN error:', error);
      setError('Erreur de connexion');
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
              {step === 'enter' ? 'Choisissez un code PIN' : 'Confirmez le code PIN'}
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
            Ce code PIN vous permettra de vous connecter rapidement, meme hors ligne.
          </p>
        </div>
      </div>
    </div>
  );
}
