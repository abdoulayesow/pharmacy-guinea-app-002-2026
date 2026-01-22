'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import { Navigation } from '@/components/Navigation';
import { Logo } from '@/components/Logo';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import {
  ShoppingCart,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Smartphone,
  FileText,
  TrendingUp,
} from 'lucide-react';
import type { Sale, PaymentStatus } from '@/lib/shared/types';
import { SalesListSkeleton } from '@/components/ui/Skeleton';

type FilterType = 'all' | 'pending' | 'overdue';

export default function VentesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isAuthenticated } = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'loading') return;
    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/ventes')}`);
    }
  }, [isAuthenticated, session, status, router]);

  // Get sales from IndexedDB
  const salesQuery = useLiveQuery(() =>
    db.sales.orderBy('created_at').reverse().toArray()
  );

  const isLoading = salesQuery === undefined;
  const sales = salesQuery ?? [];

  // Calculate if a sale is overdue
  const isOverdue = (sale: Sale): boolean => {
    if (sale.payment_method !== 'CREDIT' || sale.payment_status === 'PAID' || !sale.due_date) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(sale.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's sales
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.created_at);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);

    // Pending credits
    const pendingCredits = sales.filter(s =>
      s.payment_method === 'CREDIT' && s.payment_status !== 'PAID'
    );
    const pendingAmount = pendingCredits.reduce((sum, s) => sum + s.amount_due, 0);

    // Overdue credits
    const overdueCredits = pendingCredits.filter(isOverdue);
    const overdueAmount = overdueCredits.reduce((sum, s) => sum + s.amount_due, 0);

    return {
      todayCount: todaySales.length,
      todayTotal,
      pendingCount: pendingCredits.length,
      pendingAmount,
      overdueCount: overdueCredits.length,
      overdueAmount,
    };
  }, [sales]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'pending') {
        return sale.payment_method === 'CREDIT' && sale.payment_status !== 'PAID';
      }
      if (selectedFilter === 'overdue') {
        return isOverdue(sale);
      }
      return true;
    });
  }, [sales, selectedFilter]);

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CASH':
        return { icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
      case 'ORANGE_MONEY':
        return { icon: Smartphone, color: 'text-orange-400', bg: 'bg-orange-500/10' };
      case 'CREDIT':
        return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' };
      default:
        return { icon: Banknote, color: 'text-slate-400', bg: 'bg-slate-500/10' };
    }
  };

  const getStatusConfig = (sale: Sale) => {
    if (isOverdue(sale)) {
      return {
        label: 'En retard',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: AlertCircle,
      };
    }
    if (sale.payment_method === 'CREDIT' && sale.payment_status === 'PENDING') {
      return {
        label: 'En attente',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        icon: Clock,
      };
    }
    if (sale.payment_method === 'CREDIT' && sale.payment_status === 'PARTIALLY_PAID') {
      return {
        label: 'Partiel',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        icon: Clock,
      };
    }
    return {
      label: 'Payé',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: CheckCircle2,
    };
  };

  const { isOnline, pendingCount } = useSyncStatus();

  // Show nothing while checking auth
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || (!isAuthenticated && !hasOAuthSession)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <Logo variant="icon-simple" size="sm" />
              <div>
                <h1 className="text-lg font-bold text-white">Ventes</h1>
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
          {/* Today's Sales */}
          <div className="col-span-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Ventes du jour</p>
                <p className="text-3xl font-bold text-white tracking-tight">
                  {formatCurrency(stats.todayTotal)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-500 mb-1">Transactions</p>
                <p className="text-lg font-bold text-slate-300">{stats.todayCount}</p>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="flex-1 text-center">
                <p className="text-xs text-slate-500 mb-1">Total ventes</p>
                <p className="text-lg font-bold text-slate-300">{sales.length}</p>
              </div>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{stats.pendingCount}</p>
            <p className="text-xs text-slate-400">En attente</p>
            {stats.pendingAmount > 0 && (
              <p className="text-xs text-amber-400 mt-1 truncate">{formatCurrency(stats.pendingAmount)}</p>
            )}
          </div>

          {/* Overdue */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{stats.overdueCount}</p>
            <p className="text-xs text-slate-400">En retard</p>
            {stats.overdueAmount > 0 && (
              <p className="text-xs text-red-400 mt-1 truncate">{formatCurrency(stats.overdueAmount)}</p>
            )}
          </div>

          {/* Paid */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {sales.length - stats.pendingCount}
            </p>
            <p className="text-xs text-slate-400">Payées</p>
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
            Toutes
          </button>
          <button
            onClick={() => setSelectedFilter('pending')}
            className={cn(
              'flex-1 h-12 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
              selectedFilter === 'pending'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            <Clock className="w-4 h-4" />
            Crédits
            {stats.pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {stats.pendingCount}
              </span>
            )}
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
            Retard
            {stats.overdueCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {stats.overdueCount}
              </span>
            )}
          </button>
        </div>

        {/* Sales List */}
        <div className="space-y-3">
          {isLoading ? (
            <SalesListSkeleton count={4} />
          ) : filteredSales.length === 0 ? (
            <div className="py-20 text-center">
              <ShoppingCart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-semibold mb-1">Aucune vente</p>
              <p className="text-sm text-slate-400">
                {selectedFilter !== 'all'
                  ? 'pour ce filtre'
                  : 'Créez votre première vente'}
              </p>
            </div>
          ) : (
            filteredSales.map((sale) => {
              const paymentConfig = getPaymentMethodIcon(sale.payment_method);
              const PaymentIcon = paymentConfig.icon;
              const statusConfig = getStatusConfig(sale);
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={sale.id}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer group active:scale-[0.98]"
                  onClick={() => router.push(`/ventes/detail/${sale.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn(
                        'w-12 h-12 rounded-xl border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-blue-500/50 transition-colors',
                        paymentConfig.bg
                      )}>
                        <PaymentIcon className={cn('w-6 h-6', paymentConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                            {formatCurrency(sale.total)}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-400">
                          {formatDate(new Date(sale.created_at))}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Vente #{sale.id?.toString().slice(-6).toUpperCase()}
                        </p>
                      </div>
                    </div>
                    {/* Status badge */}
                    <div className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-lg border',
                      statusConfig.bgColor,
                      statusConfig.borderColor
                    )}>
                      <StatusIcon className={cn('w-3.5 h-3.5', statusConfig.color)} />
                      <span className={cn('text-xs font-semibold', statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Credit sale info */}
                  {sale.payment_method === 'CREDIT' && sale.amount_due > 0 && (
                    <div className={cn(
                      'rounded-lg p-3 border mt-2',
                      statusConfig.bgColor,
                      statusConfig.borderColor
                    )}>
                      <div className="flex items-center justify-between">
                        <div>
                          {sale.customer_name && (
                            <p className="text-sm font-medium text-white">{sale.customer_name}</p>
                          )}
                          {sale.due_date && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Échéance: {formatDate(new Date(sale.due_date))}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-bold', statusConfig.color)}>
                            {formatCurrency(sale.amount_due)}
                          </p>
                          <p className="text-xs text-slate-400">à régler</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Info Card for empty state */}
        {sales.length === 0 && !isLoading && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-400 mb-3">
              <span className="font-semibold">Gérez vos ventes</span>
            </p>
            <ul className="text-sm text-slate-500 space-y-2">
              <li>• Enregistrez les ventes rapidement</li>
              <li>• Acceptez espèces, Orange Money ou crédit</li>
              <li>• Suivez les paiements en attente</li>
              <li>• Consultez l'historique complet</li>
            </ul>
          </div>
        )}
      </main>

      {/* FAB - New Sale */}
      <button
        onClick={() => router.push('/ventes/nouvelle')}
        className="fixed right-4 bottom-24 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 ring-4 ring-blue-500/20 hover:ring-8"
        aria-label="Nouvelle vente"
      >
        <Plus className="w-7 h-7" />
      </button>

      <Navigation />
    </div>
  );
}
