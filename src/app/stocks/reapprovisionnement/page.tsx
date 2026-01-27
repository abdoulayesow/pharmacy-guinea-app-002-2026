'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  TrendingDown,
  Clock,
  ShoppingCart,
  Filter,
  ChevronDown,
  Truck,
  CalendarClock,
  Sparkles,
  PackageCheck,
  ArrowRight,
  Zap,
  AlertCircle,
  Timer,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product, Sale, SaleItem } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// Urgency levels with visual styling
type UrgencyLevel = 'critical' | 'high' | 'medium';

interface ReorderSuggestion {
  product: Product;
  currentStock: number;
  minStock: number;
  salesVelocity: number; // units per day
  daysUntilStockout: number;
  suggestedQuantity: number;
  estimatedCost: number;
  urgency: UrgencyLevel;
}

// Configuration constants
const LEAD_TIME_DAYS = 3; // Average supplier delivery time
const SAFETY_STOCK_DAYS = 7; // Buffer stock to maintain
const REORDER_MULTIPLIER = 1.5; // Order 1.5x the minimum need

// Urgency filter options
type UrgencyFilter = 'all' | 'critical' | 'high' | 'medium';

const URGENCY_OPTIONS: { value: UrgencyFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Tous', color: 'slate' },
  { value: 'critical', label: 'Critique', color: 'red' },
  { value: 'high', label: 'Élevée', color: 'orange' },
  { value: 'medium', label: 'Moyenne', color: 'amber' },
];

