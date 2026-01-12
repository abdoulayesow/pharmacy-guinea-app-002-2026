'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { User, ChevronLeft } from 'lucide-react';
import { db, seedInitialData } from '@/lib/db';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();

  const [step, setStep] = useState<'profile' | 'pin'>('profile');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize database with seed data
  useEffect(() => {
    seedInitialData();
  }, []);

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

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
        return;
      }

      // TODO: Re-enable PIN verification later
      // For now, accept any 4-digit PIN
      login(user);
      router.push('/dashboard');
    } finally {
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
      <div className="relative pt-16 pb-12 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-5xl mb-3 text-white tracking-tight font-bold">
            Seri
          </h1>
          <p className="text-slate-300 text-lg font-semibold mb-2">
            Pharmacie Thierno Mamadou
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pb-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Step 1: Profile Selection */}
          {step === 'profile' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
              <h2 className="text-center mb-6 text-white font-semibold text-xl">
                Selectionnez votre profil
              </h2>
              <div className="space-y-3">
                {users.map((user) => (
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

          {/* Step 2: PIN Entry */}
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
