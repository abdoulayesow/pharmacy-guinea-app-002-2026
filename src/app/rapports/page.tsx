'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  PiggyBank,
  Percent,
  ShoppingCart,
  Calculator,
  Banknote,
  Smartphone,
  CreditCard,
  Package,
  AlertTriangle,
  Clock,
  Calendar,
  ChevronDown,
  BarChart3,
  PieChart,
  Trophy,
  Star,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import { Navigation } from '@/components/Navigation';
import { getBatchExpirationSummary, getAlertBatchesWithProducts } from '@/lib/client/expiration';
import type { ExpenseCategory } from '@/lib/shared/types';

// Expense category labels
const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  STOCK_PURCHASE: 'Achat de stock',
  SUPPLIER_PAYMENT: 'Paiement fournisseur',
  RENT: 'Loyer',
  SALARY: 'Salaire',
  ELECTRICITY: 'Électricité',
  TRANSPORT: 'Transport',
  OTHER: 'Autre',
};

// Expense category colors
const EXPENSE_COLORS: Record<ExpenseCategory, { bg: string; text: string; ring: string }> = {
  STOCK_PURCHASE: { bg: 'bg-purple-500/15', text: 'text-purple-400', ring: 'ring-purple-500/30' },
  SUPPLIER_PAYMENT: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  RENT: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  SALARY: { bg: 'bg-blue-500/15', text: 'text-blue-400', ring: 'ring-blue-500/30' },
  ELECTRICITY: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  TRANSPORT: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
  OTHER: { bg: 'bg-slate-500/15', text: 'text-slate-400', ring: 'ring-slate-500/30' },
};

type DateFilter = 'today' | 'week' | 'month' | 'all';

