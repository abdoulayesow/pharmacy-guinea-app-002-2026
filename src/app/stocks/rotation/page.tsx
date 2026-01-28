'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  Info,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product, Sale, SaleItem } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// Turnover classification thresholds
const TURNOVER_THRESHOLDS = {
  HIGH: { min: 6, color: 'emerald', label: 'Excellent' },      // 6+ turns/year
  GOOD: { min: 4, color: 'blue', label: 'Bon' },               // 4-6 turns/year
  MODERATE: { min: 2, color: 'amber', label: 'Modéré' },       // 2-4 turns/year
  LOW: { min: 0, color: 'red', label: 'Faible' },              // <2 turns/year
} as const;

type TurnoverLevel = 'HIGH' | 'GOOD' | 'MODERATE' | 'LOW';

interface ProductTurnover {
  product: Product;
  unitsSold: number;
  costOfGoodsSold: number;
  inventoryValue: number;
  turnoverRatio: number;
  daysOfInventory: number;
  turnoverLevel: TurnoverLevel;
}

// Period options
type PeriodFilter = '30d' | '90d' | '365d' | 'all';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string; days: number | null }[] = [
  { value: '30d', label: '30 jours', days: 30 },
  { value: '90d', label: '90 jours', days: 90 },
  { value: '365d', label: '1 an', days: 365 },
  { value: 'all', label: 'Tout', days: null },
];

