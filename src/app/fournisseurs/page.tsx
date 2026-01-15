'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import { Navigation } from '@/components/Navigation';
import { Logo } from '@/components/Logo';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Plus,
  Clock,
  AlertCircle,
  Phone,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import type { Supplier, SupplierOrder } from '@/lib/shared/types';
import { SupplierListSkeleton } from '@/components/ui/Skeleton';

type FilterType = 'all' | 'overdue' | 'upcoming';

export default function FournisseursPage() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Get data from IndexedDB - useLiveQuery returns undefined while loading
  const suppliersQuery = useLiveQuery(() => db.suppliers.toArray());
  const supplierOrdersQuery = useLiveQuery(() => db.supplier_orders.toArray());

  // Loading state: queries return undefined before data is ready
  const isLoading = suppliersQuery === undefined || supplierOrdersQuery === undefined;
  const suppliers = suppliersQuery ?? [];
  const supplierOrders = supplierOrdersQuery ?? [];

  // Calculate supplier balances and status
  const getSupplierBalance = (supplierId: number) => {
    const orders = supplierOrders.filter(o => o.supplierId === supplierId);
    return orders.reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);
  };

  const getSupplierNextPayment = (supplierId: number) => {
    const pendingOrders = supplierOrders
      .filter(o => o.supplierId === supplierId && o.totalAmount > o.amountPaid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return pendingOrders[0] || null;
  };

  const getPaymentStatus = (dueDate: Date): 'overdue' | 'urgent' | 'upcoming' | 'ok' => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'urgent';
    if (daysUntil <= 7) return 'upcoming';
    return 'ok';
  };

  // Calculate summary stats
  const totalOwed = suppliers.reduce((sum, s) => sum + getSupplierBalance(s.id!), 0);
  const overdueCount = suppliers.filter(s => {
    const nextPayment = getSupplierNextPayment(s.id!);
    return nextPayment && getPaymentStatus(nextPayment.dueDate) === 'overdue';
  }).length;
  const upcomingCount = suppliers.filter(s => {
    const nextPayment = getSupplierNextPayment(s.id!);
    if (!nextPayment) return false;
    const status = getPaymentStatus(nextPayment.dueDate);
    return status === 'urgent' || status === 'upcoming';
  }).length;

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(supplier => {
    const nextPayment = getSupplierNextPayment(supplier.id!);

    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'overdue') {
      return nextPayment && getPaymentStatus(nextPayment.dueDate) === 'overdue';
    }
    if (selectedFilter === 'upcoming') {
      const status = nextPayment && getPaymentStatus(nextPayment.dueDate);
      return status === 'urgent' || status === 'upcoming';
    }
    return true;
  });

  // Sort by urgency: overdue first, then by due date
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    const paymentA = getSupplierNextPayment(a.id!);
    const paymentB = getSupplierNextPayment(b.id!);

    if (!paymentA && !paymentB) return 0;
    if (!paymentA) return 1;
    if (!paymentB) return -1;

    const statusA = getPaymentStatus(paymentA.dueDate);
    const statusB = getPaymentStatus(paymentB.dueDate);

    // Overdue comes first
    if (statusA === 'overdue' && statusB !== 'overdue') return -1;
    if (statusA !== 'overdue' && statusB === 'overdue') return 1;

    // Then sort by due date
    return new Date(paymentA.dueDate).getTime() - new Date(paymentB.dueDate).getTime();
  });

  const getStatusConfig = (status: 'overdue' | 'urgent' | 'upcoming' | 'ok') => {
    switch (status) {
      case 'overdue':
        return {
          label: 'En retard',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-300 dark:border-red-800',
          icon: AlertCircle,
        };
      case 'urgent':
        return {
          label: 'Urgent (3j)',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-100 dark:bg-orange-900/30',
          borderColor: 'border-orange-300 dark:border-orange-800',
          icon: Clock,
        };
      case 'upcoming':
        return {
          label: 'À venir (7j)',
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          borderColor: 'border-amber-300 dark:border-amber-800',
          icon: Clock,
        };
      default:
        return {
          label: 'À jour',
          color: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
          borderColor: 'border-emerald-300 dark:border-emerald-800',
          icon: CheckCircle2,
        };
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  const { isOnline, pendingCount } = useSyncStatus();

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <Logo variant="icon-simple" size="sm" />
              <div>
                <h1 className="text-lg font-bold text-white">Fournisseurs</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-gray-500')} />
                  <span className="text-xs text-gray-400">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
                  {pendingCount > 0 && (
                    <>
                      <span className="text-gray-600">•</span>
                      <span className="text-xs text-amber-400">{pendingCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Total Owed */}
          <div className="col-span-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-500/20">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Total à payer</p>
                <p className="text-3xl font-bold text-white tracking-tight">
                  {formatCurrency(totalOwed)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-500 mb-1">Fournisseurs</p>
                <p className="text-lg font-bold text-slate-300">{suppliers.length}</p>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-500 mb-1">Commandes</p>
                <p className="text-lg font-bold text-slate-300">{supplierOrders.length}</p>
              </div>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{overdueCount}</p>
            <p className="text-xs text-slate-400">En retard</p>
          </div>

          {/* Upcoming */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{upcomingCount}</p>
            <p className="text-xs text-slate-400">À venir</p>
          </div>

          {/* Paid Up */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {suppliers.length - overdueCount - upcomingCount}
            </p>
            <p className="text-xs text-slate-400">À jour</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={cn(
              'flex-1 h-12 rounded-lg font-semibold text-sm transition-all',
              selectedFilter === 'all'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            Tous
          </button>
          <button
            onClick={() => setSelectedFilter('overdue')}
            className={cn(
              'flex-1 h-12 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
              selectedFilter === 'overdue'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            <AlertCircle className="w-4 h-4" />
            En retard
            {overdueCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {overdueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedFilter('upcoming')}
            className={cn(
              'flex-1 h-12 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
              selectedFilter === 'upcoming'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            <Clock className="w-4 h-4" />
            À venir
            {upcomingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {upcomingCount}
              </span>
            )}
          </button>
        </div>

        {/* Supplier List */}
        <div className="space-y-3">
          {isLoading ? (
            <SupplierListSkeleton count={4} />
          ) : sortedSuppliers.length === 0 ? (
            <div className="py-20 text-center">
              <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-semibold mb-1">Aucun fournisseur</p>
              <p className="text-sm text-slate-400">
                {selectedFilter !== 'all'
                  ? 'pour ce filtre'
                  : 'Ajoutez votre premier fournisseur'}
              </p>
            </div>
          ) : (
            sortedSuppliers.map((supplier) => {
              const balance = getSupplierBalance(supplier.id!);
              const nextPayment = getSupplierNextPayment(supplier.id!);
              const status = nextPayment
                ? getPaymentStatus(nextPayment.dueDate)
                : 'ok';
              const statusConfig = getStatusConfig(status);
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={supplier.id}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer group active:scale-[0.98]"
                  onClick={() => router.push(`/fournisseurs/${supplier.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-emerald-500/50 transition-colors">
                        <Building2 className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white mb-1 truncate group-hover:text-emerald-400 transition-colors">
                          {supplier.name}
                        </h3>
                        {supplier.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-2">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            Crédit: {supplier.paymentTermsDays}j
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Badge */}
                    <div className="text-right shrink-0 ml-3">
                      {balance > 0 ? (
                        <div className={cn(
                          'px-3 py-1.5 rounded-lg font-bold text-sm mb-2',
                          status === 'overdue'
                            ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                            : 'bg-slate-800 text-white'
                        )}>
                          {formatCurrency(balance)}
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-lg font-semibold text-sm bg-emerald-500/10 text-emerald-400 mb-2">
                          Payé
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Next Payment Info */}
                  {nextPayment && balance > 0 && (
                    <div
                      className={cn(
                        'rounded-lg p-3 border',
                        statusConfig.bgColor,
                        statusConfig.borderColor
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <StatusIcon className={cn('w-4 h-4', statusConfig.color)} />
                          <div>
                            <p className={cn('text-xs font-semibold', statusConfig.color)}>
                              {statusConfig.label}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Échéance: {formatDate(nextPayment.dueDate)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-bold', statusConfig.color)}>
                            {formatCurrency(nextPayment.totalAmount - nextPayment.amountPaid)}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            à régler
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {balance === 0 && (
                    <div className="text-center py-2">
                      <p className="text-sm text-emerald-400 font-medium">
                        ✓ Aucun paiement en attente
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Info Card */}
        {suppliers.length === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-400 mb-3">
              💡 <span className="font-semibold">Gérez vos fournisseurs</span>
            </p>
            <ul className="text-sm text-slate-500 space-y-2">
              <li>• Suivez les commandes et crédits</li>
              <li>• Enregistrez les paiements</li>
              <li>• Gérez les retours de produits</li>
              <li>• Recevez des alertes d'échéance</li>
            </ul>
          </div>
        )}
      </main>

      {/* FAB - Add Supplier */}
      <button
        onClick={() => router.push('/fournisseurs/nouveau')}
        className="fixed right-4 bottom-24 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 ring-4 ring-emerald-500/20 hover:ring-8"
        aria-label="Ajouter un fournisseur"
      >
        <Plus className="w-7 h-7" />
      </button>

      <Navigation />
    </div>
  );
}
