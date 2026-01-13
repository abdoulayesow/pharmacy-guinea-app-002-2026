'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import {
  User,
  Users,
  Database,
  Trash2,
  Key,
  Shield,
  HardDrive,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Info,
  Package,
  ShoppingCart,
  Wallet,
  ArrowLeftRight,
} from 'lucide-react';
import { db, clearDatabase, getDatabaseStats, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
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
  const { currentUser, isAuthenticated, logout } = useAuthStore();

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

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];
  const pendingSyncCount = useLiveQuery(
    () => db.sync_queue.where('status').equals('PENDING').count()
  ) ?? 0;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

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
      // For MVP, we store PIN directly (not hashed) since bcrypt is server-side only
      // In production, this would hash the PIN
      await db.users.update(selectedUserForPin.id, {
        pinHash: newPin, // TODO: Hash properly in production
      });
      toast.success(`PIN modifie pour ${selectedUserForPin.name}`);
      setShowPinDialog(false);
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-800 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h2 className="text-2xl font-bold text-white">Parametres</h2>
          <p className="text-slate-400 text-sm mt-1">
            Configuration de l&apos;application
          </p>
        </div>

        {/* Current User Profile */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <User className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">
                {currentUser?.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    isOwner
                      ? 'bg-purple-900/50 text-purple-300'
                      : 'bg-blue-900/50 text-blue-300'
                  )}
                >
                  {isOwner ? 'Proprietaire' : 'Employe'}
                </span>
              </div>
            </div>
            <Shield
              className={cn(
                'w-6 h-6',
                isOwner ? 'text-purple-400' : 'text-blue-400'
              )}
            />
          </div>
        </Card>

        {/* User Management - Owner Only */}
        {isOwner && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Utilisateurs
              </h3>
            </div>
            <Card className="divide-y divide-slate-700">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        user.role === 'OWNER'
                          ? 'bg-purple-900/30'
                          : 'bg-blue-900/30'
                      )}
                    >
                      <User
                        className={cn(
                          'w-5 h-5',
                          user.role === 'OWNER'
                            ? 'text-purple-400'
                            : 'text-blue-400'
                        )}
                      />
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-xs text-slate-400">
                        {user.role === 'OWNER' ? 'Proprietaire' : 'Employe'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenPinDialog(user)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    <Key className="w-4 h-4 text-slate-300" />
                    <span className="text-sm text-slate-300">PIN</span>
                  </button>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Database Statistics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Base de donnees
            </h3>
          </div>
          <Card className="p-5">
            {isLoadingStats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            ) : dbStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-slate-400">Produits</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {dbStats.products}
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Ventes</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {dbStats.sales}
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-slate-400">Depenses</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {dbStats.expenses}
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Mouvements</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {dbStats.stockMovements}
                    </div>
                  </div>
                </div>

                {/* Sync Status */}
                <div
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    pendingSyncCount > 0
                      ? 'bg-amber-900/20 border border-amber-800'
                      : 'bg-emerald-900/20 border border-emerald-800'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw
                      className={cn(
                        'w-5 h-5',
                        pendingSyncCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                      )}
                    />
                    <div>
                      <div
                        className={cn(
                          'font-medium text-sm',
                          pendingSyncCount > 0 ? 'text-amber-100' : 'text-emerald-100'
                        )}
                      >
                        File de synchronisation
                      </div>
                      <div
                        className={cn(
                          'text-xs',
                          pendingSyncCount > 0 ? 'text-amber-300' : 'text-emerald-300'
                        )}
                      >
                        {pendingSyncCount > 0
                          ? `${pendingSyncCount} element(s) en attente`
                          : 'Tout est synchronise'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-4">
                Impossible de charger les statistiques
              </div>
            )}
          </Card>
        </div>

        {/* App Info */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Application
            </h3>
          </div>
          <Card className="p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Version</span>
                <span className="text-white font-medium">1.0.0 (MVP)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Type</span>
                <span className="text-white font-medium">PWA Offline-First</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Stockage</span>
                <span className="text-white font-medium">IndexedDB</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Danger Zone - Owner Only */}
        {isOwner && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide">
                Zone dangereuse
              </h3>
            </div>
            <Card className="p-5 bg-red-900/10 border-red-900">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-900/50 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-100">
                    Reinitialiser la base de donnees
                  </h4>
                  <p className="text-sm text-red-300 mt-1 mb-4">
                    Supprime toutes les ventes, depenses, mouvements de stock et
                    restaure les donnees initiales. Cette action est irreversible.
                  </p>
                  <Button
                    onClick={() => setShowClearDialog(true)}
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Reinitialiser
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Clear Database Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center">
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
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                  disabled={isClearing}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleClearDatabase}
                  variant="destructive"
                  className="flex-1 bg-red-600 hover:bg-red-700"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
                    <Key className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Modifier le PIN
                    </h3>
                    <p className="text-sm text-slate-400">
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
                          ? 'border-emerald-500 bg-emerald-900/20'
                          : 'border-slate-600 bg-slate-800'
                      )}
                    >
                      {newPin.length > i && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
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
                          ? 'border-emerald-500 bg-emerald-900/20'
                          : 'border-slate-600 bg-slate-800'
                      )}
                    >
                      {confirmPin.length > i && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {pinError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm text-center">
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
                    className="h-12 rounded-lg text-lg font-semibold bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() =>
                    handleDeletePin(newPin.length < 4 || confirmPin.length === 0 ? 'new' : 'confirm')
                  }
                  className="h-12 rounded-lg font-medium bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all text-xl"
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
                  className="h-12 rounded-lg text-lg font-semibold bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  onClick={() => {
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="h-12 rounded-lg font-medium text-xs bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 active:scale-95 transition-all"
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
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl"
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
