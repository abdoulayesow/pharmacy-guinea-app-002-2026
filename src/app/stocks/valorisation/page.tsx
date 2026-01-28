'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CircleDollarSign,
  Package,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  BarChart3,
  Layers,
  Clock,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product, ProductBatch } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';
import { getExpirationAlertLevel } from '@/lib/client/db';

// Sort options
type SortOption = 'value_desc' | 'value_asc' | 'name' | 'category';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'value_desc', label: 'Valeur (décroissant)' },
  { value: 'value_asc', label: 'Valeur (croissant)' },
  { value: 'name', label: 'Nom A-Z' },
  { value: 'category', label: 'Catégorie' },
];

interface ProductValuation {
  product: Product;
  batches: ProductBatch[];
  totalStock: number;
  totalValue: number;
  atRiskValue: number; // Value expiring within 90 days
  atRiskUnits: number;
}

export default function StockValuationPage() {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('value_desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch data from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const batches = useLiveQuery(() => db.product_batches.toArray()) ?? [];

  // Calculate valuations
  const valuationData = useMemo(() => {
    // Group batches by product
    const batchesByProduct = new Map<string, ProductBatch[]>();
    batches.forEach(batch => {
      const existing = batchesByProduct.get(batch.product_id) || [];
      existing.push(batch);
      batchesByProduct.set(batch.product_id, existing);
    });

    const now = new Date();
    const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Calculate valuation for each product
    const valuations: ProductValuation[] = products.map(product => {
      const productBatches = batchesByProduct.get(product.id!) || [];
      const unitCost = product.priceBuy || product.price * 0.7;

      // Calculate total stock from batches if available, otherwise use product stock
      let totalStock = product.stock;
      let totalValue = totalStock * unitCost;
      let atRiskValue = 0;
      let atRiskUnits = 0;

      if (productBatches.length > 0) {
        // Use batch-level data for more accurate calculation
        totalStock = productBatches.reduce((sum, b) => sum + b.quantity, 0);
        totalValue = productBatches.reduce((sum, b) => {
          const batchCost = b.unit_cost || unitCost;
          return sum + (b.quantity * batchCost);
        }, 0);

        // Calculate at-risk value (expiring within 90 days)
        productBatches.forEach(batch => {
          const expDate = new Date(batch.expiration_date);
          if (expDate <= ninetyDaysLater && batch.quantity > 0) {
            const batchCost = batch.unit_cost || unitCost;
            atRiskValue += batch.quantity * batchCost;
            atRiskUnits += batch.quantity;
          }
        });
      } else if (product.expirationDate) {
        // Use product-level expiration if no batches
        const expDate = new Date(product.expirationDate);
        if (expDate <= ninetyDaysLater && product.stock > 0) {
          atRiskValue = totalValue;
          atRiskUnits = product.stock;
        }
      }

      return {
        product,
        batches: productBatches,
        totalStock,
        totalValue,
        atRiskValue,
        atRiskUnits,
      };
    }).filter(v => v.totalStock > 0); // Only show products with stock

    // Sort valuations
    valuations.sort((a, b) => {
      switch (sortBy) {
        case 'value_desc':
          return b.totalValue - a.totalValue;
        case 'value_asc':
          return a.totalValue - b.totalValue;
        case 'name':
          return a.product.name.localeCompare(b.product.name);
        case 'category':
          return a.product.category.localeCompare(b.product.category);
        default:
          return 0;
      }
    });

    // Filter by category if selected
    const filteredValuations = selectedCategory
      ? valuations.filter(v => v.product.category === selectedCategory)
      : valuations;

    // Calculate totals
    const totalStockValue = filteredValuations.reduce((sum, v) => sum + v.totalValue, 0);
    const totalAtRiskValue = filteredValuations.reduce((sum, v) => sum + v.atRiskValue, 0);
    const totalAtRiskUnits = filteredValuations.reduce((sum, v) => sum + v.atRiskUnits, 0);
    const totalProducts = filteredValuations.length;
    const totalUnits = filteredValuations.reduce((sum, v) => sum + v.totalStock, 0);

    // Calculate value by category
    const categoryBreakdown = new Map<string, { value: number; count: number }>();
    filteredValuations.forEach(v => {
      const existing = categoryBreakdown.get(v.product.category) || { value: 0, count: 0 };
      existing.value += v.totalValue;
      existing.count += 1;
      categoryBreakdown.set(v.product.category, existing);
    });

    // Get unique categories
    const categories = Array.from(new Set(products.map(p => p.category))).sort();

    return {
      valuations: filteredValuations,
      totalStockValue,
      totalAtRiskValue,
      totalAtRiskUnits,
      totalProducts,
      totalUnits,
      categoryBreakdown: Array.from(categoryBreakdown.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.value - a.value),
      categories,
    };
  }, [products, batches, sortBy, selectedCategory]);

  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label;
  const maxCategoryValue = Math.max(...valuationData.categoryBreakdown.map(c => c.value), 1);

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
              <h1 className="text-xl font-bold tracking-tight">Valorisation du stock</h1>
              <p className="text-sm text-slate-400 mt-0.5">Valeur totale de l&apos;inventaire</p>
            </div>
          </div>

          {/* Main Value Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20 shadow-lg mb-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/30">
                <CircleDollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-300/70 font-medium">Valeur totale du stock</div>
                <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                  {formatCurrency(valuationData.totalStockValue)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 pt-2 border-t border-emerald-500/20">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                {valuationData.totalProducts} produits
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {valuationData.totalUnits} unités
              </span>
            </div>
          </div>

          {/* At Risk Value */}
          {valuationData.totalAtRiskValue > 0 && (
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl p-3.5 border border-amber-500/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-amber-300/70 font-medium">Valeur à risque</div>
                    <div className="text-xs text-slate-400">Expire sous 90 jours</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-400 tabular-nums">
                    {formatCurrency(valuationData.totalAtRiskValue)}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {valuationData.totalAtRiskUnits} unités
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Category Breakdown */}
        {valuationData.categoryBreakdown.length > 1 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center ring-1 ring-purple-500/30">
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Répartition par catégorie</h3>
                <p className="text-xs text-slate-400">Valeur du stock par groupe</p>
              </div>
            </div>

            <div className="space-y-3">
              {valuationData.categoryBreakdown.map((cat, index) => {
                const percentage = (cat.value / valuationData.totalStockValue) * 100;
                const barWidth = (cat.value / maxCategoryValue) * 100;

                return (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCategory(
                      selectedCategory === cat.category ? null : cat.category
                    )}
                    className={cn(
                      'w-full text-left transition-all duration-200 rounded-lg p-2 -mx-2',
                      selectedCategory === cat.category
                        ? 'bg-purple-500/10 ring-1 ring-purple-500/30'
                        : 'hover:bg-slate-800/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white">{cat.category}</span>
                      <span className="text-sm font-bold text-slate-300 tabular-nums">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          index === 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                          index === 1 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                          index === 2 ? 'bg-gradient-to-r from-purple-500 to-purple-400' :
                          index === 3 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                          'bg-gradient-to-r from-slate-500 to-slate-400'
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-500">{cat.count} produits</span>
                      <span className="text-xs text-slate-500 tabular-nums">{percentage.toFixed(1)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="w-full mt-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 rounded-lg transition-all"
              >
                Afficher toutes les catégories
              </button>
            )}
          </div>
        )}

        {/* Sort Dropdown */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Détail par produit
          </h3>

          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg text-xs font-medium transition-all ring-1 ring-slate-700/50"
            >
              <span className="text-slate-400">Tri:</span>
              <span className="text-white">{sortLabel}</span>
              <ChevronDown className={cn(
                'w-3.5 h-3.5 text-slate-400 transition-transform',
                showSortDropdown && 'rotate-180'
              )} />
            </button>

            {showSortDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSortDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortDropdown(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-sm transition-colors',
                        sortBy === option.value
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

        {/* Product List */}
        {valuationData.valuations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
              <Package className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Aucun stock</h3>
            <p className="text-sm text-slate-500">
              Aucun produit en stock à valoriser
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {valuationData.valuations.map((valuation, index) => {
              const hasRisk = valuation.atRiskValue > 0;
              const riskPercent = valuation.totalValue > 0
                ? (valuation.atRiskValue / valuation.totalValue) * 100
                : 0;

              return (
                <div
                  key={valuation.product.id}
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
                      {/* Value Badge */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                        'bg-emerald-500/10 ring-emerald-500/30'
                      )}>
                        <CircleDollarSign className="w-5 h-5 text-emerald-400" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-white truncate">
                              {valuation.product.name}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {valuation.product.category}
                            </p>
                          </div>

                          {/* Total Value */}
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-emerald-400 tabular-nums">
                              {formatCurrency(valuation.totalValue)}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              {valuation.totalStock} unités
                            </div>
                          </div>
                        </div>

                        {/* At Risk Indicator */}
                        {hasRisk && (
                          <div className="mt-2 pt-2 border-t border-slate-700/50">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-amber-400">
                                <Clock className="w-3 h-3" />
                                À risque: {formatCurrency(valuation.atRiskValue)}
                              </span>
                              <span className="text-slate-500">
                                ({valuation.atRiskUnits} unités)
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-slate-700/50 overflow-hidden mt-1.5">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-400"
                                style={{ width: `${riskPercent}%` }}
                              />
                            </div>
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
