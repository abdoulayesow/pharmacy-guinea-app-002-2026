'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  TrendingUp,
  Package,
  AlertCircle,
  BarChart3,
  Filter,
  Info,
  CircleDollarSign,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product, Sale, SaleItem } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// ABC Classification thresholds
const ABC_THRESHOLDS = {
  A: { maxPercent: 20, valuePercent: 80, color: 'emerald', label: 'Classe A' },
  B: { maxPercent: 50, valuePercent: 95, color: 'blue', label: 'Classe B' },
  C: { maxPercent: 100, valuePercent: 100, color: 'slate', label: 'Classe C' },
} as const;

type ABCClass = 'A' | 'B' | 'C';

interface ProductAnalysis {
  product: Product;
  totalSales: number;
  totalRevenue: number;
  cumulativePercent: number;
  abcClass: ABCClass;
  rank: number;
}

// Period options
type PeriodFilter = '30d' | '90d' | '365d' | 'all';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string; days: number | null }[] = [
  { value: '30d', label: '30 jours', days: 30 },
  { value: '90d', label: '90 jours', days: 90 },
  { value: '365d', label: '1 an', days: 365 },
  { value: 'all', label: 'Tout', days: null },
];

export default function ABCAnalysisPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodFilter>('90d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ABCClass | 'all'>('all');
  const [showInfo, setShowInfo] = useState(false);

  // Fetch data from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];

  // Calculate ABC Analysis
  const analysisData = useMemo(() => {
    const periodDays = PERIOD_OPTIONS.find(p => p.value === period)?.days;
    const cutoffDate = periodDays
      ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
      : null;

    // Filter sales by period
    const filteredSales = cutoffDate
      ? sales.filter(s => new Date(s.created_at) >= cutoffDate)
      : sales;

    const saleIds = new Set(filteredSales.map(s => s.id));

    // Aggregate sales by product
    const productSales = new Map<string, { units: number; revenue: number }>();

    saleItems.forEach(item => {
      if (!saleIds.has(item.sale_id)) return;

      const existing = productSales.get(item.product_id) || { units: 0, revenue: 0 };
      existing.units += item.quantity;
      existing.revenue += item.subtotal;
      productSales.set(item.product_id, existing);
    });

    // Create product analysis with revenue
    const analyses: ProductAnalysis[] = products
      .map(product => {
        const salesData = productSales.get(product.id!) || { units: 0, revenue: 0 };
        return {
          product,
          totalSales: salesData.units,
          totalRevenue: salesData.revenue,
          cumulativePercent: 0,
          abcClass: 'C' as ABCClass,
          rank: 0,
        };
      })
      .filter(a => a.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Calculate total revenue
    const totalRevenue = analyses.reduce((sum, a) => sum + a.totalRevenue, 0);

    // Calculate cumulative percentages and assign ABC classes
    let cumulativeRevenue = 0;
    analyses.forEach((analysis, index) => {
      cumulativeRevenue += analysis.totalRevenue;
      analysis.cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;
      analysis.rank = index + 1;

      // Assign ABC class based on cumulative value contribution
      const productPercent = ((index + 1) / analyses.length) * 100;
      if (analysis.cumulativePercent <= 80 && productPercent <= 20) {
        analysis.abcClass = 'A';
      } else if (analysis.cumulativePercent <= 95) {
        analysis.abcClass = 'B';
      } else {
        analysis.abcClass = 'C';
      }
    });

    // Refine ABC classification based on standard thresholds
    // A: Top products making up 80% of revenue
    // B: Next products making up 15% of revenue (80-95%)
    // C: Remaining products making up 5% of revenue
    analyses.forEach(analysis => {
      if (analysis.cumulativePercent <= 80) {
        analysis.abcClass = 'A';
      } else if (analysis.cumulativePercent <= 95) {
        analysis.abcClass = 'B';
      } else {
        analysis.abcClass = 'C';
      }
    });

    // Filter by selected class
    const filteredAnalyses = selectedClass === 'all'
      ? analyses
      : analyses.filter(a => a.abcClass === selectedClass);

    // Calculate class summaries
    const classSummaries = {
      A: { count: 0, revenue: 0, percent: 0 },
      B: { count: 0, revenue: 0, percent: 0 },
      C: { count: 0, revenue: 0, percent: 0 },
    };

    analyses.forEach(a => {
      classSummaries[a.abcClass].count++;
      classSummaries[a.abcClass].revenue += a.totalRevenue;
    });

    Object.keys(classSummaries).forEach(key => {
      const cls = key as ABCClass;
      classSummaries[cls].percent = totalRevenue > 0
        ? (classSummaries[cls].revenue / totalRevenue) * 100
        : 0;
    });

    return {
      analyses: filteredAnalyses,
      allAnalyses: analyses,
      totalRevenue,
      totalProducts: analyses.length,
      classSummaries,
    };
  }, [products, sales, saleItems, period, selectedClass]);

  const selectedPeriodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label;

  const getClassConfig = (cls: ABCClass) => {
    switch (cls) {
      case 'A':
        return {
          color: 'emerald',
          bgColor: 'bg-emerald-500/10',
          textColor: 'text-emerald-400',
          ringColor: 'ring-emerald-500/30',
          gradientFrom: 'from-emerald-500',
          gradientTo: 'to-emerald-400',
        };
      case 'B':
        return {
          color: 'blue',
          bgColor: 'bg-blue-500/10',
          textColor: 'text-blue-400',
          ringColor: 'ring-blue-500/30',
          gradientFrom: 'from-blue-500',
          gradientTo: 'to-blue-400',
        };
      case 'C':
        return {
          color: 'slate',
          bgColor: 'bg-slate-500/10',
          textColor: 'text-slate-400',
          ringColor: 'ring-slate-500/30',
          gradientFrom: 'from-slate-500',
          gradientTo: 'to-slate-400',
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
              <h1 className="text-xl font-bold tracking-tight">Analyse ABC</h1>
              <p className="text-sm text-slate-400 mt-0.5">Classification par contribution au CA</p>
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
                <BarChart3 className="w-4 h-4" />
                Qu&apos;est-ce que l&apos;analyse ABC ?
              </h4>
              <p className="text-sm text-purple-200/80 leading-relaxed mb-3">
                L&apos;analyse ABC classe vos produits par importance selon leur contribution au chiffre d&apos;affaires :
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">A</span>
                  <span className="text-slate-300">~20% des produits génèrent ~80% du CA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">B</span>
                  <span className="text-slate-300">~30% des produits génèrent ~15% du CA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-500/20 flex items-center justify-center text-slate-400 font-bold text-xs">C</span>
                  <span className="text-slate-300">~50% des produits génèrent ~5% du CA</span>
                </div>
              </div>
            </div>
          )}

          {/* Class Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            {(['A', 'B', 'C'] as ABCClass[]).map((cls) => {
              const config = getClassConfig(cls);
              const summary = analysisData.classSummaries[cls];
              const isSelected = selectedClass === cls;

              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(selectedClass === cls ? 'all' : cls)}
                  className={cn(
                    'rounded-xl p-3 border transition-all duration-200 active:scale-95',
                    isSelected
                      ? `${config.bgColor} border-${config.color}-500/50 ring-2 ${config.ringColor}`
                      : 'bg-gradient-to-br from-slate-800/80 to-slate-800/40 border-slate-700/50 hover:border-slate-600/50'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center ring-1 font-bold text-xs',
                      config.bgColor,
                      config.ringColor,
                      config.textColor
                    )}>
                      {cls}
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    {summary.count} produits
                  </div>
                  <div className={cn('text-lg font-bold tabular-nums mt-0.5', config.textColor)}>
                    {summary.percent.toFixed(0)}%
                  </div>
                </button>
              );
            })}
          </div>

          {selectedClass !== 'all' && (
            <button
              onClick={() => setSelectedClass('all')}
              className="w-full mt-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 rounded-lg transition-all"
            >
              Afficher toutes les classes
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Total Revenue */}
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Classement des produits
          </h3>
          <span className="text-sm text-slate-400">
            CA total: <span className="font-semibold text-emerald-400">{formatCurrency(analysisData.totalRevenue)}</span>
          </span>
        </div>

        {/* Product List */}
        {analysisData.analyses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
              <ShoppingCart className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Aucune vente</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Aucune vente enregistrée sur cette période. Les produits apparaîtront ici après les premières ventes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {analysisData.analyses.map((analysis, index) => {
              const config = getClassConfig(analysis.abcClass);
              const revenuePercent = analysisData.totalRevenue > 0
                ? (analysis.totalRevenue / analysisData.totalRevenue) * 100
                : 0;

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
                      {/* ABC Badge */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0 font-bold',
                        config.bgColor,
                        config.ringColor,
                        config.textColor
                      )}>
                        {analysis.abcClass}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">#{analysis.rank}</span>
                              <h4 className="font-semibold text-white truncate">
                                {analysis.product.name}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {analysis.product.category} • {analysis.totalSales} vendus
                            </p>
                          </div>

                          {/* Revenue */}
                          <div className="text-right shrink-0">
                            <div className={cn('text-sm font-bold tabular-nums', config.textColor)}>
                              {formatCurrency(analysis.totalRevenue)}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              {revenuePercent.toFixed(1)}% du CA
                            </div>
                          </div>
                        </div>

                        {/* Cumulative Bar */}
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                `bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo}`
                              )}
                              style={{ width: `${Math.min(revenuePercent * 5, 100)}%` }}
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