export default function ReorderSuggestionsPage() {
  const router = useRouter();
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'urgency' | 'value' | 'name'>('urgency');

  // Fetch data from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];

  // Calculate reorder suggestions
  const suggestions = useMemo(() => {
    // Calculate sales velocity over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSales = sales.filter(s => new Date(s.created_at) >= thirtyDaysAgo);
    const recentSaleIds = new Set(recentSales.map(s => s.id));

    // Aggregate sales by product
    const productSales = new Map<string, number>();
    saleItems.forEach(item => {
      if (!recentSaleIds.has(item.sale_id)) return;
      const existing = productSales.get(item.product_id) || 0;
      productSales.set(item.product_id, existing + item.quantity);
    });

    // Generate suggestions for products needing reorder
    const reorderList: ReorderSuggestion[] = [];

    products.forEach(product => {
      const totalSold = productSales.get(product.id!) || 0;
      const salesVelocity = totalSold / 30; // Units per day
      const currentStock = product.stock;
      const minStock = product.minStock || 0;

      // Calculate days until stockout
      const daysUntilStockout = salesVelocity > 0
        ? Math.floor(currentStock / salesVelocity)
        : currentStock > minStock ? 999 : 0;

      // Determine urgency level
      let urgency: UrgencyLevel;
      if (currentStock <= 0 || daysUntilStockout <= LEAD_TIME_DAYS) {
        urgency = 'critical';
      } else if (currentStock <= minStock || daysUntilStockout <= LEAD_TIME_DAYS + SAFETY_STOCK_DAYS) {
        urgency = 'high';
      } else if (currentStock <= minStock * 1.5 || daysUntilStockout <= LEAD_TIME_DAYS + SAFETY_STOCK_DAYS * 2) {
        urgency = 'medium';
      } else {
        // Stock is healthy, skip this product
        return;
      }

      // Calculate suggested reorder quantity
      // Formula: (lead time + safety stock days) * velocity * multiplier - current stock
      const baseNeed = (LEAD_TIME_DAYS + SAFETY_STOCK_DAYS) * salesVelocity;
      const targetStock = Math.max(baseNeed * REORDER_MULTIPLIER, minStock * 2);
      const suggestedQuantity = Math.max(
        Math.ceil(targetStock - currentStock),
        minStock // Minimum order = minStock
      );

      // Estimated cost
      const unitCost = product.priceBuy || Math.round(product.price * 0.6); // Fallback: 60% of sell price
      const estimatedCost = suggestedQuantity * unitCost;

      reorderList.push({
        product,
        currentStock,
        minStock,
        salesVelocity,
        daysUntilStockout,
        suggestedQuantity,
        estimatedCost,
        urgency,
      });
    });

    // Filter by urgency
    const filtered = urgencyFilter === 'all'
      ? reorderList
      : reorderList.filter(s => s.urgency === urgencyFilter);

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'urgency') {
        const urgencyOrder = { critical: 0, high: 1, medium: 2 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.daysUntilStockout - b.daysUntilStockout;
      }
      if (sortBy === 'value') {
        return b.estimatedCost - a.estimatedCost;
      }
      return a.product.name.localeCompare(b.product.name);
    });
  }, [products, sales, saleItems, urgencyFilter, sortBy]);

  // Summary statistics
  const summary = useMemo(() => {
    const all = suggestions.length > 0 ? suggestions : [];
    const critical = all.filter(s => s.urgency === 'critical').length;
    const high = all.filter(s => s.urgency === 'high').length;
    const medium = all.filter(s => s.urgency === 'medium').length;
    const totalCost = all.reduce((sum, s) => sum + s.estimatedCost, 0);

    return { total: all.length, critical, high, medium, totalCost };
  }, [suggestions]);

  const getUrgencyConfig = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'critical':
        return {
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-400',
          ringColor: 'ring-red-500/30',
          borderColor: 'border-red-500/30',
          gradientFrom: 'from-red-500',
          gradientTo: 'to-rose-500',
          icon: Zap,
          label: 'Critique',
        };
      case 'high':
        return {
          bgColor: 'bg-orange-500/10',
          textColor: 'text-orange-400',
          ringColor: 'ring-orange-500/30',
          borderColor: 'border-orange-500/30',
          gradientFrom: 'from-orange-500',
          gradientTo: 'to-amber-500',
          icon: AlertTriangle,
          label: 'Élevée',
        };
      case 'medium':
        return {
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-400',
          ringColor: 'ring-amber-500/30',
          borderColor: 'border-amber-500/30',
          gradientFrom: 'from-amber-500',
          gradientTo: 'to-yellow-500',
          icon: Clock,
          label: 'Moyenne',
        };
    }
  };

  const selectedFilterLabel = URGENCY_OPTIONS.find(o => o.value === urgencyFilter)?.label;

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
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Réapprovisionnement
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">Suggestions intelligentes</p>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl text-sm font-medium transition-all ring-1 ring-slate-700/50 active:scale-95"
              >
                <Filter className="w-4 h-4 text-slate-400" />
                <span>{selectedFilterLabel}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  showFilterDropdown && 'rotate-180'
                )} />
              </button>

              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-36 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {URGENCY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setUrgencyFilter(option.value);
                          setShowFilterDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2',
                          urgencyFilter === option.value
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'hover:bg-slate-700/50 text-slate-300'
                        )}
                      >
                        {option.value !== 'all' && (
                          <span className={cn(
                            'w-2 h-2 rounded-full',
                            option.value === 'critical' && 'bg-red-400',
                            option.value === 'high' && 'bg-orange-400',
                            option.value === 'medium' && 'bg-amber-400',
                          )} />
                        )}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          {summary.total > 0 ? (
            <>
              {/* Main Summary Card */}
              <div className="bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-slate-800/40 rounded-2xl p-4 border border-purple-500/30 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-300/80 uppercase tracking-wider font-medium">Coût total estimé</p>
                    <p className="text-2xl font-bold text-white mt-1 tabular-nums tracking-tight">
                      {formatCurrency(summary.totalCost)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {summary.total} produit{summary.total > 1 ? 's' : ''} à commander
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center ring-1 ring-purple-500/30">
                    <Truck className="w-7 h-7 text-purple-400" />
                  </div>
                </div>
              </div>

              {/* Urgency Breakdown */}
              <div className="grid grid-cols-3 gap-2">
                {summary.critical > 0 && (
                  <button
                    onClick={() => setUrgencyFilter(urgencyFilter === 'critical' ? 'all' : 'critical')}
                    className={cn(
                      'rounded-xl p-3 border transition-all duration-200 active:scale-95',
                      urgencyFilter === 'critical'
                        ? 'bg-red-500/20 border-red-500/50 ring-2 ring-red-500/30'
                        : 'bg-gradient-to-br from-slate-800/80 to-slate-800/40 border-slate-700/50 hover:border-red-500/30'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-slate-400 uppercase font-medium">Critique</span>
                    </div>
                    <div className="text-2xl font-bold text-red-400 mt-1 tabular-nums">{summary.critical}</div>
                  </button>
                )}
                {summary.high > 0 && (
                  <button
                    onClick={() => setUrgencyFilter(urgencyFilter === 'high' ? 'all' : 'high')}
                    className={cn(
                      'rounded-xl p-3 border transition-all duration-200 active:scale-95',
                      urgencyFilter === 'high'
                        ? 'bg-orange-500/20 border-orange-500/50 ring-2 ring-orange-500/30'
                        : 'bg-gradient-to-br from-slate-800/80 to-slate-800/40 border-slate-700/50 hover:border-orange-500/30'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-slate-400 uppercase font-medium">Élevée</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-400 mt-1 tabular-nums">{summary.high}</div>
                  </button>
                )}
                {summary.medium > 0 && (
                  <button
                    onClick={() => setUrgencyFilter(urgencyFilter === 'medium' ? 'all' : 'medium')}
                    className={cn(
                      'rounded-xl p-3 border transition-all duration-200 active:scale-95',
                      urgencyFilter === 'medium'
                        ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30'
                        : 'bg-gradient-to-br from-slate-800/80 to-slate-800/40 border-slate-700/50 hover:border-amber-500/30'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-slate-400 uppercase font-medium">Moyenne</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">{summary.medium}</div>
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Sort Options */}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 px-1 overflow-x-auto pb-2 scrollbar-hide">
            <span className="text-xs text-slate-500 font-medium shrink-0">Trier par:</span>
            {[
              { value: 'urgency', label: 'Urgence' },
              { value: 'value', label: 'Valeur' },
              { value: 'name', label: 'Nom' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as typeof sortBy)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 whitespace-nowrap',
                  sortBy === option.value
                    ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Suggestions List */}
        {suggestions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center ring-1 ring-emerald-500/30">
              <PackageCheck className="w-12 h-12 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Stock optimal</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              Tous vos produits ont des niveaux de stock satisfaisants. Aucun réapprovisionnement nécessaire pour le moment.
            </p>
            <button
              onClick={() => router.push('/stocks')}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl transition-all duration-200 ring-1 ring-emerald-500/30 active:scale-95"
            >
              <Package className="w-4 h-4" />
              Voir le stock
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => {
              const config = getUrgencyConfig(suggestion.urgency);
              const UrgencyIcon = config.icon;
              const stockPercent = suggestion.minStock > 0
                ? Math.min((suggestion.currentStock / suggestion.minStock) * 100, 100)
                : 100;

              return (
                <div
                  key={suggestion.product.id}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border transition-all duration-300',
                    'bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/40',
                    config.borderColor,
                    'hover:border-opacity-60'
                  )}
                  style={{
                    animationDelay: `${index * 40}ms`,
                  }}
                >
                  {/* Urgency Indicator Strip */}
                  <div className={cn(
                    'absolute left-0 top-0 bottom-0 w-1',
                    `bg-gradient-to-b ${config.gradientFrom} ${config.gradientTo}`
                  )} />

                  <div className="p-4 pl-5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider',
                            config.bgColor,
                            config.textColor
                          )}>
                            <UrgencyIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                          {suggestion.daysUntilStockout <= 3 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/20 text-red-300">
                              <Timer className="w-3 h-3" />
                              {suggestion.daysUntilStockout <= 0 ? 'Rupture!' : `${suggestion.daysUntilStockout}j`}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-white text-base truncate">
                          {suggestion.product.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {suggestion.product.category}
                        </p>
                      </div>

                      {/* Suggested Quantity Badge */}
                      <div className="text-right shrink-0">
                        <div className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ring-1',
                          config.bgColor,
                          config.ringColor
                        )}>
                          <ShoppingCart className={cn('w-4 h-4', config.textColor)} />
                          <span className={cn('font-bold text-lg tabular-nums', config.textColor)}>
                            +{suggestion.suggestedQuantity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">à commander</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {/* Current Stock */}
                      <div className="bg-slate-900/40 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Stock actuel</p>
                        <div className="flex items-baseline gap-1">
                          <span className={cn(
                            'text-lg font-bold tabular-nums',
                            suggestion.currentStock <= 0 ? 'text-red-400' :
                            suggestion.currentStock <= suggestion.minStock ? 'text-orange-400' : 'text-white'
                          )}>
                            {suggestion.currentStock}
                          </span>
                          <span className="text-xs text-slate-500">/ {suggestion.minStock} min</span>
                        </div>
                        {/* Mini Stock Bar */}
                        <div className="mt-1.5 h-1 rounded-full bg-slate-700/50 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              stockPercent <= 30 ? 'bg-red-500' :
                              stockPercent <= 60 ? 'bg-orange-500' : 'bg-emerald-500'
                            )}
                            style={{ width: `${stockPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Sales Velocity */}
                      <div className="bg-slate-900/40 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Vélocité</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold tabular-nums text-white">
                            {suggestion.salesVelocity.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500">/jour</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">sur 30j</p>
                      </div>

                      {/* Days Until Stockout */}
                      <div className="bg-slate-900/40 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Rupture dans</p>
                        <div className="flex items-baseline gap-1">
                          <span className={cn(
                            'text-lg font-bold tabular-nums',
                            suggestion.daysUntilStockout <= 3 ? 'text-red-400' :
                            suggestion.daysUntilStockout <= 7 ? 'text-orange-400' : 'text-white'
                          )}>
                            {suggestion.daysUntilStockout > 30 ? '30+' : suggestion.daysUntilStockout}
                          </span>
                          <span className="text-xs text-slate-500">jours</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">estimé</p>
                      </div>
                    </div>

                    {/* Footer: Cost + Action */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                      <div>
                        <p className="text-xs text-slate-500">Coût estimé</p>
                        <p className="text-sm font-bold text-white tabular-nums">
                          {formatCurrency(suggestion.estimatedCost)}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/fournisseurs/commande/nouveau?productId=${suggestion.product.id}&qty=${suggestion.suggestedQuantity}`)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 active:scale-95',
                          'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/30'
                        )}
                      >
                        <Truck className="w-4 h-4" />
                        Commander
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        {suggestions.length > 0 && (
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              Comment sont calculées les suggestions ?
            </h4>
            <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Vélocité:</strong> Ventes moyennes sur les 30 derniers jours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Rupture:</strong> Stock actuel ÷ vélocité journalière</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Quantité:</strong> Délai livraison ({LEAD_TIME_DAYS}j) + stock sécurité ({SAFETY_STOCK_DAYS}j)</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
