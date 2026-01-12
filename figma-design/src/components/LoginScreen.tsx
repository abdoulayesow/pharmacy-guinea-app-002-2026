import { useState } from 'react';
import { useApp } from '../lib/context';
import { Button } from './ui/button';
import { User, ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { users, login } = useApp();
  const [step, setStep] = useState<'profile' | 'pin'>('profile');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(pin + num);
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

  const handleProfileSelect = (userId: string) => {
    setSelectedUser(userId);
    setError('');
    setPin('');
    setStep('pin');
  };

  const handleBackToProfiles = () => {
    setStep('profile');
    setSelectedUser(null);
    setPin('');
    setError('');
  };

  const handleLogin = () => {
    if (!selectedUser) {
      setError('Sélectionnez un profil');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (pin.length !== 4) {
      setError('Le code PIN doit avoir 4 chiffres');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const success = login(selectedUser, pin);
    if (success) {
      onLogin();
    } else {
      setError('Code PIN incorrect');
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const selectedUserData = users.find(u => u.id === selectedUser);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-300">
      {/* Header - Clean and Professional */}
      <div className="pt-16 pb-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-4xl mb-2 text-gray-900 dark:text-white tracking-tight font-semibold">Seri</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-1">Pharmacie Thierno Mamadou</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Système de gestion</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm">
          {/* Step 1: Profile Selection */}
          {step === 'profile' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-colors duration-300">
              <h2 className="text-center mb-4 text-gray-900 dark:text-white font-semibold">Sélectionnez votre profil</h2>
              <div className="space-y-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleProfileSelect(user.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-gray-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                      <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-gray-900 dark:text-white font-medium text-sm">{user.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {user.role === 'owner' ? 'Propriétaire' : 'Employé'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: PIN Entry */}
          {step === 'pin' && (
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-all duration-300 ${shake ? 'animate-shake' : ''}`}>
              {/* Back button and selected user */}
              <div className="mb-5">
                <button
                  onClick={handleBackToProfiles}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Changer de profil</span>
                </button>
                
                {selectedUserData && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-600">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-900 dark:text-white font-medium text-sm">{selectedUserData.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {selectedUserData.role === 'owner' ? 'Propriétaire' : 'Employé'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <h3 className="text-center mb-5 text-gray-900 dark:text-white font-semibold">Entrez votre code PIN</h3>
              
              {/* PIN Display */}
              <div className="flex justify-center gap-2.5 mb-5">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                      pin.length > i 
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {pin.length > i && (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-500"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num.toString())}
                    className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-lg font-medium transition-all duration-150 active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-sm font-medium transition-all duration-150 active:scale-95"
                >
                  Effacer
                </button>
                <button
                  onClick={() => handleNumberClick('0')}
                  className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-lg font-medium transition-all duration-150 active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  className="h-12 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-lg font-medium transition-all duration-150 active:scale-95"
                >
                  ←
                </button>
              </div>

              {/* Login Button */}
              <Button
                onClick={handleLogin}
                disabled={!selectedUser || pin.length !== 4}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 active:scale-[0.98]"
              >
                Se connecter
              </Button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}