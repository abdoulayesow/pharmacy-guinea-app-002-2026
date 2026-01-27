'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  Clock,
  TrendingDown,
  Filter,
  ChevronDown,
  Calendar,
  CircleDollarSign,
  Zap,
  RotateCcw,
  Info,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product, Sale, SaleItem } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// Dead stock thresholds (days without sale)
type ThresholdFilter = '30d' | '60d' | '90d';

const THRESHOLD_OPTIONS: { value: ThresholdFilter; label: string; days: number }[] = [
  { value: '30d', label: '30+ jours', days: 30 },
  { value: '60d', label: '60+ jours', days: 60 },
  { value: '90d', label: '90+ jours', days: 90 },
];

// Status classification
type StockStatus = 'dead' | 'slow' | 'normal';

interface ProductMovementAnalysis {
  product: Product;
  lastSaleDate: Date | null;
  daysSinceLastSale: number;
  totalSalesLast90Days: number;
  averageDailySales: number;
  daysOfStock: number;
  stockValue: number;
  carryingCost: number; // Estimated cost of holding inventory
  status: StockStatus;
}

export default function DeadStockPage() {
  const router = useRouter();
  const [threshold, setThreshold] = useState<ThresholdFilter>('30d');
  const [showThresholdDropdown, setShowThresholdDropdown] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StockStatus | 'all'>('all');
  const [showInfo, setShowInfo] = useState(false);

  // Fetch data from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];

  // Analyze product movement
  const analysisData = useMemo(() => {
    const thresholdDays = THRESHOLD_OPTIONS.find(t => t.value === threshold)?.days || 30;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Create sale date lookup
    const saleDateMap = new Map<string, Date>();
    sales.forEach(sale => {
      saleDateMap.set(sale.id!, new Date(sale.created_at));
    });

    // Aggregate sales by product
    const productSales = new Map<string, { lastSaleDate: Date | null; totalQty90Days: number }>();

    saleItems.forEach(item => {
      const saleDate = saleDateMap.get(item.sale_id);
      if (!saleDate) return;

      const existing = productSales.get(item.product_id) || {
        lastSaleDate: null,
        totalQty90Days: 0,
      };

      // Update last sale date
      if (!existing.lastSaleDate || saleDate > existing.lastSaleDate) {
        existing.lastSaleDate = saleDate;
      }

      // Count sales in last 90 days
      if (saleDate >= ninetyDaysAgo) {
        existing.totalQty90Days += item.quantity;
      }

      productSales.set(item.product_id, existing);
    });

    // Analyze each product
    const analyses: ProductMovementAnalysis[] = products
      .filter(p => p.stock > 0) // Only products with stock
      .map(product => {
        const salesData = productSales.get(product.id!) || {
          lastSaleDate: null,
          totalQty90Days: 0,
        };

        const daysSinceLastSale = salesData.lastSaleDate
          ? Math.floor((now.getTime() - salesData.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
          : 999; // Never sold

        const averageDailySales = salesData.totalQty90Days / 90;
        const daysOfStock = averageDailySales > 0
          ? Math.round(product.stock / averageDailySales)
          : 999;

        const unitCost = product.priceBuy || product.price * 0.7;
        const stockValue = product.stock * unitCost;

        // Estimated carrying cost (2% per month of stock value)
        const monthsOfStock = daysOfStock / 30;
        const carryingCost = stockValue * 0.02 * Math.min(monthsOfStock, 12);

        // Classify status
        let status: StockStatus;
        if (daysSinceLastSale >= 90 || (salesData.lastSaleDate === null && product.stock > 0)) {
          status = 'dead';
        } else if (daysSinceLastSale >= 30) {
          status = 'slow';
        } else {
          status = 'normal';
        }

        return {
          product,
          lastSaleDate: salesData.lastSaleDate,
          daysSinceLastSale,
          totalSalesLast90Days: salesData.totalQty90Days,
          averageDailySales,
          daysOfStock,
          stockValue,
          carryingCost,
          status,
        };
      })
      .filter(a => a.daysSinceLastSale >= thresholdDays || a.status !== 'normal')
      .sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);

    // Filter by status
    const filteredAnalyses = selectedStatus === 'all'
      ? analyses.filter(a => a.daysSinceLastSale >= thresholdDays)
      : analyses.filter(a => a.status === selectedStatus);

    // Calculate summaries
    const deadStock = analyses.filter(a => a.status === 'dead');
    const slowStock = analyses.filter(a => a.status === 'slow');

    const totalDeadValue = deadStock.reduce((sum, a) => sum + a.stockValue, 0);
    const totalSlowValue = slowStock.reduce((sum, a) => sum + a.stockValue, 0);
    const totalCarryingCost = filteredAnalyses.reduce((sum, a) => sum + a.carryingCost, 0);

    return {
      analyses: filteredAnalyses,
      deadStock,
      slowStock,
      totalDeadValue,
      totalSlowValue,
      totalCarryingCost,
      totalProducts: filteredAnalyses.length,
    };
  }, [products, sales, saleItems, threshold, selectedStatus]);

  const thresholdLabel = THRESHOLD_OPTIONS.find(t => t.value === threshold)?.label;

  const getStatusConfig = (status: StockStatus) => {
    switch (status) {
      case 'dead':
        return {
          label: 'Stock mort',
          icon: Package,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          ringColor: 'ring-red-500/30',
          badgeBg: 'bg-red-500/20',
        };
      case 'slow':
        return {
          label: 'Lent',
          icon: Clock,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          ringColor: 'ring-amber-500/30',
          badgeBg: 'bg-amber-500/20',
        };
      case 'normal':
        return {
          label: 'Normal',
          icon: Zap,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          ringColor: 'ring-emerald-500/30',
          badgeBg: 'bg-emerald-500/20',
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-900/95 backdrop-blur-xl border-b border-slate-800/50">
        <div className="px-4 py-4">
          {/* Title Row */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl transition-all duration-200 active:scale-95 ring-1 ring-slate-700/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight">Stock dormant</h1>
              <p className="text-sm text-slate-400 mt-0.5">Produits à rotation lente</p>
            </div>

            {/* Info Button */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                'p-2.5 rounded-xl transition-all duration-200 active:scale-95 ring-1',
                showInfo
                  ? 'bg-purple-500/20 ring-purple-500/50 text-purple-300'
                  : 'hover:bg-slate-800/80 ring-slate-700/50'
              )}
            >
              <Info className="w-5 h-5" />
            </button>

            {/* Threshold Selector */}
            <div className="relative">
              <button
                onClick={() => setShowThresholdDropdown(!showThresholdDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl text-sm font-medium transition-all ring-1 ring-slate-700/50 active:scale-95"
              >
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{thresholdLabel}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  showThresholdDropdown && 'rotate-180'
                )} />
              </button>

              {showThresholdDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThresholdDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-36 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {THRESHOLD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setThreshold(option.value);
                          setShowThresholdDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-sm transition-colors',
                          threshold === option.value
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'hover:bg-slate-700/50 text-slate-300'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info Panel */}
          {showInfo && (
            <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <h4 className="font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Pourquoi surveiller le stock dormant ?
              </h4>
              <p className="text-sm text-purple-200/80 leading-relaxed mb-3">
                Le stock dormant immobilise du capital et risque de périmer. Actions recommandées :
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300">Proposer des promotions pour écouler le stock</span>
                </div>
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300">Négocier un retour fournisseur si possible</span>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300">Réduire les commandes futures pour ce produit</span>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Dead Stock Value */}
            <button
              onClick={() => setSelectedStatus(selectedStatus === 'dead' ? 'all' : 'dead')}
              className={cn(
                'rounded-xl p-3.5 border transition-all duration-200 active:scale-95 text-left',
                selectedStatus === 'dead'
                  ? 'bg-red-500/10 border-red-500/50 ring-2 ring-red-500/20'
                  : 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 hover:border-red-500/40'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center ring-1 ring-red-500/30">
                  <Package className="w-4 h-4 text-red-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-red-300/70 font-medium">Stock mort</div>
              <div className="text-lg font-bold text-red-400 mt-0.5 tabular-nums">
                {formatCurrency(analysisData.totalDeadValue)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {analysisData.deadStock.length} produits
              </div>
            </button>

            {/* Slow Stock Value */}
            <button
              onClick={() => setSelectedStatus(selectedStatus === 'slow' ? 'all' : 'slow')}
              className={cn(
                'rounded-xl p-3.5 border transition-all duration-200 active:scale-95 text-left',
                selectedStatus === 'slow'
                  ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20'
                  : 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 hover:border-amber-500/40'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-amber-300/70 font-medium">Stock lent</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5 tabular-nums">
                {formatCurrency(analysisData.totalSlowValue)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {analysisData.slowStock.length} produits
              </div>
            </button>
          </div>

          {/* Carrying Cost Alert */}
          {analysisData.totalCarryingCost > 0 && (
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">Coût de stockage estimé</span>
                </div>
                <span className="text-sm font-semibold text-slate-300 tabular-nums">
                  {formatCurrency(analysisData.totalCarryingCost)}/an
                </span>
              </div>
            </div>
          )}

          {selectedStatus !== 'all' && (
            <button
              onClick={() => setSelectedStatus('all')}
              className="w-full mt-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 rounded-lg transition-all"
            >
              Afficher tous les produits
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Product Count */}
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            Produits sans mouvement
          </h3>
          <span className="text-sm text-slate-400">
            {analysisData.totalProducts} produit{analysisData.totalProducts !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Product List */}
        {analysisData.analyses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 flex items-center justify-center ring-1 ring-emerald-500/30">
              <Zap className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Excellent !</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Aucun produit dormant détecté. Tous vos produits ont été vendus récemment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {analysisData.analyses.map((analysis, index) => {
              const config = getStatusConfig(analysis.status);

              return (
                <div
                  key={analysis.product.id}
                  className={cn(
                    'relative overflow-hidden rounded-xl border transition-all duration-200',
                    'bg-gradient-to-r from-slate-800/60 to-slate-900/40',
                    'border-slate-700/50 hover:border-slate-600/50',
                    'active:scale-[0.99]'
                  )}
                  style={{
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  <div className="p-3.5">
                    <div className="flex items-start gap-3">
                      {/* Status Badge */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                        config.bgColor,
                        config.ringColor
                      )}>
                        <config.icon className={cn('w-5 h-5', config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-white truncate">
                              {analysis.product.name}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {analysis.product.category}
                            </p>
                          </div>

                          {/* Days Badge */}
                          <div className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-bold shrink-0',
                            config.badgeBg,
                            config.color
                          )}>
                            {analysis.daysSinceLastSale >= 999 ? 'Jamais vendu' : `${analysis.daysSinceLastSale}j`}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-3 pt-2 border-t border-slate-700/50">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">En stock</div>
                              <div className="text-sm font-semibold text-white tabular-nums">
                                {analysis.product.stock}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Valeur</div>
                              <div className="text-sm font-semibold text-emerald-400 tabular-nums">
                                {formatCurrency(analysis.stockValue)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Dernière vente</div>
                              <div className="text-sm font-semibold text-slate-300">
                                {analysis.lastSaleDate ? formatDate(analysis.lastSaleDate).slice(0, 5) : '—'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Suggestion */}
                        {analysis.status === 'dead' && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-xs text-red-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Envisager une promotion ou un retour fournisseur
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
