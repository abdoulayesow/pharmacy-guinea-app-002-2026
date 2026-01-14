'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Lock, Fingerprint, Loader2, X } from 'lucide-react';
import { useLockStore } from '@/stores/lock';
import { useAuthStore } from '@/stores/auth';
import { verifyPin } from '@/lib/client/auth';
import { authenticateBiometric, isWebAuthnAvailable, hasBiometricCredential } from '@/lib/client/biometric';
import { db } from '@/lib/client/db';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function LockScreen() {
  const { isLocked, lockReason, unlock, updateActivity } = useLockStore();
  const { currentUser } = useAuthStore();
  const { data: session } = useSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  // Get current user ID
  const userId = session?.user?.id || currentUser?.id;

  // Check biometric availability
  useEffect(() => {
    if (isLocked && userId) {
      const checkBiometric = async () => {
        const available = isWebAuthnAvailable();
        setIsBiometricAvailable(available);
        
        if (available && userId) {
          const hasCred = await hasBiometricCredential(userId);
          setHasBiometric(hasCred);
        }
      };
      checkBiometric();
    }
  }, [isLocked, userId]);

  // Auto-focus PIN input when lock screen appears
  useEffect(() => {
    if (isLocked) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const pinInput = document.getElementById('lock-pin-input');
        if (pinInput) {
          pinInput.focus();
        }
      }, 100);
    } else {
      // Clear PIN when unlocked
      setPin('');
      setError('');
    }
  }, [isLocked]);

  // Update activity when user interacts with lock screen
  useEffect(() => {
    if (isLocked) {
      const handleActivity = () => updateActivity();
      const events = ['mousedown', 'keydown', 'touchstart'];
      events.forEach((event) => {
        window.addEventListener(event, handleActivity, { passive: true });
      });
      return () => {
        events.forEach((event) => {
          window.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [isLocked, updateActivity]);

  const handleNumberClick = (num: string) => {
    setError('');
    if (pin.length < 4) {
      setPin(pin + num);
    }
  };

  const handleDeletePin = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handlePinUnlock = async () => {
    if (pin.length !== 4 || !userId) return;

    setIsVerifying(true);
    setError('');

    try {
      // Get user from IndexedDB
      const user = await db.users.get(userId);
      if (!user || !user.pinHash) {
        setError('PIN non configuré');
        setIsVerifying(false);
        return;
      }

      // Verify PIN
      const isValid = await verifyPin(pin, user.pinHash);
      
      if (isValid) {
        unlock();
        updateActivity(); // Update activity on successful unlock
        setPin('');
      } else {
        setError('PIN incorrect');
        setPin('');
      }
    } catch (error) {
      console.error('[LockScreen] PIN verification error:', error);
      setError('Erreur lors de la vérification');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!userId) return;

    setIsVerifying(true);
    setError('');

    try {
      const success = await authenticateBiometric(userId);
      
      if (success) {
        unlock();
        updateActivity(); // Update activity on successful unlock
      } else {
        setError('Authentification biométrique échouée');
      }
    } catch (error) {
      console.error('[LockScreen] Biometric error:', error);
      setError('Erreur lors de l\'authentification');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === 4 && !isVerifying) {
      handlePinUnlock();
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLocked) return null;

  const lockMessage = lockReason === 'inactivity' 
    ? 'Application verrouillée après inactivité'
    : 'Application verrouillée';

  // Prevent all clicks from propagating when locked
  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateActivity(); // Update activity on any interaction
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      onMouseDown={handleOverlayClick}
      onTouchStart={handleOverlayClick}
    >
      <div 
        className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Lock Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 border-2 border-slate-700 flex items-center justify-center ring-4 ring-slate-800/50">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-white text-center mb-2">
            {lockMessage}
          </h2>
          <p className="text-sm text-slate-400 text-center mb-6">
            Entrez votre PIN ou utilisez l&apos;empreinte digitale
          </p>

          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-all',
                  pin.length > i
                    ? 'border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                    : 'border-slate-600 bg-slate-800/50'
                )}
              >
                {pin.length > i && (
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                )}
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center ring-2 ring-red-500/20">
              {error}
            </div>
          )}

          {/* Fingerprint Button (if available) */}
          {isBiometricAvailable && hasBiometric && (
            <div className="mb-4">
              <Button
                onClick={handleBiometricUnlock}
                disabled={isVerifying}
                className="w-full h-14 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white font-semibold rounded-xl"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Utiliser l&apos;empreinte digitale
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={isVerifying}
                className="h-14 rounded-lg text-lg font-semibold bg-slate-800/50 border border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleDeletePin}
              disabled={isVerifying || pin.length === 0}
              className="h-14 rounded-lg font-medium bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
            >
              &#8592;
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={isVerifying}
              className="h-14 rounded-lg text-lg font-semibold bg-slate-800/50 border border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              0
            </button>
            <button
              onClick={() => {
                setPin('');
                setError('');
              }}
              disabled={isVerifying}
              className="h-14 rounded-lg font-medium text-xs bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Effacer
            </button>
          </div>

          {/* Loading Indicator */}
          {isVerifying && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Vérification en cours...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

