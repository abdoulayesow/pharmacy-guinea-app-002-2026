'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  TrendingDown,
  AlertTriangle,
  Trash2,
  Package,
  Calendar,
  BarChart3,
  Percent,
  CircleDollarSign,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { StockMovement, Product } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// Period filter options
type PeriodFilter = '7d' | '30d' | '90d' | 'all';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string; days: number | null }[] = [
  { value: '7d', label: '7 jours', days: 7 },
  { value: '30d', label: '30 jours', days: 30 },
  { value: '90d', label: '90 jours', days: 90 },
  { value: 'all', label: 'Tout', days: null },
];

// Loss type configuration
const LOSS_TYPES = {
  DAMAGED: {
    label: 'Avariés',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    ringColor: 'ring-orange-500/30',
    gradientFrom: 'from-orange-500/20',
    gradientTo: 'to-orange-600/5',
  },
  EXPIRED: {
    label: 'Périmés',
    icon: Trash2,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    ringColor: 'ring-red-500/30',
    gradientFrom: 'from-red-500/20',
    gradientTo: 'to-red-600/5',
  },
} as const;

type LossType = keyof typeof LOSS_TYPES;

interface LossData {
  productId: string;
  productName: string;
  category: string;
  totalUnits: number;
  totalValue: number;
  damagedUnits: number;
  expiredUnits: number;
  movements: StockMovement[];
}