export default function ReportsPage() {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch data from IndexedDB
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) ?? [];
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const productBatches = useLiveQuery(() => db.product_batches.toArray()) ?? [];

  // Create product lookup
  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return { start: today, end: now, label: "Aujourd'hui" };
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: weekAgo, end: now, label: '7 derniers jours' };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { start: monthAgo, end: now, label: '30 derniers jours' };
      }
      case 'all':
        return { start: new Date(0), end: now, label: 'Tout le temps' };
    }
  }, [dateFilter]);

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= dateRange.start && saleDate <= dateRange.end;
    });
  }, [sales, dateRange]);

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= dateRange.start && expenseDate <= dateRange.end;
    });
  }, [expenses, dateRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalSales - totalExpenses;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const transactionCount = filteredSales.length;
    const avgTransaction = transactionCount > 0 ? totalSales / transactionCount : 0;

    return {
      totalSales,
      totalExpenses,
      netProfit,
      profitMargin,
      transactionCount,
      avgTransaction,
    };
  }, [filteredSales, filteredExpenses]);

  // Sales by payment method
  const salesByPayment = useMemo(() => {
    const breakdown = {
      CASH: { amount: 0, count: 0 },
      ORANGE_MONEY: { amount: 0, count: 0 },
      CREDIT: { amount: 0, count: 0 },
    };

    filteredSales.forEach(sale => {
      const method = sale.payment_method as keyof typeof breakdown;
      if (breakdown[method]) {
        breakdown[method].amount += sale.total;
        breakdown[method].count++;
      }
    });

    const total = metrics.totalSales;
    return Object.entries(breakdown).map(([method, data]) => ({
      method,
      ...data,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
    }));
  }, [filteredSales, metrics.totalSales]);

  // Expenses by category
  const expensesByCategory = useMemo(() => {
    const breakdown: Record<string, number> = {};

    filteredExpenses.forEach(expense => {
      const category = expense.category;
      breakdown[category] = (breakdown[category] || 0) + expense.amount;
    });

    const total = metrics.totalExpenses;
    return Object.entries(breakdown)
      .map(([category, amount]) => ({
        category: category as ExpenseCategory,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, metrics.totalExpenses]);

  // Top selling products
  const topProducts = useMemo(() => {
    const productStats: Record<string, { quantity: number; revenue: number; name: string }> = {};

    // Get sale items for filtered sales
    const filteredSaleIds = new Set(filteredSales.map(s => s.id));
    const filteredSaleItems = saleItems.filter(item => filteredSaleIds.has(item.sale_id));

    filteredSaleItems.forEach(item => {
      const product = productMap.get(item.product_id);
      if (!product) return;

      if (!productStats[item.product_id]) {
        productStats[item.product_id] = { quantity: 0, revenue: 0, name: product.name };
      }
      productStats[item.product_id].quantity += item.quantity;
      productStats[item.product_id].revenue += item.subtotal;
    });

    return Object.entries(productStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales, saleItems, productMap]);

  // Stock alerts with batch-level expiration analytics
  const stockAlerts = useMemo(() => {
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStock = products.filter(p => p.stock === 0).length;

    // Use batch expiration summary for detailed analytics
    const batchSummary = getBatchExpirationSummary(productBatches);

    return {
      lowStock,
      outOfStock,
      expiringSoon: batchSummary.critical + batchSummary.warning,
      expired: batchSummary.expired,
      // Value at risk
      expiredValue: batchSummary.expiredValue,
      criticalValue: batchSummary.criticalValue,
      warningValue: batchSummary.warningValue,
      totalValueAtRisk: batchSummary.totalValueAtRisk,
      // Unit counts
      totalUnitsAtRisk: batchSummary.totalUnits,
    };
  }, [products, productBatches]);

  // Get alert batches for detailed display
  const alertBatches = useMemo(() => {
    return getAlertBatchesWithProducts(productBatches, products);
  }, [productBatches, products]);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-900/95 backdrop-blur-xl border-b border-slate-800/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2.5 hover:bg-slate-800/80 rounded-xl transition-all duration-200 active:scale-95 ring-1 ring-slate-700/50"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Rapports</h1>
                <p className="text-sm text-slate-400 mt-0.5">Analyse financière</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {([
              { value: 'today', label: "Aujourd'hui" },
              { value: 'week', label: '7 jours' },
              { value: 'month', label: '30 jours' },
              { value: 'all', label: 'Tout' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDateFilter(value)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200',
                  dateFilter === value
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 ring-1 ring-slate-700/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Sales */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20 ring-1 ring-blue-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/30">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-blue-300/70 font-medium">Ventes</p>
            <p className="text-lg font-bold text-blue-100 mt-0.5 tabular-nums">
              {formatCurrency(metrics.totalSales)}
            </p>
          </div>

          {/* Total Expenses */}
          <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-4 border border-red-500/20 ring-1 ring-red-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center ring-1 ring-red-500/30">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-red-300/70 font-medium">Dépenses</p>
            <p className="text-lg font-bold text-red-100 mt-0.5 tabular-nums">
              {formatCurrency(metrics.totalExpenses)}
            </p>
          </div>

          {/* Net Profit */}
          <div className={cn(
            'bg-gradient-to-br rounded-xl p-4 border ring-1',
            metrics.netProfit >= 0
              ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 ring-emerald-500/10'
              : 'from-orange-500/10 to-orange-600/5 border-orange-500/20 ring-orange-500/10'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center ring-1',
                metrics.netProfit >= 0
                  ? 'bg-emerald-500/20 ring-emerald-500/30'
                  : 'bg-orange-500/20 ring-orange-500/30'
              )}>
                <PiggyBank className={cn(
                  'w-4 h-4',
                  metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-orange-400'
                )} />
              </div>
            </div>
            <p className={cn(
              'text-[10px] uppercase tracking-wider font-medium',
              metrics.netProfit >= 0 ? 'text-emerald-300/70' : 'text-orange-300/70'
            )}>
              Bénéfice net
            </p>
            <p className={cn(
              'text-lg font-bold mt-0.5 tabular-nums',
              metrics.netProfit >= 0 ? 'text-emerald-100' : 'text-orange-100'
            )}>
              {formatCurrency(Math.abs(metrics.netProfit))}
            </p>
          </div>

          {/* Profit Margin */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-500/20 ring-1 ring-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center ring-1 ring-purple-500/30">
                <Percent className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-purple-300/70 font-medium">Marge</p>
            <p className="text-lg font-bold text-purple-100 mt-0.5 tabular-nums">
              {metrics.profitMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Transaction Stats */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300">Transactions</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Nombre</p>
              <p className="text-xl font-bold text-white tabular-nums">{metrics.transactionCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Panier moyen</p>
              <p className="text-xl font-bold text-white tabular-nums">
                {formatCurrency(metrics.avgTransaction).replace(' GNF', '')}
                <span className="text-xs text-slate-500 font-normal ml-1">GNF</span>
              </p>
            </div>
          </div>
        </div>

        {/* Sales by Payment Method */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-300">Ventes par mode de paiement</h3>
          </div>

          <div className="space-y-3">
            {salesByPayment.map(({ method, amount, count, percentage }) => {
              const config = {
                CASH: { icon: Banknote, label: 'Espèces', color: 'emerald' },
                ORANGE_MONEY: { icon: Smartphone, label: 'Orange Money', color: 'orange' },
                CREDIT: { icon: CreditCard, label: 'Crédit', color: 'blue' },
              }[method] || { icon: Wallet, label: method, color: 'slate' };

              return (
                <div key={method}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <config.icon className={`w-4 h-4 text-${config.color}-400`} />
                      <span className="text-sm text-slate-300">{config.label}</span>
                      <span className="text-xs text-slate-500">({count})</span>
                    </div>
                    <span className="text-sm font-medium text-white tabular-nums">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        config.color === 'emerald' && 'bg-emerald-500',
                        config.color === 'orange' && 'bg-orange-500',
                        config.color === 'blue' && 'bg-blue-500'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenses by Category */}
        {expensesByCategory.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-slate-300">Dépenses par catégorie</h3>
            </div>

            <div className="space-y-3">
              {expensesByCategory.map(({ category, amount, percentage }) => {
                const colors = EXPENSE_COLORS[category] || EXPENSE_COLORS.OTHER;
                const label = EXPENSE_LABELS[category] || category;

                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn('text-sm', colors.text)}>{label}</span>
                      <span className="text-sm font-medium text-white tabular-nums">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', colors.bg.replace('/15', ''))}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Products */}
        {topProducts.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-300">Produits les plus vendus</h3>
            </div>

            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-2.5 bg-slate-700/30 rounded-lg"
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                    index === 0 && 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
                    index === 1 && 'bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30',
                    index === 2 && 'bg-orange-600/20 text-orange-400 ring-1 ring-orange-500/30',
                    index > 2 && 'bg-slate-600/20 text-slate-500 ring-1 ring-slate-600/30'
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.quantity} unités vendues</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-400 tabular-nums">
                      {formatCurrency(product.revenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stock Alerts Summary */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-300">Alertes stock</h3>
            </div>
            {stockAlerts.totalValueAtRisk > 0 && (
              <div className="text-right">
                <div className="text-xs text-slate-500">Valeur à risque</div>
                <div className="text-sm font-bold text-red-400">{formatCurrency(stockAlerts.totalValueAtRisk)}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-red-300">Rupture</span>
              </div>
              <p className="text-xl font-bold text-red-400 tabular-nums">{stockAlerts.outOfStock}</p>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-amber-300">Stock bas</span>
              </div>
              <p className="text-xl font-bold text-amber-400 tabular-nums">{stockAlerts.lowStock}</p>
            </div>

            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-orange-300">Expire bientôt</span>
              </div>
              <p className="text-xl font-bold text-orange-400 tabular-nums">{stockAlerts.expiringSoon}</p>
              {stockAlerts.criticalValue + stockAlerts.warningValue > 0 && (
                <p className="text-xs text-orange-400/70 mt-0.5">{formatCurrency(stockAlerts.criticalValue + stockAlerts.warningValue)}</p>
              )}
            </div>

            <div className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-xs text-rose-300">Expiré</span>
              </div>
              <p className="text-xl font-bold text-rose-400 tabular-nums">{stockAlerts.expired}</p>
              {stockAlerts.expiredValue > 0 && (
                <p className="text-xs text-rose-400/70 mt-0.5">{formatCurrency(stockAlerts.expiredValue)}</p>
              )}
            </div>
          </div>

          {/* Expiring batches detail */}
          {alertBatches.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Lots à risque</h4>
              <div className="space-y-2">
                {alertBatches.slice(0, 3).map(batch => {
                  const daysUntil = Math.ceil((new Date(batch.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysUntil < 0;
                  return (
                    <div key={batch.id} className="flex items-center justify-between p-2.5 bg-slate-700/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{batch.productName}</p>
                        <p className="text-xs text-slate-500 truncate">{batch.lot_number}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className={cn(
                          'text-sm font-semibold',
                          isExpired ? 'text-rose-400' : daysUntil <= 30 ? 'text-orange-400' : 'text-amber-400'
                        )}>
                          {isExpired ? 'Périmé' : `${daysUntil}j`}
                        </p>
                        <p className="text-xs text-slate-500">{batch.quantity} unités</p>
                      </div>
                    </div>
                  );
                })}
                {alertBatches.length > 3 && (
                  <p className="text-xs text-center text-slate-500 pt-1">
                    +{alertBatches.length - 3} autres lots
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Period Summary */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-500">
            Données pour: <span className="text-slate-400 font-medium">{dateRange.label}</span>
          </p>
        </div>
      </div>

      <Navigation />
    </div>
  );
}
