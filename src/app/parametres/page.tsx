'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  User,
  Database,
  Trash2,
  Key,
  Shield,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Info,
  Globe,
  Bell,
  Upload,
  Download,
} from 'lucide-react';
import { db, clearDatabase, getDatabaseStats, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { hashPin } from '@/lib/client/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/client/utils';
import type { User as UserType } from '@/lib/shared/types';

interface DatabaseStats {
  users: number;
  products: number;
  sales: number;
  expenses: number;
  stockMovements: number;
  pendingSync: number;
}

export default function ParametresPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { currentUser, isAuthenticated, logout, isInactive, lastActivityAt } = useAuthStore();

  // Check if user is authenticated via Zustand OR via Google session + recently active
  const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;
  const isRecentlyActive = hasGoogleSession && lastActivityAt && !isInactive();
  const isFullyAuthenticated = isAuthenticated || isRecentlyActive;

  // State
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [selectedUserForPin, setSelectedUserForPin] = useState<UserType | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [stockAlertEnabled, setStockAlertEnabled] = useState(true);
  const [syncAlertEnabled, setSyncAlertEnabled] = useState(true);

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];
  const pendingSyncCount = useLiveQuery(
    () => db.sync_queue.where('status').equals('PENDING').count()
  ) ?? 0;

  // Redirect if not authenticated
  useEffect(() => {
    // Wait for session to load before checking auth
    if (sessionStatus === 'loading') return;

    if (!isFullyAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/parametres')}`);
    }
  }, [isFullyAuthenticated, sessionStatus, router]);

  // Load database stats
  useEffect(() => {
    const loadStats = async () => {
      setIsLoadingStats(true);
      try {
        const stats = await getDatabaseStats();
        setDbStats(stats);
      } catch (error) {
        console.error('Failed to load database stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };
    loadStats();
  }, []);

  const isOwner = currentUser?.role === 'OWNER';

  // Handle clear database
  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      await clearDatabase();
      await seedInitialData();
      const stats = await getDatabaseStats();
      setDbStats(stats);
      toast.success('Base de donnees reinitialisee');
      setShowClearDialog(false);
      // Logout and redirect to login
      logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to clear database:', error);
      toast.error('Erreur lors de la reinitialisation');
    } finally {
      setIsClearing(false);
    }
  };

  // Handle PIN change
  const handleOpenPinDialog = (user: UserType) => {
    setSelectedUserForPin(user);
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setShowPinDialog(true);
  };

  const handlePinChange = async () => {
    if (newPin.length !== 4) {
      setPinError('Le PIN doit avoir 4 chiffres');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('Le PIN doit contenir uniquement des chiffres');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Les codes PIN ne correspondent pas');
      return;
    }
    if (!selectedUserForPin) return;

    setIsSavingPin(true);
    try {
      // Hash the PIN using bcrypt before storing
      const hashedPin = await hashPin(newPin);

      await db.users.update(selectedUserForPin.id, {
        pinHash: hashedPin,
      });

      toast.success(`PIN modifie pour ${selectedUserForPin.name}`);
      setShowPinDialog(false);
      setNewPin('');
      setConfirmPin('');
      setSelectedUserForPin(null);
    } catch (error) {
      console.error('Failed to update PIN:', error);
      toast.error('Erreur lors de la modification du PIN');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleNumberClick = (num: string, field: 'new' | 'confirm') => {
    setPinError('');
    if (field === 'new' && newPin.length < 4) {
      setNewPin(newPin + num);
    } else if (field === 'confirm' && confirmPin.length < 4) {
      setConfirmPin(confirmPin + num);
    }
  };

  const handleDeletePin = (field: 'new' | 'confirm') => {
    if (field === 'new') {
      setNewPin(newPin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  // Show nothing while loading or redirecting
  if (sessionStatus === 'loading' || !isFullyAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <Header />

      <main className="max-w-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* User Profile */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Profil utilisateur</h3>
              <p className="text-xs sm:text-sm text-slate-400">Informations du compte</p>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-sm font-medium">Nom</span>
              <span className="text-white font-semibold">{currentUser?.name}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-sm font-medium">Role</span>
              <span className="text-white font-semibold">
                {isOwner ? 'Proprietaire' : 'Employe(e)'}
              </span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center ring-2 ring-purple-500/20">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Apparence</h3>
              <p className="text-xs sm:text-sm text-slate-400">Personnaliser l&apos;affichage</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div>
                <span className="text-white font-medium block">Theme</span>
                <span className="text-xs text-slate-400">Clair ou sombre</span>
              </div>
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div>
                <span className="text-white font-medium block">Devise</span>
                <span className="text-xs text-slate-400">Monnaie d&apos;affichage</span>
              </div>
              <span className="text-slate-300 font-semibold">GNF</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center ring-2 ring-amber-500/20">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Notifications</h3>
              <p className="text-xs sm:text-sm text-slate-400">Alertes et rappels</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <span className="text-white font-medium block">Stock faible</span>
                <span className="text-xs text-slate-400">Alertes de reapprovisionnement</span>
              </div>
              <input
                type="checkbox"
                checked={stockAlertEnabled}
                onChange={(e) => setStockAlertEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/50 bg-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
              <div>
                <span className="text-white font-medium block">Synchronisation</span>
                <span className="text-xs text-slate-400">Etat de la connexion</span>
              </div>
              <input
                type="checkbox"
                checked={syncAlertEnabled}
                onChange={(e) => setSyncAlertEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/50 bg-slate-700"
              />
            </label>
          </div>
        </div>

        {/* Data & Sync */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-500/20">
              <Database className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Donnees</h3>
              <p className="text-xs sm:text-sm text-slate-400">Synchronisation et sauvegarde</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className={cn(
              'p-4 rounded-lg border ring-2',
              pendingSyncCount > 0
                ? 'bg-amber-500/10 border-amber-500/30 ring-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 ring-emerald-500/20'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  pendingSyncCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                )} />
                <span className={cn(
                  'text-sm font-semibold',
                  pendingSyncCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {pendingSyncCount > 0 ? 'En attente' : 'Connecte'}
                </span>
              </div>
              <p className={cn(
                'text-sm',
                pendingSyncCount > 0 ? 'text-amber-300' : 'text-emerald-300'
              )}>
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} operation${pendingSyncCount > 1 ? 's' : ''} en attente de synchronisation`
                  : 'Toutes les donnees sont synchronisees'}
              </p>
            </div>

            <button className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                  <Upload className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block">Forcer la synchronisation</span>
                  <span className="text-xs text-slate-400">Synchroniser maintenant</span>
                </div>
              </div>
            </button>

            <button className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center ring-1 ring-purple-500/20">
                  <Download className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block">Exporter les donnees</span>
                  <span className="text-xs text-slate-400">Sauvegarde locale</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Security - Owner Only */}
        {isOwner && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center ring-2 ring-orange-500/20">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base sm:text-lg">Securite</h3>
                <p className="text-xs sm:text-sm text-slate-400">Gestion des acces</p>
              </div>
            </div>

            <div className="space-y-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleOpenPinDialog(user)}
                  className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98]"
                >
                  <div className="text-left">
                    <span className="text-white font-medium block">
                      Modifier le PIN - {user.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {user.role === 'OWNER' ? 'Proprietaire' : 'Employe'}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/20">
                    <Key className="w-4 h-4 text-orange-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-500/10 flex items-center justify-center ring-2 ring-slate-500/20">
              <Info className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">A propos</h3>
              <p className="text-xs sm:text-sm text-slate-400">Informations sur l&apos;application</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-sm font-medium">Version</span>
              <span className="text-white font-semibold">1.0.0</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-sm font-medium">Pharmacie</span>
              <span className="text-white font-semibold">Thierno Mamadou</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-sm font-medium">Localisation</span>
              <span className="text-white font-semibold">Conakry, Guinee</span>
            </div>
          </div>
        </div>

        {/* Danger Zone - Owner Only */}
        {isOwner && (
          <div className="bg-gradient-to-br from-red-950/50 to-slate-900 rounded-2xl p-5 shadow-xl border-2 border-red-500/30 ring-2 ring-red-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center ring-2 ring-red-500/40">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-300 font-semibold text-lg">Zone dangereuse</h3>
                <p className="text-sm text-red-400/80">Actions irreversibles</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowClearDialog(true)}
                className="w-full flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 transition-colors active:scale-[0.98] ring-1 ring-red-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center ring-1 ring-red-500/30">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-red-300 font-medium block">Reinitialiser la base</span>
                    <span className="text-xs text-red-400/70">Supprimer toutes les donnees</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
          <p className="text-xs text-center text-slate-400">
            Seri - Gestion de pharmacie<br />
            Concu pour la Pharmacie Thierno Mamadou
          </p>
        </div>
      </main>

      {/* Clear Database Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center ring-2 ring-red-500/40">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Confirmer la reinitialisation
                  </h3>
                </div>
              </div>
              <p className="text-slate-300 mb-6">
                Toutes les donnees seront supprimees definitivement. Vous serez
                deconnecte et devrez vous reconnecter.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowClearDialog(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 bg-slate-800/50"
                  disabled={isClearing}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleClearDatabase}
                  variant="destructive"
                  className="flex-1 bg-red-600 hover:bg-red-700 ring-2 ring-red-500/20"
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    'Supprimer tout'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Change Dialog */}
      {showPinDialog && selectedUserForPin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-500/20">
                    <Key className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Modifier le PIN
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      {selectedUserForPin.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPinDialog(false)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* New PIN */}
              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">
                  Nouveau PIN
                </label>
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-12 h-12 rounded-lg border-2 flex items-center justify-center',
                        newPin.length > i
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                          : 'border-slate-600 bg-slate-800/50'
                      )}
                    >
                      {newPin.length > i && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm PIN */}
              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">
                  Confirmer le PIN
                </label>
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-12 h-12 rounded-lg border-2 flex items-center justify-center',
                        confirmPin.length > i
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                          : 'border-slate-600 bg-slate-800/50'
                      )}
                    >
                      {confirmPin.length > i && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {pinError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center ring-2 ring-red-500/20">
                  {pinError}
                </div>
              )}

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() =>
                      handleNumberClick(
                        num.toString(),
                        newPin.length < 4 ? 'new' : 'confirm'
                      )
                    }
                    className="h-12 rounded-lg text-lg font-semibold bg-slate-800/50 border border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() =>
                    handleDeletePin(newPin.length < 4 || confirmPin.length === 0 ? 'new' : 'confirm')
                  }
                  className="h-12 rounded-lg font-medium bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all text-xl"
                >
                  &#8592;
                </button>
                <button
                  onClick={() =>
                    handleNumberClick(
                      '0',
                      newPin.length < 4 ? 'new' : 'confirm'
                    )
                  }
                  className="h-12 rounded-lg text-lg font-semibold bg-slate-800/50 border border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  onClick={() => {
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="h-12 rounded-lg font-medium text-xs bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 active:scale-95 transition-all"
                >
                  Effacer
                </button>
              </div>

              {/* Save Button */}
              <Button
                onClick={handlePinChange}
                disabled={
                  newPin.length !== 4 || confirmPin.length !== 4 || isSavingPin
                }
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl ring-2 ring-emerald-500/20"
              >
                {isSavingPin ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