export default function LossesReportPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedType, setSelectedType] = useState<LossType | 'all'>('all');

  // Fetch data from IndexedDB
  const movements = useLiveQuery(
    () => db.stock_movements.toArray()
  ) ?? [];

  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  // Create product lookup map
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id!, p));
    return map;
  }, [products]);

  // Filter and aggregate loss data
  const lossAnalysis = useMemo(() => {
    const periodDays = PERIOD_OPTIONS.find(p => p.value === period)?.days;
    const cutoffDate = periodDays
      ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
      : null;

    // Filter to only loss movements (DAMAGED, EXPIRED with negative quantity)
    const lossMovements = movements.filter(m => {
      const isLossType = m.type === 'DAMAGED' || m.type === 'EXPIRED';
      const isNegative = m.quantity_change < 0;
      const movementDate = new Date(m.created_at);
      const inPeriod = !cutoffDate || movementDate >= cutoffDate;
      const matchesType = selectedType === 'all' || m.type === selectedType;

      return isLossType && isNegative && inPeriod && matchesType;
    });

    // Aggregate by product
    const productLosses = new Map<string, LossData>();

    lossMovements.forEach(m => {
      const product = productMap.get(m.product_id);
      if (!product) return;

      const existing = productLosses.get(m.product_id) || {
        productId: m.product_id,
        productName: product.name,
        category: product.category,
        totalUnits: 0,
        totalValue: 0,
        damagedUnits: 0,
        expiredUnits: 0,
        movements: [],
      };

      const absQty = Math.abs(m.quantity_change);
      const unitValue = product.priceBuy || product.price * 0.7; // Use buy price or estimate

      existing.totalUnits += absQty;
      existing.totalValue += absQty * unitValue;
      existing.movements.push(m);

      if (m.type === 'DAMAGED') {
        existing.damagedUnits += absQty;
      } else if (m.type === 'EXPIRED') {
        existing.expiredUnits += absQty;
      }

      productLosses.set(m.product_id, existing);
    });

    // Sort by total value (highest losses first)
    const sortedLosses = Array.from(productLosses.values())
      .sort((a, b) => b.totalValue - a.totalValue);

    // Calculate totals
    const totalUnits = sortedLosses.reduce((sum, l) => sum + l.totalUnits, 0);
    const totalValue = sortedLosses.reduce((sum, l) => sum + l.totalValue, 0);
    const damagedUnits = sortedLosses.reduce((sum, l) => sum + l.damagedUnits, 0);
    const expiredUnits = sortedLosses.reduce((sum, l) => sum + l.expiredUnits, 0);

    // Calculate loss rate (losses / total stock value)
    const totalStockValue = products.reduce((sum, p) => {
      const unitValue = p.priceBuy || p.price * 0.7;
      return sum + (p.stock * unitValue);
    }, 0);
    const lossRate = totalStockValue > 0 ? (totalValue / totalStockValue) * 100 : 0;

    // Generate trend data (last 7 periods)
    const trendData: { label: string; value: number }[] = [];
    const trendPeriodDays = periodDays || 30;
    const trendSegments = Math.min(7, Math.ceil(trendPeriodDays / 7));

    for (let i = trendSegments - 1; i >= 0; i--) {
      const segmentEnd = new Date(Date.now() - i * (trendPeriodDays / trendSegments) * 24 * 60 * 60 * 1000);
      const segmentStart = new Date(segmentEnd.getTime() - (trendPeriodDays / trendSegments) * 24 * 60 * 60 * 1000);

      const segmentLosses = lossMovements.filter(m => {
        const date = new Date(m.created_at);
        return date >= segmentStart && date < segmentEnd;
      });

      const segmentValue = segmentLosses.reduce((sum, m) => {
        const product = productMap.get(m.product_id);
        if (!product) return sum;
        const unitValue = product.priceBuy || product.price * 0.7;
        return sum + Math.abs(m.quantity_change) * unitValue;
      }, 0);

      trendData.push({
        label: formatDate(segmentEnd).slice(0, 5), // DD/MM format
        value: segmentValue,
      });
    }

    return {
      losses: sortedLosses,
      totalUnits,
      totalValue,
      damagedUnits,
      expiredUnits,
      lossRate,
      trendData,
      movementCount: lossMovements.length,
    };
  }, [movements, products, productMap, period, selectedType]);

  // Get max value for trend chart scaling
  const maxTrendValue = Math.max(...lossAnalysis.trendData.map(d => d.value), 1);

  const selectedPeriodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label;

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
              <h1 className="text-xl font-bold tracking-tight">Rapport des pertes</h1>
              <p className="text-sm text-slate-400 mt-0.5">Analyse des avaries et péremptions</p>
            </div>

            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl text-sm font-medium transition-all ring-1 ring-slate-700/50 active:scale-95"
              >
                <Calendar className="w-4 h-4 text-slate-400" />
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
                  <div className="absolute right-0 top-full mt-2 w-36 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Total Losses Value */}
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-3.5 border border-red-500/20 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center ring-1 ring-red-500/30">
                  <CircleDollarSign className="w-4 h-4 text-red-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-red-300/70 font-medium">Valeur perdue</div>
              <div className="text-lg font-bold text-red-400 mt-0.5 tabular-nums">
                {formatCurrency(lossAnalysis.totalValue)}
              </div>
            </div>

            {/* Loss Rate */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl p-3.5 border border-amber-500/20 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
                  <Percent className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-amber-300/70 font-medium">Taux de perte</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5 tabular-nums">
                {lossAnalysis.lossRate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Units Stats */}
          <div className="grid grid-cols-3 gap-2">
            {/* Total Units */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50 shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center ring-1 ring-purple-500/30">
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Total unités</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{lossAnalysis.totalUnits}</div>
            </div>

            {/* Damaged */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50 shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center ring-1 ring-orange-500/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Avariés</div>
              <div className="text-lg font-bold tabular-nums text-orange-400 mt-0.5">{lossAnalysis.damagedUnits}</div>
            </div>

            {/* Expired */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50 shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center ring-1 ring-red-500/30">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Périmés</div>
              <div className="text-lg font-bold tabular-nums text-red-400 mt-0.5">{lossAnalysis.expiredUnits}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Trend Chart */}
        {lossAnalysis.trendData.length > 0 && lossAnalysis.totalValue > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center ring-1 ring-purple-500/30">
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Évolution des pertes</h3>
                <p className="text-xs text-slate-400">Tendance sur la période</p>
              </div>
            </div>

            {/* Simple Bar Chart */}
            <div className="flex items-end gap-1.5 h-24 mt-4">
              {lossAnalysis.trendData.map((data, index) => {
                const height = maxTrendValue > 0 ? (data.value / maxTrendValue) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-end justify-center h-20">
                      <div
                        className={cn(
                          'w-full max-w-8 rounded-t-md transition-all duration-500 ease-out',
                          data.value > 0
                            ? 'bg-gradient-to-t from-red-600 to-red-400'
                            : 'bg-slate-800'
                        )}
                        style={{
                          height: `${Math.max(height, 4)}%`,
                          animationDelay: `${index * 100}ms`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 font-medium tabular-nums">
                      {data.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Type Filter Pills */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedType('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap min-h-[36px] active:scale-95',
                selectedType === 'all'
                  ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 ring-1 ring-slate-700/50'
              )}
            >
              Tous
            </button>
            {(Object.keys(LOSS_TYPES) as LossType[]).map((type) => {
              const config = LOSS_TYPES[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap min-h-[36px] active:scale-95',
                    selectedType === type
                      ? `${config.bgColor} ${config.color} ring-1 ${config.ringColor}`
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 ring-1 ring-slate-700/50'
                  )}
                >
                  <config.icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Products with Losses */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-white">Produits les plus impactés</h3>
            <span className="text-xs text-slate-500 ml-auto">
              {lossAnalysis.losses.length} produit{lossAnalysis.losses.length !== 1 ? 's' : ''}
            </span>
          </div>

          {lossAnalysis.losses.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 flex items-center justify-center ring-1 ring-emerald-500/30">
                <Package className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Aucune perte enregistrée</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">
                Excellente nouvelle ! Aucun produit avarié ou périmé n&apos;a été déclaré sur cette période.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lossAnalysis.losses.map((loss, index) => {
                const damagedPercent = loss.totalUnits > 0 ? (loss.damagedUnits / loss.totalUnits) * 100 : 0;
                const expiredPercent = loss.totalUnits > 0 ? (loss.expiredUnits / loss.totalUnits) * 100 : 0;

                return (
                  <div
                    key={loss.productId}
                    className={cn(
                      'relative overflow-hidden rounded-xl border transition-all duration-200',
                      'bg-gradient-to-r from-slate-800/60 to-slate-900/40',
                      'border-slate-700/50 hover:border-slate-600/50',
                      'active:scale-[0.99]'
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div className="p-3.5">
                      <div className="flex items-start gap-3">
                        {/* Rank Badge */}
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0 font-bold text-sm',
                          index === 0 ? 'bg-red-500/15 ring-red-500/30 text-red-400' :
                          index === 1 ? 'bg-orange-500/15 ring-orange-500/30 text-orange-400' :
                          index === 2 ? 'bg-amber-500/15 ring-amber-500/30 text-amber-400' :
                          'bg-slate-700/30 ring-slate-600/30 text-slate-400'
                        )}>
                          #{index + 1}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-white truncate">
                                {loss.productName}
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {loss.category}
                              </p>
                            </div>

                            {/* Value Badge */}
                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold text-red-400 tabular-nums">
                                {formatCurrency(loss.totalValue)}
                              </div>
                              <div className="text-xs text-slate-500 tabular-nums">
                                {loss.totalUnits} unité{loss.totalUnits !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          {/* Loss Type Breakdown Bar */}
                          <div className="mt-3">
                            <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden flex">
                              {loss.damagedUnits > 0 && (
                                <div
                                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                                  style={{ width: `${damagedPercent}%` }}
                                />
                              )}
                              {loss.expiredUnits > 0 && (
                                <div
                                  className="h-full bg-gradient-to-r from-red-500 to-red-400"
                                  style={{ width: `${expiredPercent}%` }}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              {loss.damagedUnits > 0 && (
                                <span className="flex items-center gap-1 text-orange-400">
                                  <AlertTriangle className="w-3 h-3" />
                                  {loss.damagedUnits} avariés
                                </span>
                              )}
                              {loss.expiredUnits > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                  <Trash2 className="w-3 h-3" />
                                  {loss.expiredUnits} périmés
                                </span>
                              )}
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
      </div>

      <Navigation />
    </div>
  );
}
