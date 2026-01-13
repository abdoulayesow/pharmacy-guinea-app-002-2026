'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
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
  const [stockAlertEnabled, setStockAlertEnabled] = useState(true);
  const [syncAlertEnabled, setSyncAlertEnabled] = useState(true);

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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <Header />

      <main className="max-w-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* User Profile */}
        <Card className="p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg">Profil utilisateur</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Informations du compte</p>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Nom</span>
              <span className="text-gray-900 dark:text-white font-semibold">{currentUser?.name}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Role</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {isOwner ? 'Proprietaire' : 'Employe(e)'}
              </span>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg">Apparence</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Personnaliser l&apos;affichage</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <span className="text-gray-900 dark:text-white font-medium block">Theme</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Clair ou sombre</span>
              </div>
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <span className="text-gray-900 dark:text-white font-medium block">Devise</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Monnaie d&apos;affichage</span>
              </div>
              <span className="text-gray-700 dark:text-gray-300 font-semibold">GNF</span>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg">Notifications</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Alertes et rappels</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
              <div>
                <span className="text-gray-900 dark:text-white font-medium block">Stock faible</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Alertes de reapprovisionnement</span>
              </div>
              <input
                type="checkbox"
                checked={stockAlertEnabled}
                onChange={(e) => setStockAlertEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
              <div>
                <span className="text-gray-900 dark:text-white font-medium block">Synchronisation</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Etat de la connexion</span>
              </div>
              <input
                type="checkbox"
                checked={syncAlertEnabled}
                onChange={(e) => setSyncAlertEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
        </Card>

        {/* Data & Sync */}
        <Card className="p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg">Donnees</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Synchronisation et sauvegarde</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className={cn(
              'p-4 rounded-lg border',
              pendingSyncCount > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  pendingSyncCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                )} />
                <span className={cn(
                  'text-sm font-semibold',
                  pendingSyncCount > 0
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                )}>
                  {pendingSyncCount > 0 ? 'En attente' : 'Connecte'}
                </span>
              </div>
              <p className={cn(
                'text-sm',
                pendingSyncCount > 0
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-emerald-600 dark:text-emerald-300'
              )}>
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} operation${pendingSyncCount > 1 ? 's' : ''} en attente de synchronisation`
                  : 'Toutes les donnees sont synchronisees'}
              </p>
            </div>

            <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="text-left">
                  <span className="text-gray-900 dark:text-white font-medium block">Forcer la synchronisation</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Synchroniser maintenant</span>
                </div>
              </div>
            </button>

            <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div className="text-left">
                  <span className="text-gray-900 dark:text-white font-medium block">Exporter les donnees</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Sauvegarde locale</span>
                </div>
              </div>
            </button>
          </div>
        </Card>

        {/* Security - Owner Only */}
        {isOwner && (
          <Card className="p-4 sm:p-5 rounded-lg shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg">Securite</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Gestion des acces</p>
              </div>
            </div>

            <div className="space-y-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleOpenPinDialog(user)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="text-left">
                    <span className="text-gray-900 dark:text-white font-medium block">
                      Modifier le PIN - {user.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {user.role === 'OWNER' ? 'Proprietaire' : 'Employe'}
                    </span>
                  </div>
                  <Key className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* About */}
        <Card className="p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Info className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base sm:text-lg">A propos</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Informations sur l&apos;application</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Version</span>
              <span className="text-gray-900 dark:text-white font-semibold">1.0.0</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Pharmacie</span>
              <span className="text-gray-900 dark:text-white font-semibold">Thierno Mamadou</span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Localisation</span>
              <span className="text-gray-900 dark:text-white font-semibold">Conakry, Guinee</span>
            </div>
          </div>
        </Card>

        {/* Danger Zone - Owner Only */}
        {isOwner && (
          <Card className="p-5 rounded-lg shadow-sm bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-900 dark:text-red-100 font-semibold text-lg">Zone dangereuse</h3>
                <p className="text-sm text-red-700 dark:text-red-300">Actions irreversibles</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowClearDialog(true)}
                className="w-full flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div className="text-left">
                    <span className="text-red-900 dark:text-red-100 font-medium block">Reinitialiser la base</span>
                    <span className="text-xs text-red-700 dark:text-red-300">Supprimer toutes les donnees</span>
                  </div>
                </div>
              </button>
            </div>
          </Card>
        )}

        {/* Footer Info */}
        <div className="p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Seri - Gestion de pharmacie<br />
            Concu pour la Pharmacie Thierno Mamadou
          </p>
        </div>
      </main>

      {/* Clear Database Confirmation Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-xl">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Confirmer la reinitialisation
                  </h3>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Toutes les donnees seront supprimees definitivement. Vous serez
                deconnecte et devrez vous reconnecter.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowClearDialog(false)}
                  variant="outline"
                  className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm shadow-xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Key className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Modifier le PIN
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {selectedUserForPin.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPinDialog(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* New PIN */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">
                  Nouveau PIN
                </label>
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-12 h-12 rounded-lg border-2 flex items-center justify-center',
                        newPin.length > i
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
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
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">
                  Confirmer le PIN
                </label>
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-12 h-12 rounded-lg border-2 flex items-center justify-center',
                        confirmPin.length > i
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
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
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
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
                    className="h-12 rounded-lg text-lg font-semibold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() =>
                    handleDeletePin(newPin.length < 4 || confirmPin.length === 0 ? 'new' : 'confirm')
                  }
                  className="h-12 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all text-xl"
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
                  className="h-12 rounded-lg text-lg font-semibold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  onClick={() => {
                    setNewPin('');
                    setConfirmPin('');
                    setPinError('');
                  }}
                  className="h-12 rounded-lg font-medium text-xs bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
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
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
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
