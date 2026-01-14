'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { TrendingUp, TrendingDown, Package, AlertTriangle, ShoppingCart, Banknote, Clock, Building2, FileText, AlertCircle, History } from 'lucide-react';
import { db, seedInitialData } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { useActivityMonitor } from '@/hooks/useActivityMonitor';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { UserAvatar } from '@/components/UserAvatar';
import { NotificationBanner } from '@/components/NotificationBadge';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { getExpirationSummary, getExpirationStatus } from '@/lib/client/expiration';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { currentUser, isAuthenticated, updateActivity } = useAuthStore();

  // Monitor user activity and redirect to login after 5 min inactivity
  useActivityMonitor();

  // Get user info from OAuth session or Zustand store
  const userName = session?.user?.name || currentUser?.name;
  const userImage = session?.user?.image || currentUser?.image;

  // Initialize demo products/suppliers (users are created via Google OAuth)
  useEffect(() => {
    seedInitialData();
  }, []);

  // Redirect if not authenticated (check both OAuth session and Zustand store)
  useEffect(() => {
    // Wait for session to load before redirecting
    if (status === 'loading') return;

    // Allow access if either OAuth session or Zustand auth is valid
    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/dashboard')}`);
    }
  }, [isAuthenticated, session, status, router]);

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

  // Show nothing while loading or if not authenticated
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || (!isAuthenticated && !hasOAuthSession)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <Header />

      <main className="max-w-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-700">
          <div className="flex items-center gap-3 sm:gap-4">
            <UserAvatar
              name={userName}
              image={userImage}
              size="lg"
              className="w-12 h-12 sm:w-14 sm:h-14"
            />
            <div className="flex-1">
              <h2 className="text-white text-xl font-semibold">Bonjour, {userName}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>

        {/* 🆕 Urgent Payment Reminders Banner */}
        <NotificationBanner />

        {/* Today's Stats */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Aujourd&apos;hui</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {todaySales.length}
              </div>
              <div className="text-sm text-slate-400">Ventes</div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-500/20">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-400 mb-1">
                {formatCurrency(todayRevenue).replace(' GNF', '')}
              </div>
              <div className="text-xs text-emerald-400/70 font-medium">Recettes (GNF)</div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center ring-2 ring-orange-500/20">
                  <TrendingDown className="w-5 h-5 text-orange-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {formatCurrency(todayExpenseTotal).replace(' GNF', '')}
              </div>
              <div className="text-xs text-slate-400">Dépenses (GNF)</div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-2 ${
                  todayProfit >= 0
                    ? 'bg-emerald-500/10 ring-emerald-500/20'
                    : 'bg-red-500/10 ring-red-500/20'
                }`}>
                  <Banknote className={`w-5 h-5 ${todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
              </div>
              <div className={`text-2xl font-bold mb-1 ${
                todayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {formatCurrency(todayProfit).replace(' GNF', '')}
              </div>
              <div className={`text-xs font-medium ${todayProfit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                Bénéfice net (GNF)
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Accès rapide</h3>

          <div className="grid grid-cols-2 gap-3">
            {/* New Sale */}
            <Link href="/ventes/nouvelle">
              <div className="group bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-500/20 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-white text-base mb-1">Nouvelle vente</div>
                  <div className="text-xs text-slate-400">Enregistrer</div>
                </div>
              </div>
            </Link>

            {/* Sales History */}
            <Link href="/ventes/historique">
              <div className="group bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20 group-hover:scale-110 transition-transform">
                    <History className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-white text-base mb-1">Historique</div>
                  <div className="text-xs text-slate-400">Consulter</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 🆕 Expiration Alerts */}
        {expirationSummary.total > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Péremption</h3>
            <Link href="/stocks?filter=expiring">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-2 ${
                    expirationSummary.expired > 0 || expirationSummary.critical > 0
                      ? 'bg-red-500/10 ring-red-500/20'
                      : 'bg-amber-500/10 ring-amber-500/20'
                  }`}>
                    <Clock className={`w-5 h-5 ${expirationSummary.expired > 0 || expirationSummary.critical > 0 ? 'text-red-400' : 'text-amber-400'}`} />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Produits expirant bientôt</h4>
                    <p className="text-sm text-slate-400">
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
                      <div key={product.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex-1">
                          <div className="text-white font-medium">{product.name}</div>
                          <div className={`text-sm ${expInfo.color}`}>{expInfo.label}</div>
                        </div>
                        <div className={`px-3 py-1 rounded-lg font-semibold text-sm ${expInfo.bgColor} ${expInfo.color}`}>
                          {product.stock}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* 🆕 Credit Sales Tracking */}
        {creditSales.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Ventes à crédit</h3>
            <Link href="/ventes/historique">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-2 ${
                    overdueCreditSales.length > 0
                      ? 'bg-red-500/10 ring-red-500/20'
                      : 'bg-blue-500/10 ring-blue-500/20'
                  }`}>
                    <FileText className={`w-5 h-5 ${overdueCreditSales.length > 0 ? 'text-red-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-semibold">Crédits en attente</h4>
                    <p className="text-2xl font-bold text-white">{formatCurrency(totalCreditDue)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <div className="text-sm text-blue-400 mb-1">En cours</div>
                    <div className="text-2xl font-bold text-white">{creditSales.length - overdueCreditSales.length}</div>
                  </div>
                  {overdueCreditSales.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <div className="text-sm text-red-400 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        En retard
                      </div>
                      <div className="text-2xl font-bold text-red-400">{overdueCreditSales.length}</div>
                      <div className="text-xs text-red-400/70 font-semibold mt-1">{formatCurrency(overdueAmount)}</div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* 🆕 Supplier Debts */}
        {totalOwed > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Dettes fournisseurs</h3>
            <Link href="/fournisseurs">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center ring-2 ring-purple-500/20">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-semibold">Total à payer</h4>
                    <p className="text-2xl font-bold text-white">{formatCurrency(totalOwed)}</p>
                  </div>
                </div>
                {nextPayment && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <div className="text-sm text-slate-400 mb-1">Prochain paiement</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{suppliers.find(s => s.id === nextPayment.supplierId)?.name}</div>
                        <div className="text-sm text-slate-400">Échéance: {formatDate(nextPayment.dueDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">{formatCurrency(nextPayment.totalAmount - nextPayment.amountPaid)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* Stock Alerts */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Alertes de stock</h3>
            <Link href="/stocks?filter=alerts">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center ring-2 ring-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Attention requise</h4>
                    <p className="text-sm text-slate-400">
                      {outOfStockProducts.length > 0 && `${outOfStockProducts.length} rupture(s) • `}
                      {lowStockProducts.length} stock faible
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {outOfStockProducts.slice(0, 2).map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex-1">
                        <div className="text-white font-medium">{product.name}</div>
                        <div className="text-sm text-red-400">Rupture de stock</div>
                      </div>
                      <div className="px-3 py-1 bg-red-600 text-white rounded-lg font-semibold text-sm">
                        0
                      </div>
                    </div>
                  ))}
                  {lowStockProducts.slice(0, 3).map(product => (
                    product.stock > 0 && (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex-1">
                          <div className="text-white font-medium">{product.name}</div>
                          <div className="text-sm text-slate-400">Stock faible</div>
                        </div>
                        <div className="px-3 py-1 bg-slate-700 text-white rounded-lg font-semibold text-sm">
                          {product.stock}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Week Summary */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Cette semaine</h3>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center ring-2 ring-indigo-500/20">
                <Package className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold">7 derniers jours</h4>
                <p className="text-sm text-slate-400">Résumé hebdomadaire</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Ventes totales</div>
                <div className="text-3xl font-bold text-white">
                  {weekSales.length}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Recettes</div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(weekRevenue).replace(' GNF', '')}
                </div>
                <div className="text-xs text-slate-400">GNF</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        {todaySales.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Dernières ventes</h3>
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
              <div className="space-y-2">
                {todaySales.slice(0, 3).map(sale => (
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex-1">
                      <div className="text-sm text-slate-400">
                        {new Date(sale.created_at).toLocaleTimeString('fr-GN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm text-white font-medium">
                        Transaction
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-semibold">{formatCurrency(sale.total)}</div>
                      <div className="text-xs text-slate-400 capitalize">
                        {sale.payment_method === 'ORANGE_MONEY' ? 'Orange Money' : 'Espèces'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