export default function InventoryTurnoverPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodFilter>('365d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<TurnoverLevel | 'all'>('all');
  const [showInfo, setShowInfo] = useState(false);
  const [sortBy, setSortBy] = useState<'turnover' | 'doi' | 'value'>('turnover');

  // Fetch data from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];

  // Calculate Turnover Metrics
  const turnoverData = useMemo(() => {
    const periodOption = PERIOD_OPTIONS.find(p => p.value === period);
    const periodDays = periodOption?.days;
    const cutoffDate = periodDays
      ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
      : null;

    // Filter sales by period
    const filteredSales = cutoffDate
      ? sales.filter(s => new Date(s.created_at) >= cutoffDate)
      : sales;

    const saleIds = new Set(filteredSales.map(s => s.id));

    // Aggregate sales by product
    const productSales = new Map<string, { units: number; cogs: number }>();

    saleItems.forEach(item => {
      if (!saleIds.has(item.sale_id)) return;

      const product = products.find(p => p.id === item.product_id);
      if (!product) return;

      const existing = productSales.get(item.product_id) || { units: 0, cogs: 0 };
      existing.units += item.quantity;
      // COGS = quantity * cost price (use price_buy or estimate from margin)
      const costPrice = product.priceBuy ?? (product.price / 1.3); // Assume 30% margin if no cost
      existing.cogs += item.quantity * costPrice;
      productSales.set(item.product_id, existing);
    });

    // Annualization factor
    const annualizationFactor = periodDays ? 365 / periodDays : 1;

    // Create product turnover analysis
    const analyses: ProductTurnover[] = products
      .filter(p => p.stock > 0 || productSales.has(p.id!))
      .map(product => {
        const salesData = productSales.get(product.id!) || { units: 0, cogs: 0 };
        const costPrice = product.priceBuy ?? (product.price / 1.3);
        const inventoryValue = product.stock * costPrice;

        // Annualized COGS
        const annualizedCOGS = salesData.cogs * annualizationFactor;

        // Turnover ratio = Annualized COGS / Current Inventory Value
        // For stockouts (inventory=0 but had sales), we can't calculate meaningful turnover
        const turnoverRatio = inventoryValue > 0
          ? annualizedCOGS / inventoryValue
          : 0; // Cannot calculate turnover without current inventory

        // Days of Inventory = 365 / Turnover Ratio
        const daysOfInventory = turnoverRatio > 0
          ? Math.round(365 / turnoverRatio)
          : product.stock > 0 ? 999 : 0; // 999 days if no sales but has stock, 0 if stockout

        // Classify turnover level
        let turnoverLevel: TurnoverLevel;
        if (turnoverRatio >= TURNOVER_THRESHOLDS.HIGH.min) {
          turnoverLevel = 'HIGH';
        } else if (turnoverRatio >= TURNOVER_THRESHOLDS.GOOD.min) {
          turnoverLevel = 'GOOD';
        } else if (turnoverRatio >= TURNOVER_THRESHOLDS.MODERATE.min) {
          turnoverLevel = 'MODERATE';
        } else {
          turnoverLevel = 'LOW';
        }

        return {
          product,
          unitsSold: salesData.units,
          costOfGoodsSold: salesData.cogs,
          inventoryValue,
          turnoverRatio,
          daysOfInventory,
          turnoverLevel,
        };
      });

    // Sort based on selected criteria
    const sortedAnalyses = [...analyses].sort((a, b) => {
      switch (sortBy) {
        case 'turnover':
          return b.turnoverRatio - a.turnoverRatio;
        case 'doi':
          // Sort by days of inventory ascending (lower is better, but 0 means no stock)
          if (a.daysOfInventory === 0) return 1;
          if (b.daysOfInventory === 0) return -1;
          return a.daysOfInventory - b.daysOfInventory;
        case 'value':
          return b.inventoryValue - a.inventoryValue;
        default:
          return 0;
      }
    });

    // Filter by selected level
    const filteredAnalyses = selectedLevel === 'all'
      ? sortedAnalyses
      : sortedAnalyses.filter(a => a.turnoverLevel === selectedLevel);

    // Calculate summaries
    const levelSummaries = {
      HIGH: { count: 0, value: 0 },
      GOOD: { count: 0, value: 0 },
      MODERATE: { count: 0, value: 0 },
      LOW: { count: 0, value: 0 },
    };

    analyses.forEach(a => {
      levelSummaries[a.turnoverLevel].count++;
      levelSummaries[a.turnoverLevel].value += a.inventoryValue;
    });

    // Overall metrics
    const totalInventoryValue = analyses.reduce((sum, a) => sum + a.inventoryValue, 0);
    const totalCOGS = analyses.reduce((sum, a) => sum + a.costOfGoodsSold, 0) * annualizationFactor;
    const avgTurnoverRatio = totalInventoryValue > 0 ? totalCOGS / totalInventoryValue : 0;
    const avgDaysOfInventory = avgTurnoverRatio > 0 ? Math.round(365 / avgTurnoverRatio) : 0;

    return {
      analyses: filteredAnalyses,
      allAnalyses: analyses,
      totalInventoryValue,
      avgTurnoverRatio,
      avgDaysOfInventory,
      levelSummaries,
      periodDays: periodDays || 365,
    };
  }, [products, sales, saleItems, period, selectedLevel, sortBy]);

  const selectedPeriodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label;

  const getLevelConfig = (level: TurnoverLevel) => {
    switch (level) {
      case 'HIGH':
        return {
          icon: TrendingUp,
          bgColor: 'bg-emerald-500/10',
          textColor: 'text-emerald-400',
          ringColor: 'ring-emerald-500/30',
          gradientFrom: 'from-emerald-500',
          gradientTo: 'to-emerald-400',
          label: 'Excellent',
        };
      case 'GOOD':
        return {
          icon: CheckCircle2,
          bgColor: 'bg-blue-500/10',
          textColor: 'text-blue-400',
          ringColor: 'ring-blue-500/30',
          gradientFrom: 'from-blue-500',
          gradientTo: 'to-blue-400',
          label: 'Bon',
        };
      case 'MODERATE':
        return {
          icon: Clock,
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-400',
          ringColor: 'ring-amber-500/30',
          gradientFrom: 'from-amber-500',
          gradientTo: 'to-amber-400',
          label: 'Modéré',
        };
      case 'LOW':
        return {
          icon: TrendingDown,
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-400',
          ringColor: 'ring-red-500/30',
          gradientFrom: 'from-red-500',
          gradientTo: 'to-red-400',
          label: 'Faible',
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
              aria-label="Retour"
              className="p-2.5 hover:bg-slate-800/80 rounded-xl transition-all duration-200 active:scale-95 ring-1 ring-slate-700/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight">Rotation des Stocks</h1>
              <p className="text-sm text-slate-400 mt-0.5">Taux de rotation et jours de stock</p>
            </div>

            {/* Info Button */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                'p-2.5 rounded-xl transition-all duration-200 active:scale-95 ring-1',
                showInfo
                  ? 'bg-cyan-500/20 ring-cyan-500/50 text-cyan-300'
                  : 'hover:bg-slate-800/80 ring-slate-700/50'
              )}
            >
              <Info className="w-5 h-5" />
            </button>

            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl text-sm font-medium transition-all ring-1 ring-slate-700/50 active:scale-95"
              >
                <span>{selectedPeriodLabel}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  showPeriodDropdown && 'rotate-180'
                )} />
              </button>

              {showPeriodDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPeriodDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-32 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setPeriod(option.value);
                          setShowPeriodDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-sm transition-colors',
                          period === option.value
                            ? 'bg-cyan-500/20 text-cyan-300'
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
            <div className="mb-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <h4 className="font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Comprendre la rotation des stocks
              </h4>
              <p className="text-sm text-cyan-200/80 leading-relaxed mb-3">
                La rotation des stocks mesure combien de fois votre inventaire est renouvelé par an.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                  <span className="text-slate-300"><strong>6+</strong> rotations/an = Excellent (forte demande)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  </span>
                  <span className="text-slate-300"><strong>4-6</strong> rotations/an = Bon</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                  <span className="text-slate-300"><strong>2-4</strong> rotations/an = Modéré</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  </span>
                  <span className="text-slate-300"><strong>&lt;2</strong> rotations/an = Stock dormant</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-cyan-500/20">
                <p className="text-xs text-cyan-200/60">
                  <strong>Jours de stock</strong> = 365 ÷ Taux de rotation (combien de jours le stock actuel peut couvrir)
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl p-3 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Rotation moy.
              </div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">
                {turnoverData.avgTurnoverRatio.toFixed(1)}x
              </div>
            </div>

            <div className="rounded-xl p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Jours de stock
              </div>
              <div className="text-lg font-bold text-purple-400 tabular-nums">
                {turnoverData.avgDaysOfInventory}j
              </div>
            </div>

            <div className="rounded-xl p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Valeur stock
              </div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums truncate">
                {formatCurrency(turnoverData.totalInventoryValue).replace(' GNF', '')}
              </div>
            </div>
          </div>

          {/* Level Filter Pills */}
          <div className="grid grid-cols-4 gap-2">
            {(['HIGH', 'GOOD', 'MODERATE', 'LOW'] as TurnoverLevel[]).map((level) => {
              const config = getLevelConfig(level);
              const summary = turnoverData.levelSummaries[level];
              const isSelected = selectedLevel === level;
              const IconComponent = config.icon;

              return (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(selectedLevel === level ? 'all' : level)}
                  className={cn(
                    'rounded-xl p-2 border transition-all duration-200 active:scale-95',
                    isSelected
                      ? `${config.bgColor} border-${level === 'HIGH' ? 'emerald' : level === 'GOOD' ? 'blue' : level === 'MODERATE' ? 'amber' : 'red'}-500/50 ring-2 ${config.ringColor}`
                      : 'bg-gradient-to-br from-slate-800/80 to-slate-800/40 border-slate-700/50 hover:border-slate-600/50'
                  )}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <IconComponent className={cn('w-3.5 h-3.5', config.textColor)} />
                  </div>
                  <div className={cn('text-sm font-bold tabular-nums', config.textColor)}>
                    {summary.count}
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium truncate">
                    {config.label}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedLevel !== 'all' && (
            <button
              onClick={() => setSelectedLevel('all')}
              className="w-full mt-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 rounded-lg transition-all"
            >
              Afficher tous les niveaux
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Sort Options */}
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            Analyse par produit
          </h3>
          <div className="flex gap-1">
            {[
              { key: 'turnover' as const, label: 'Rotation' },
              { key: 'doi' as const, label: 'Jours' },
              { key: 'value' as const, label: 'Valeur' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                  sortBy === opt.key
                    ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        {turnoverData.analyses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
              <Package className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Aucun produit</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Aucun produit à afficher pour ce filtre.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {turnoverData.analyses.map((analysis, index) => {
              const config = getLevelConfig(analysis.turnoverLevel);
              const IconComponent = config.icon;

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
                      {/* Level Icon */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                        config.bgColor,
                        config.ringColor
                      )}>
                        <IconComponent className={cn('w-5 h-5', config.textColor)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-white truncate">
                              {analysis.product.name}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {analysis.product.category || 'Non catégorisé'} • Stock: {analysis.product.stock}
                            </p>
                          </div>

                          {/* Turnover Stats */}
                          <div className="text-right shrink-0">
                            <div className={cn('text-sm font-bold tabular-nums', config.textColor)}>
                              {analysis.turnoverRatio >= 999
                                ? '∞'
                                : `${analysis.turnoverRatio.toFixed(1)}x`}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              {analysis.daysOfInventory >= 999
                                ? '> 1 an'
                                : `${analysis.daysOfInventory}j de stock`}
                            </div>
                          </div>
                        </div>

                        {/* Metrics Row */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {formatCurrency(analysis.inventoryValue)}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {analysis.unitsSold} vendus
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                `bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo}`
                              )}
                              style={{
                                width: `${Math.min((analysis.turnoverRatio / 12) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>
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
