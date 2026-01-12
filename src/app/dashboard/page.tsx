'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  Zap,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  Phone,
  Banknote,
} from 'lucide-react';
import { db, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, isAuthenticated } = useAuthStore();

  // Initialize database
  useEffect(() => {
    seedInitialData();
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Get data from IndexedDB with live queries
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) ?? [];
  const pendingSyncCount = useLiveQuery(
    () => db.sync_queue.where('status').equals('PENDING').count()
  ) ?? 0;

  // Online status tracking
  const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;

  // Calculate today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = sales.filter((s) => {
    const saleDate = new Date(s.created_at);
    saleDate.setHours(0, 0, 0, 0);
    return saleDate.getTime() === today.getTime();
  });

  const todayExpenses = expenses.filter((e) => {
    const expenseDate = new Date(e.date);
    expenseDate.setHours(0, 0, 0, 0);
    return expenseDate.getTime() === today.getTime();
  });

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayProfit = todayRevenue - todayExpenseTotal;

  // Payment method distribution
  const cashSales = todaySales.filter((s) => s.payment_method === 'CASH');
  const orangeMoneySales = todaySales.filter((s) => s.payment_method === 'ORANGE_MONEY');
  const cashTotal = cashSales.reduce((sum, s) => sum + s.total, 0);
  const orangeMoneyTotal = orangeMoneySales.reduce((sum, s) => sum + s.total, 0);
  const cashPercentage = todayRevenue > 0 ? Math.round((cashTotal / todayRevenue) * 100) : 0;
  const orangeMoneyPercentage = todayRevenue > 0 ? Math.round((orangeMoneyTotal / todayRevenue) * 100) : 0;

  // Stock alerts
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);
  const outOfStockProducts = products.filter((p) => p.stock === 0);

  // This week stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const weekSales = sales.filter((s) => new Date(s.created_at) >= weekAgo);
  const weekRevenue = weekSales.reduce((sum, s) => sum + s.total, 0);

  // Helper to get items count for a sale
  const getItemsCount = (saleId: number | undefined) => {
    if (!saleId) return 0;
    return saleItems.filter((item) => item.sale_id === saleId).length;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-800 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Sync Status Indicator */}
        <div className="flex items-center justify-center">
          <SyncStatusIndicator />
        </div>

        {/* Welcome Header */}
        <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-700 ">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-white text-xl font-semibold">
                Bonjour, {currentUser?.name}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {formatDate(new Date())}
              </p>
            </div>
          </div>
        </div>

        {/* Prominent New Sale Button */}
        <Link href="/ventes/nouvelle">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-lg font-semibold">Nouvelle Vente</h3>
                  <p className="text-blue-100 text-sm">Demarrer une transaction</p>
                </div>
              </div>
              <ShoppingCart className="w-8 h-8 text-white/70" />
            </div>
          </div>
        </Link>

        {/* Today's Stats */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
            Aujourd&apos;hui
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-900/30 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {todaySales.length}
              </div>
              <div className="text-sm text-slate-400">Ventes</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {formatCurrency(todayRevenue).replace(' GNF', '')}
              </div>
              <div className="text-xs text-slate-400">Recettes (GNF)</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-900/30 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-orange-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {formatCurrency(todayExpenseTotal).replace(' GNF', '')}
              </div>
              <div className="text-xs text-slate-400">Depenses (GNF)</div>
            </Card>

            <Card
              className={cn(
                'p-5',
                todayProfit >= 0
                  ? 'bg-emerald-900/20 border-emerald-800'
                  : 'bg-red-900/20 border-red-800'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    todayProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'
                  )}
                >
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
              </div>
              <div
                className={cn(
                  'text-2xl font-bold mb-1',
                  todayProfit >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                )}
              >
                {todayProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(todayProfit)).replace(' GNF', '')}
              </div>
              <div
                className={cn(
                  'text-xs font-medium',
                  todayProfit >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                )}
              >
                Benefice net (GNF)
              </div>
            </Card>
          </div>
        </div>

        {/* Payment Method Distribution */}
        {todaySales.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
              Modes de paiement
            </h3>
            <Card className="p-5">
              <div className="space-y-4">
                {/* Cash */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">Especes</span>
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(cashTotal)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${cashPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-slate-400">{cashSales.length} vente(s)</span>
                      <span className="text-xs font-medium text-emerald-400">{cashPercentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Orange Money */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-900/30 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">Orange Money</span>
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(orangeMoneyTotal)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${orangeMoneyPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-slate-400">{orangeMoneySales.length} vente(s)</span>
                      <span className="text-xs font-medium text-orange-400">{orangeMoneyPercentage}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Stock Alerts */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
              Alertes de stock
            </h3>
            <Link href="/stocks?filter=alerts">
              <Card className="p-5 bg-amber-900/20 border-amber-800 active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-amber-100 font-semibold">
                      Attention requise
                    </h4>
                    <p className="text-sm text-amber-300">
                      {outOfStockProducts.length > 0 &&
                        `${outOfStockProducts.length} rupture(s) - `}
                      {lowStockProducts.length} stock faible
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {outOfStockProducts.slice(0, 2).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-red-800"
                    >
                      <div className="flex-1">
                        <div className="text-white font-medium">
                          {product.name}
                        </div>
                        <div className="text-sm text-red-400">
                          Rupture de stock
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded-full font-semibold text-sm">
                        0
                      </div>
                    </div>
                  ))}
                  {lowStockProducts.slice(0, 3).map(
                    (product) =>
                      product.stock > 0 && (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-amber-800"
                        >
                          <div className="flex-1">
                            <div className="text-white font-medium">
                              {product.name}
                            </div>
                            <div className="text-sm text-amber-400">
                              Stock faible (min: {product.minStock})
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-amber-600 text-white rounded-full font-semibold text-sm">
                            {product.stock}
                          </div>
                        </div>
                      )
                  )}
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* Week Summary */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
            Cette semaine
          </h3>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-white font-semibold">
                  7 derniers jours
                </h4>
                <p className="text-sm text-slate-400">
                  Resume hebdomadaire
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2">
                  Ventes totales
                </div>
                <div className="text-3xl font-bold text-white">
                  {weekSales.length}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2">
                  Recettes
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(weekRevenue).replace(' GNF', '')}
                </div>
                <div className="text-xs text-slate-400">GNF</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Sales */}
        {todaySales.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
              Dernieres ventes
            </h3>
            <Card className="p-5">
              <div className="space-y-2">
                {todaySales.slice(0, 5).map((sale) => {
                  const itemCount = getItemsCount(sale.id);
                  return (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-600"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">
                            {new Date(sale.created_at).toLocaleTimeString('fr-GN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {itemCount > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                              {itemCount} article{itemCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          {sale.payment_method === 'ORANGE_MONEY' ? (
                            <>
                              <Phone className="w-3 h-3" />
                              <span>Orange Money</span>
                            </>
                          ) : (
                            <>
                              <Banknote className="w-3 h-3" />
                              <span>Especes</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-semibold">
                          {formatCurrency(sale.total)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
