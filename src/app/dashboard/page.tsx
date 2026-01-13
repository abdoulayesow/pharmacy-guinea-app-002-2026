'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { TrendingUp, TrendingDown, Package, AlertTriangle, ShoppingCart, Banknote, Activity, Clock, Building2, FileText, AlertCircle } from 'lucide-react';
import { db, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { getExpirationSummary, getExpirationStatus } from '@/lib/client/expiration';

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
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? []; // 🆕
  const supplierOrders = useLiveQuery(() => db.supplier_orders.toArray()) ?? []; // 🆕

  // Calculate today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🆕 Credit sales tracking
  const creditSales = sales.filter(s => s.payment_method === 'CREDIT' && s.payment_status !== 'PAID');
  const totalCreditDue = creditSales.reduce((sum, sale) => sum + sale.amount_due, 0);
  const overdueCreditSales = creditSales.filter(sale => {
    if (!sale.due_date) return false;
    const dueDate = new Date(sale.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  });
  const overdueAmount = overdueCreditSales.reduce((sum, sale) => sum + sale.amount_due, 0);

  const todaySales = sales.filter(s => {
    const saleDate = new Date(s.created_at);
    saleDate.setHours(0, 0, 0, 0);
    return saleDate.getTime() === today.getTime();
  });

  const todayExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    expenseDate.setHours(0, 0, 0, 0);
    return expenseDate.getTime() === today.getTime();
  });

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayProfit = todayRevenue - todayExpenseTotal;

  // Stock alerts
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const outOfStockProducts = products.filter(p => p.stock === 0);

  // 🆕 Expiration alerts
  const expirationSummary = getExpirationSummary(products);
  const expiringProducts = products.filter(p => {
    if (!p.expirationDate) return false;
    const info = getExpirationStatus(p.expirationDate);
    return info.status === 'critical' || info.status === 'warning' || info.status === 'expired';
  });

  // 🆕 Supplier debts
  const pendingOrders = supplierOrders.filter(o => o.status !== 'PAID');
  const totalOwed = pendingOrders.reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);
  const nextPayment = pendingOrders
    .filter(o => o.totalAmount > o.amountPaid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // This week stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const weekSales = sales.filter(s => new Date(s.created_at) >= weekAgo);
  const weekRevenue = weekSales.reduce((sum, s) => sum + s.total, 0);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <Header />

      <main className="max-w-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Welcome Header - Sober */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Bonjour, {currentUser?.name}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>

        {/* Today's Stats - Monochrome Grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Aujourd&apos;hui</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {todaySales.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ventes</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                {formatCurrency(todayRevenue).replace(' GNF', '')}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Recettes (GNF)</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatCurrency(todayExpenseTotal).replace(' GNF', '')}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Dépenses (GNF)</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                todayProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(todayProfit).replace(' GNF', '')}
              </div>
              <div className={`text-xs font-medium ${todayProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                Bénéfice net (GNF)
              </div>
            </Card>
          </div>
        </div>

        {/* 🆕 Expiration Alerts */}
        {expirationSummary.total > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Péremption</h3>
            <Link href="/stocks?filter=expiring">
              <Card className={`p-5 cursor-pointer transition-colors ${
                expirationSummary.expired > 0 || expirationSummary.critical > 0
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 hover:border-red-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 hover:border-amber-400'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    expirationSummary.expired > 0 || expirationSummary.critical > 0
                      ? 'bg-red-600'
                      : 'bg-amber-600'
                  }`}>
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">Produits expirant bientôt</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {expirationSummary.expired > 0 && `${expirationSummary.expired} périmé(s) • `}
                      {expirationSummary.critical > 0 && `${expirationSummary.critical} critique(s) • `}
                      {expirationSummary.warning > 0 && `${expirationSummary.warning} alerte(s)`}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {expiringProducts.slice(0, 3).map(product => {
                    const expInfo = getExpirationStatus(product.expirationDate);
                    return (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                        <div className="flex-1">
                          <div className="text-gray-900 dark:text-white font-medium">{product.name}</div>
                          <div className={`text-sm ${expInfo.color}`}>{expInfo.label}</div>
                        </div>
                        <div className={`px-3 py-1 rounded-lg font-semibold text-sm ${expInfo.bgColor} ${expInfo.color}`}>
                          {product.stock}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* 🆕 Credit Sales Tracking */}
        {creditSales.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Ventes à crédit</h3>
            <Link href="/ventes/historique">
              <Card className={`p-5 cursor-pointer transition-colors ${
                overdueCreditSales.length > 0
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 hover:border-red-400'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 hover:border-blue-400'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    overdueCreditSales.length > 0 ? 'bg-red-600' : 'bg-blue-600'
                  }`}>
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-gray-900 dark:text-white font-semibold">Crédits en attente</h4>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCreditDue)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">En cours</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{creditSales.length - overdueCreditSales.length}</div>
                  </div>
                  {overdueCreditSales.length > 0 && (
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-red-200 dark:border-red-800">
                      <div className="text-sm text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        En retard
                      </div>
                      <div className="text-2xl font-bold text-red-900 dark:text-red-300">{overdueCreditSales.length}</div>
                      <div className="text-xs text-red-700 dark:text-red-400 font-semibold mt-1">{formatCurrency(overdueAmount)}</div>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* 🆕 Supplier Debts */}
        {totalOwed > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Dettes fournisseurs</h3>
            <Link href="/fournisseurs">
              <Card className="p-5 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-gray-900 dark:text-white font-semibold">Total à payer</h4>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalOwed)}</p>
                  </div>
                </div>
                {nextPayment && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Prochain paiement</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">{suppliers.find(s => s.id === nextPayment.supplierId)?.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Échéance: {formatDate(nextPayment.dueDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(nextPayment.totalAmount - nextPayment.amountPaid)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </Link>
          </div>
        )}

        {/* Stock Alerts - Sober */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Alertes de stock</h3>
            <Link href="/stocks?filter=alerts">
              <Card className="p-5 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">Attention requise</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {outOfStockProducts.length > 0 && `${outOfStockProducts.length} rupture(s) • `}
                      {lowStockProducts.length} stock faible
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {outOfStockProducts.slice(0, 2).map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex-1">
                        <div className="text-gray-900 dark:text-white font-medium">{product.name}</div>
                        <div className="text-sm text-red-600 dark:text-red-400">Rupture de stock</div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded-lg font-semibold text-sm">
                        0
                      </div>
                    </div>
                  ))}
                  {lowStockProducts.slice(0, 3).map(product => (
                    product.stock > 0 && (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                        <div className="flex-1">
                          <div className="text-gray-900 dark:text-white font-medium">{product.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Stock faible</div>
                        </div>
                        <div className="px-3 py-1 bg-gray-700 dark:bg-gray-600 text-white rounded-lg font-semibold text-sm">
                          {product.stock}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* Week Summary - Monochrome */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Cette semaine</h3>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-gray-900 dark:text-white font-semibold">7 derniers jours</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Résumé hebdomadaire</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ventes totales</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {weekSales.length}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Recettes</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(weekRevenue).replace(' GNF', '')}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">GNF</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Sales - Sober */}
        {todaySales.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Dernières ventes</h3>
            <Card className="p-5">
              <div className="space-y-2">
                {todaySales.slice(0, 3).map(sale => (
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex-1">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(sale.created_at).toLocaleTimeString('fr-GN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white font-medium">
                        Transaction
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-900 dark:text-emerald-400 font-semibold">{formatCurrency(sale.total)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {sale.payment_method === 'ORANGE_MONEY' ? 'Orange Money' : 'Espèces'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
