'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession, signOut } from 'next-auth/react';
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
  LogOut,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { db, clearDatabase, getDatabaseStats, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { savePinOfflineFirst } from '@/lib/client/sync';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/client/utils';
import type { User as UserType } from '@/lib/shared/types';
import { AUTH_CONFIG } from '@/lib/shared/config';

interface DatabaseStats {
  users: number;
  products: number;
  sales: number;
  expenses: number;
  stockMovements: number;
  suppliers: number;
  supplierOrders: number;
  supplierOrderItems: number;
  supplierReturns: number;
  productSuppliers: number;
  creditPayments: number;
  pendingSync: number;
}

export default function ParametresPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { currentUser, isAuthenticated, logout, isInactive, lastActivityAt } = useAuthStore();
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    lastPullTime,
    pulledCount,
    fullSync,
  } = useSyncStore();

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
  const [isExporting, setIsExporting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [stockAlertEnabled, setStockAlertEnabled] = useState(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('seri-stock-alerts');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [syncAlertEnabled, setSyncAlertEnabled] = useState(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('seri-sync-alerts');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

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

  // Persist notification preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seri-stock-alerts', stockAlertEnabled.toString());
    }
  }, [stockAlertEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seri-sync-alerts', syncAlertEnabled.toString());
    }
  }, [syncAlertEnabled]);

  const isOwner = currentUser?.role === 'OWNER';

  // Handle data integrity audit
  const handleAudit = async () => {
    setIsAuditing(true);
    try {
      // Gather all data from IndexedDB
      const [products, sales, stockMovements, expenses] = await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.stock_movements.toArray(),
        db.expenses.toArray(),
      ]);

      // Prepare audit payload
      const auditPayload = {
        products: products.map(p => ({
          id: p.id!,
          stock: p.stock,
          updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        })),
        sales: sales.map(s => ({
          id: s.id!,
          total: s.total,
          createdAt: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
        })),
        stockMovements: stockMovements.map(m => ({
          id: m.id!,
          productId: m.product_id,
          quantityChange: m.quantity_change,
        })),
        expenses: expenses.map(e => ({
          id: e.id!,
          amount: e.amount,
        })),
      };

      // Call audit API
      const response = await fetch('/api/sync/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(auditPayload),
      });

      if (!response.ok) {
        throw new Error('Audit failed');
      }

      const result = await response.json();
      setAuditResult(result);
      setShowAuditDialog(true);

      if (result.summary.status === 'HEALTHY') {
        toast.success('Audit termine - Aucun probleme detecte');
      } else {
        toast.warning(`Audit termine - ${result.summary.totalMismatches} probleme(s) detecte(s)`);
      }
    } catch (error) {
      console.error('Failed to run audit:', error);
      toast.error('Erreur lors de l\'audit');
    } finally {
      setIsAuditing(false);
    }
  };

  // Handle force refresh (clear local DB and re-sync from server)
  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Clear IndexedDB
      await clearDatabase();

      // Re-seed initial data (schema, etc.)
      await seedInitialData();

      // Trigger full sync from server
      await fullSync();

      toast.success('Base de donnees actualisee avec succes');
      setShowRefreshDialog(false);

      // Reload stats
      const stats = await getDatabaseStats();
      setDbStats(stats);
    } catch (error) {
      console.error('Failed to force refresh:', error);
      toast.error('Erreur lors de l\'actualisation');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle data export
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Gather all data from IndexedDB
      const [products, sales, saleItems, expenses, stockMovements, suppliers, supplierOrders] = await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.sale_items.toArray(),
        db.expenses.toArray(),
        db.stock_movements.toArray(),
        db.suppliers.toArray(),
        db.supplier_orders.toArray(),
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        pharmacy: 'Pharmacie Thierno Mamadou',
        location: 'Conakry, Guinee',
        data: {
          products,
          sales,
          saleItems,
          expenses,
          stockMovements,
          suppliers,
          supplierOrders,
        },
        stats: dbStats,
      };

      // Create JSON file
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Download file
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `seri-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Donnees exportees avec succes');
    } catch (error) {
      console.error('Failed to export data:', error);
      toast.error('Erreur lors de l\'exportation');
    } finally {
      setIsExporting(false);
    }
  };

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
      // Check if changing own PIN (to clear mustChangePin flag)
      const isChangingOwnPin = selectedUserForPin.id === session?.user?.id;
      
      // OFFLINE-FIRST: Save PIN locally first, then sync to server
      const result = await savePinOfflineFirst(selectedUserForPin.id, newPin);

      if (result.success) {
        // Also call API to update server and clear mustChangePin flag (when online)
        if (navigator.onLine && isChangingOwnPin) {
          try {
            await fetch('/api/auth/setup-pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ 
                pin: newPin, 
                confirmPin: newPin,
                clearMustChangePin: true 
              }),
            });
          } catch (apiError) {
            // Non-blocking - PIN is saved locally, will sync later
            console.log('[Settings] API call to update PIN failed:', apiError);
          }
        }

        toast.success(`PIN modifie pour ${selectedUserForPin.name}`);
        setShowPinDialog(false);
        setNewPin('');
        setConfirmPin('');
        setSelectedUserForPin(null);
      } else {
        setPinError(result.error || 'Erreur lors de la modification du PIN');
      }
    } catch (error) {
      console.error('Failed to update PIN:', error);
      toast.error('Erreur lors de la modification du PIN');
      setPinError('Erreur lors de la modification');
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
              <span className="text-white font-semibold">
                {session?.user?.name || currentUser?.name || 'Utilisateur'}
              </span>
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
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setStockAlertEnabled(newValue);
                  toast.success(newValue ? 'Alertes de stock activees' : 'Alertes de stock desactivees');
                }}
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
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setSyncAlertEnabled(newValue);
                  toast.success(newValue ? 'Alertes de sync activees' : 'Alertes de sync desactivees');
                }}
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
            {/* Sync Status */}
            <div className={cn(
              'p-4 rounded-lg border ring-2',
              pendingCount > 0 || !isOnline
                ? 'bg-amber-500/10 border-amber-500/30 ring-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/30 ring-emerald-500/20'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  pendingCount > 0 || !isOnline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                )} />
                <span className={cn(
                  'text-sm font-semibold',
                  pendingCount > 0 || !isOnline ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {!isOnline ? 'Hors ligne' : pendingCount > 0 ? 'En attente' : 'Connecte'}
                </span>
              </div>
              <p className={cn(
                'text-sm mb-2',
                pendingCount > 0 || !isOnline ? 'text-amber-300' : 'text-emerald-300'
              )}>
                {!isOnline
                  ? 'Mode hors ligne - synchronisation automatique a la reconnexion'
                  : pendingCount > 0
                  ? `${pendingCount} operation${pendingCount > 1 ? 's' : ''} en attente de synchronisation`
                  : 'Toutes les donnees sont synchronisees'}
              </p>
              {lastSyncTime && (
                <p className="text-xs text-slate-400">
                  Derniere synchronisation (envoi): {new Date(lastSyncTime).toLocaleString('fr-FR')}
                </p>
              )}
              {lastPullTime && (
                <p className="text-xs text-slate-400">
                  Derniere synchronisation (reception): {new Date(lastPullTime).toLocaleString('fr-FR')}
                  {pulledCount > 0 && ` (${pulledCount} element${pulledCount > 1 ? 's' : ''} recu${pulledCount > 1 ? 's' : ''})`}
                </p>
              )}
            </div>

            {/* Manual Sync Button */}
            <button
              onClick={() => fullSync()}
              disabled={isSyncing || !isOnline}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block">
                    {isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Envoyer et recevoir les changements
                  </span>
                </div>
              </div>
            </button>

            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center ring-1 ring-purple-500/20">
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-purple-400" />
                  )}
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block">
                    {isExporting ? 'Exportation en cours...' : 'Exporter les donnees'}
                  </span>
                  <span className="text-xs text-slate-400">Sauvegarde locale (JSON)</span>
                </div>
              </div>
            </button>

            <button
              onClick={handleAudit}
              disabled={isAuditing || !isOnline}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center ring-1 ring-cyan-500/20">
                  {isAuditing ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block">
                    {isAuditing ? 'Verification en cours...' : 'Verifier l\'integrite'}
                  </span>
                  <span className="text-xs text-slate-400">Comparer avec le serveur</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => setShowRefreshDialog(true)}
              disabled={isRefreshing || !isOnline}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/20">
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-orange-400" />
                  )}
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block">
                    {isRefreshing ? 'Actualisation en cours...' : 'Actualiser les donnees'}
                  </span>
                  <span className="text-xs text-slate-400">Reinitialiser et resynchroniser</span>
                </div>
              </div>
            </button>

            {/* Database Statistics - Collapsible */}
            <div className="border-t border-slate-700 pt-3">
              <button
                onClick={() => setShowStats(!showStats)}
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors"
              >
                <div className="text-left">
                  <span className="text-white font-medium block">Statistiques de la base</span>
                  <span className="text-xs text-slate-400">Voir les details du stockage</span>
                </div>
                {showStats ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showStats && dbStats && (
                <div className="mt-3 space-y-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Produits</span>
                    <span className="text-white font-semibold">{dbStats.products}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Ventes</span>
                    <span className="text-white font-semibold">{dbStats.sales}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Depenses</span>
                    <span className="text-white font-semibold">{dbStats.expenses}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Mouvements de stock</span>
                    <span className="text-white font-semibold">{dbStats.stockMovements}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Fournisseurs</span>
                    <span className="text-white font-semibold">{dbStats.suppliers}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Commandes fournisseurs</span>
                    <span className="text-white font-semibold">{dbStats.supplierOrders}</span>
                  </div>
                  <div className="h-px bg-slate-700 my-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 font-medium">En attente de sync</span>
                    <span className={cn(
                      'font-bold',
                      dbStats.pendingSync > 0 ? 'text-amber-400' : 'text-emerald-400'
                    )}>
                      {dbStats.pendingSync}
                    </span>
                  </div>
                </div>
              )}

              {showStats && isLoadingStats && (
                <div className="mt-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  <span className="ml-2 text-slate-400 text-sm">Chargement...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security - PIN Change */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center ring-2 ring-orange-500/20">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Securite</h3>
              <p className="text-xs sm:text-sm text-slate-400">Gestion du code PIN</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Current user's PIN change */}
            {session?.user?.id && (
              <button
                onClick={() => {
                  // Find current user in IndexedDB or create a user object from session
                  const currentUserId = session.user.id;
                  const dbUser = users.find(u => u.id === currentUserId);
                  
                  if (dbUser) {
                    handleOpenPinDialog(dbUser);
                  } else {
                    // Create a temporary user object from session for PIN change
                    const sessionUser: UserType = {
                      id: currentUserId,
                      name: session.user.name || 'Utilisateur',
                      role: (session.user.role as 'OWNER' | 'EMPLOYEE') || 'EMPLOYEE',
                      image: session.user.image || undefined,
                      createdAt: new Date(),
                    };
                    handleOpenPinDialog(sessionUser);
                  }
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors active:scale-[0.98]"
              >
                <div className="text-left">
                  <span className="text-white font-medium block">
                    Modifier mon PIN
                  </span>
                  <span className="text-xs text-slate-400">
                    {session?.user?.name || currentUser?.name || 'Utilisateur'}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/20">
                  <Key className="w-4 h-4 text-orange-400" />
                </div>
              </button>
            )}

            {/* Owner can change other users' PINs */}
            {isOwner && users.filter(u => u.id !== session?.user?.id).length > 0 && (
              <>
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-3 px-1">Autres utilisateurs</p>
                </div>
                {users
                  .filter(u => u.id !== session?.user?.id)
                  .map((user) => (
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
              </>
            )}
          </div>
        </div>

        {/* Session & Timeouts */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center ring-2 ring-indigo-500/20">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Session et delais</h3>
              <p className="text-xs sm:text-sm text-slate-400">Configuration des timeouts</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-sm">Verrouillage automatique</span>
                <span className="text-indigo-400 font-bold">{AUTH_CONFIG.INACTIVITY_TIMEOUT_MINUTES} min</span>
              </div>
              <p className="text-xs text-slate-400">
                L&apos;application se verrouille apres {AUTH_CONFIG.INACTIVITY_TIMEOUT_MINUTES} minutes d&apos;inactivite
              </p>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-sm">Duree de session Google</span>
                <span className="text-indigo-400 font-bold">{AUTH_CONFIG.SESSION_MAX_AGE_DAYS} jours</span>
              </div>
              <p className="text-xs text-slate-400">
                Reconnexion Google requise apres {AUTH_CONFIG.SESSION_MAX_AGE_DAYS} jours
              </p>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-sm">Tentatives PIN</span>
                <span className="text-indigo-400 font-bold">Max {AUTH_CONFIG.MAX_FAILED_ATTEMPTS}</span>
              </div>
              <p className="text-xs text-slate-400">
                Verrouillage 30 minutes apres {AUTH_CONFIG.MAX_FAILED_ATTEMPTS} echecs
              </p>
            </div>

            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300 text-center">
                <Info className="w-3 h-3 inline mr-1" />
                Ces valeurs sont configurees par l&apos;administrateur systeme
              </p>
            </div>
          </div>
        </div>

        {/* Account / Logout Section */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base sm:text-lg">Compte</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                {session?.user?.email || 'Gestion du compte'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  // Clear local auth state
                  logout();
                  // Sign out from Google
                  await signOut({ callbackUrl: '/login' });
                } catch (error) {
                  console.error('Logout error:', error);
                  // If signOut fails, still redirect
                  router.push('/login');
                }
              }}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-red-500/10 hover:border-red-500/30 transition-colors active:scale-[0.98] group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/20 group-hover:bg-red-500/20 group-hover:ring-red-500/40 transition-colors">
                  <LogOut className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-left">
                  <span className="text-white font-medium block group-hover:text-red-300 transition-colors">
                    Deconnexion
                  </span>
                  <span className="text-xs text-slate-400 group-hover:text-red-400/70 transition-colors">
                    Se deconnecter de Google
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

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

      {/* Force Refresh Confirmation Dialog */}
      {showRefreshDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center ring-2 ring-orange-500/40">
                  <RefreshCw className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Actualiser les donnees
                  </h3>
                </div>
              </div>
              <p className="text-slate-300 mb-6">
                Cette operation va effacer toutes les donnees locales et les re-telecharger depuis le serveur.
                Assurez-vous d&apos;avoir synchronise vos modifications avant de continuer.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRefreshDialog(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 bg-slate-800/50"
                  disabled={isRefreshing}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleForceRefresh}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-500/20"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Actualisation...
                    </>
                  ) : (
                    'Actualiser'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Result Dialog */}
      {showAuditDialog && auditResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center ring-2',
                    auditResult.summary.status === 'HEALTHY'
                      ? 'bg-emerald-500/20 ring-emerald-500/40'
                      : 'bg-amber-500/20 ring-amber-500/40'
                  )}>
                    {auditResult.summary.status === 'HEALTHY' ? (
                      <Check className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Resultat de l&apos;audit
                    </h3>
                    <p className="text-xs text-slate-400">
                      {auditResult.summary.totalChecked} element(s) verifie(s)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuditDialog(false)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {/* Summary */}
              <div className={cn(
                'p-4 rounded-lg border mb-4',
                auditResult.summary.status === 'HEALTHY'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              )}>
                <p className={cn(
                  'text-sm font-semibold',
                  auditResult.summary.status === 'HEALTHY'
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                )}>
                  {auditResult.summary.status === 'HEALTHY'
                    ? 'Toutes les donnees sont synchronisees'
                    : `${auditResult.summary.totalMismatches} probleme(s) detecte(s)`}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {/* Products */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Produits</span>
                    <span className={cn(
                      'text-sm font-bold',
                      auditResult.audit.products.mismatches.length > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    )}>
                      {auditResult.audit.products.matches} / {auditResult.audit.products.matches + auditResult.audit.products.mismatches.length}
                    </span>
                  </div>
                  {auditResult.audit.products.mismatches.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {auditResult.audit.products.mismatches.slice(0, 3).map((m: any, i: number) => (
                        <p key={i} className="text-xs text-amber-300">
                          {m.name || m.id}: {m.type}
                        </p>
                      ))}
                      {auditResult.audit.products.mismatches.length > 3 && (
                        <p className="text-xs text-slate-400">
                          +{auditResult.audit.products.mismatches.length - 3} autre(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Sales */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Ventes</span>
                    <span className={cn(
                      'text-sm font-bold',
                      auditResult.audit.sales.mismatches.length > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    )}>
                      {auditResult.audit.sales.matches} / {auditResult.audit.sales.matches + auditResult.audit.sales.mismatches.length}
                    </span>
                  </div>
                  {auditResult.audit.sales.mismatches.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {auditResult.audit.sales.mismatches.slice(0, 3).map((m: any, i: number) => (
                        <p key={i} className="text-xs text-amber-300">
                          {m.id}: {m.type}
                        </p>
                      ))}
                      {auditResult.audit.sales.mismatches.length > 3 && (
                        <p className="text-xs text-slate-400">
                          +{auditResult.audit.sales.mismatches.length - 3} autre(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Stock Movements */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Mouvements</span>
                    <span className={cn(
                      'text-sm font-bold',
                      auditResult.audit.stockMovements.mismatches.length > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    )}>
                      {auditResult.audit.stockMovements.matches} / {auditResult.audit.stockMovements.matches + auditResult.audit.stockMovements.mismatches.length}
                    </span>
                  </div>
                  {auditResult.audit.stockMovements.mismatches.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {auditResult.audit.stockMovements.mismatches.slice(0, 3).map((m: any, i: number) => (
                        <p key={i} className="text-xs text-amber-300">
                          {m.id}: {m.type}
                        </p>
                      ))}
                      {auditResult.audit.stockMovements.mismatches.length > 3 && (
                        <p className="text-xs text-slate-400">
                          +{auditResult.audit.stockMovements.mismatches.length - 3} autre(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Expenses (if OWNER) */}
                {isOwner && auditResult.audit.expenses && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">Depenses</span>
                      <span className={cn(
                        'text-sm font-bold',
                        auditResult.audit.expenses.mismatches.length > 0
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      )}>
                        {auditResult.audit.expenses.matches} / {auditResult.audit.expenses.matches + auditResult.audit.expenses.mismatches.length}
                      </span>
                    </div>
                    {auditResult.audit.expenses.mismatches.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {auditResult.audit.expenses.mismatches.slice(0, 3).map((m: any, i: number) => (
                          <p key={i} className="text-xs text-amber-300">
                            {m.id}: {m.type}
                          </p>
                        ))}
                        {auditResult.audit.expenses.mismatches.length > 3 && (
                          <p className="text-xs text-slate-400">
                            +{auditResult.audit.expenses.mismatches.length - 3} autre(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recommendation */}
              {auditResult.summary.status !== 'HEALTHY' && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300">
                    <Info className="w-3 h-3 inline mr-1" />
                    Utilisez &quot;Actualiser les donnees&quot; pour resoudre les problemes de synchronisation
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-700">
              <Button
                onClick={() => setShowAuditDialog(false)}
                className="w-full bg-slate-700 hover:bg-slate-600"
              >
                Fermer
              </Button>
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
