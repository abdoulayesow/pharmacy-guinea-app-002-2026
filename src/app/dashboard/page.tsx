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
  Banknote,
} from 'lucide-react';
import { db, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
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
  const expenses = useLiveQuery(() => db.expenses.toArray()) ?? [];

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

  // Stock alerts
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  // This week stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const weekSales = sales.filter((s) => new Date(s.created_at) >= weekAgo);
  const weekRevenue = weekSales.reduce((sum, s) => sum + s.total, 0);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Welcome Header */}
        <Card className="bg-gray-800 border-gray-700">
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-white text-xl font-semibold">
                  Bonjour, {currentUser?.name}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {formatDate(new Date())}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Today's Stats */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
            Aujourd&apos;hui
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Ventes */}
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {todaySales.length}
                </div>
                <div className="text-sm text-gray-400">Ventes</div>
              </div>
            </Card>

            {/* Recettes */}
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(todayRevenue).replace(' GNF', '')}
                </div>
                <div className="text-xs text-gray-400">Recettes (GNF)</div>
              </div>
            </Card>

            {/* Dépenses */}
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(todayExpenseTotal).replace(' GNF', '')}
                </div>
                <div className="text-xs text-gray-400">Dépenses (GNF)</div>
              </div>
            </Card>

            {/* Bénéfice net */}
            <Card
              className={cn(
                todayProfit >= 0
                  ? 'bg-emerald-900/20 border-emerald-800'
                  : 'bg-red-900/20 border-red-800'
              )}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      todayProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'
                    )}
                  >
                    <Banknote className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div
                  className={cn(
                    'text-2xl font-bold mb-1',
                    todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(Math.abs(todayProfit)).replace(' GNF', '')}
                </div>
                <div
                  className={cn(
                    'text-xs font-medium',
                    todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  Bénéfice net (GNF)
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
              Alertes de stock
            </h3>
            <Link href="/stocks?filter=alerts">
              <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">
                        Attention requise
                      </h4>
                      <p className="text-sm text-gray-400">
                        {lowStockProducts.length} stock faible
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {lowStockProducts.slice(0, 3).map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="text-white font-medium">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            Stock faible
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-gray-600 text-white rounded-lg font-semibold text-sm">
                          {product.stock}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* Week Summary */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
            Cette semaine
          </h3>
          <Card className="bg-gray-800 border-gray-700">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">7 derniers jours</h4>
                  <p className="text-sm text-gray-400">Résumé hebdomadaire</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">
                    Ventes totales
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {weekSales.length}
                  </div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Recettes</div>
                  <div className="text-2xl font-bold text-white">
                    {formatCurrency(weekRevenue).replace(' GNF', '')}
                  </div>
                  <div className="text-xs text-gray-400">GNF</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
