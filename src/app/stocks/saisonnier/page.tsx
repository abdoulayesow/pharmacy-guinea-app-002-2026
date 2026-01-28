'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Sun,
  CloudRain,
  Thermometer,
  Wind,
  Info,
  ChevronDown,
  Package,
  BarChart3,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product, Sale, SaleItem } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// Guinea seasons (simplified)
const DRY_MONTHS = [11, 12, 1, 2, 3, 4];
const WET_MONTHS = [5, 6, 7, 8, 9, 10];

const isDryMonth = (month: number) => DRY_MONTHS.includes(month);
const isWetMonth = (month: number) => WET_MONTHS.includes(month);

// French month names
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

interface MonthlyData {
  month: number;
  year: number;
  sales: number;
  revenue: number;
  season: 'DRY' | 'WET';
}

interface ProductSeasonality {
  product: Product;
  totalSales: number;
  drySales: number;
  wetSales: number;
  seasonalityIndex: number; // >1 means higher in dry, <1 means higher in wet
  trend: 'dry' | 'wet' | 'stable';
  monthlyPattern: number[];
  peakMonth: number;
  lowMonth: number;
}

type ViewMode = 'overview' | 'products' | 'monthly';

export default function SeasonalDemandPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [showInfo, setShowInfo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Fetch data from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray()) ?? [];
  const saleItems = useLiveQuery(() => db.sale_items.toArray()) ?? [];

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['Tous', ...Array.from(cats).sort()];
  }, [products]);

  // Calculate seasonal data
  const seasonalData = useMemo(() => {
    // Group sales by month
    const monthlySales = new Map<string, { sales: number; revenue: number }>();
    const productMonthlySales = new Map<string, Map<number, number>>();

    sales.forEach(sale => {
      const date = new Date(sale.created_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const month = date.getMonth();

      // Overall monthly data
      const existing = monthlySales.get(monthKey) || { sales: 0, revenue: 0 };
      existing.revenue += sale.total;
      monthlySales.set(monthKey, existing);
    });

    // Build sales lookup map for O(1) access
    const salesMap = new Map(sales.map(s => [s.id, s]));

    // Sales items by product and month
    saleItems.forEach(item => {
      const sale = salesMap.get(item.sale_id);
      if (!sale) return;

      const date = new Date(sale.created_at);
      const month = date.getMonth();

      // Update monthly sales count for overall
      const monthKey = `${date.getFullYear()}-${month}`;
      const monthData = monthlySales.get(monthKey);
      if (monthData) {
        monthData.sales += item.quantity;
      }

      // Product monthly sales
      if (!productMonthlySales.has(item.product_id)) {
        productMonthlySales.set(item.product_id, new Map());
      }
      const productMonths = productMonthlySales.get(item.product_id)!;
      productMonths.set(month, (productMonths.get(month) || 0) + item.quantity);
    });

    // Calculate monthly averages (across all years)
    const monthlyAverages: number[] = Array(12).fill(0);
    const monthCounts: number[] = Array(12).fill(0);

    monthlySales.forEach((data, key) => {
      const month = parseInt(key.split('-')[1]);
      monthlyAverages[month] += data.revenue;
      monthCounts[month]++;
    });

    monthlyAverages.forEach((total, i) => {
      monthlyAverages[i] = monthCounts[i] > 0 ? total / monthCounts[i] : 0;
    });

    // Season totals
    let dryRevenue = 0;
    let wetRevenue = 0;

    monthlyAverages.forEach((avg, month) => {
      if (isDryMonth(month + 1)) {
        dryRevenue += avg;
      } else {
        wetRevenue += avg;
      }
    });

    // Get current season
    const currentMonth = new Date().getMonth() + 1;
    const currentSeason = isDryMonth(currentMonth) ? 'DRY' : 'WET';

    // Product seasonality analysis
    const productSeasonality: ProductSeasonality[] = products
      .filter(p => selectedCategory === 'Tous' || p.category === selectedCategory)
      .map(product => {
        const monthData = productMonthlySales.get(product.id!) || new Map();
        const monthlyPattern = Array(12).fill(0);
        let totalSales = 0;
        let drySales = 0;
        let wetSales = 0;

        monthData.forEach((qty, month) => {
          monthlyPattern[month] = qty;
          totalSales += qty;
          if (isDryMonth(month + 1)) {
            drySales += qty;
          } else {
            wetSales += qty;
          }
        });

        // Seasonality index (ratio of dry to wet, normalized)
        const dryAvg = drySales / 6;
        const wetAvg = wetSales / 6;
        const seasonalityIndex = wetAvg > 0 ? dryAvg / wetAvg : (dryAvg > 0 ? 2 : 1);

        // Find peak and low months
        let peakMonth = 0;
        let lowMonth = 0;
        let maxSales = -1;
        let minSales = Infinity;

        monthlyPattern.forEach((sales, month) => {
          if (sales > maxSales) {
            maxSales = sales;
            peakMonth = month;
          }
          if (sales > 0 && sales < minSales) {
            minSales = sales;
            lowMonth = month;
          }
        });

        // Trend
        let trend: 'dry' | 'wet' | 'stable' = 'stable';
        if (seasonalityIndex > 1.3) trend = 'dry';
        else if (seasonalityIndex < 0.7) trend = 'wet';

        return {
          product,
          totalSales,
          drySales,
          wetSales,
          seasonalityIndex,
          trend,
          monthlyPattern,
          peakMonth,
          lowMonth,
        };
      })
      .filter(p => p.totalSales > 0)
      .sort((a, b) => Math.abs(b.seasonalityIndex - 1) - Math.abs(a.seasonalityIndex - 1));

    // Count by trend
    const trendCounts = {
      dry: productSeasonality.filter(p => p.trend === 'dry').length,
      wet: productSeasonality.filter(p => p.trend === 'wet').length,
      stable: productSeasonality.filter(p => p.trend === 'stable').length,
    };

    return {
      monthlyAverages,
      dryRevenue,
      wetRevenue,
      currentSeason,
      productSeasonality,
      trendCounts,
      maxMonthlyRevenue: Math.max(...monthlyAverages),
    };
  }, [products, sales, saleItems, selectedCategory]);

  const getTrendConfig = (trend: 'dry' | 'wet' | 'stable') => {
    switch (trend) {
      case 'dry':
        return {
          icon: Sun,
          label: 'Saison sèche',
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-400',
          ringColor: 'ring-amber-500/30',
        };
      case 'wet':
        return {
          icon: CloudRain,
          label: 'Saison pluies',
          bgColor: 'bg-blue-500/10',
          textColor: 'text-blue-400',
          ringColor: 'ring-blue-500/30',
        };
      case 'stable':
        return {
          icon: BarChart3,
          label: 'Stable',
          bgColor: 'bg-slate-500/10',
          textColor: 'text-slate-400',
          ringColor: 'ring-slate-500/30',
        };
    }
  };

  const CurrentSeasonIcon = seasonalData.currentSeason === 'DRY' ? Sun : CloudRain;

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
              <h1 className="text-xl font-bold tracking-tight">Demande Saisonnière</h1>
              <p className="text-sm text-slate-400 mt-0.5">Tendances et prévisions par saison</p>
            </div>

            {/* Info Button */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                'p-2.5 rounded-xl transition-all duration-200 active:scale-95 ring-1',
                showInfo
                  ? 'bg-amber-500/20 ring-amber-500/50 text-amber-300'
                  : 'hover:bg-slate-800/80 ring-slate-700/50'
              )}
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* Info Panel */}
          {showInfo && (
            <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <h4 className="font-semibold text-amber-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Saisons en Guinée
              </h4>
              <p className="text-sm text-amber-200/80 leading-relaxed mb-3">
                La Guinée a deux saisons principales qui influencent la demande de certains produits.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                  <span className="text-slate-300"><strong>Saison sèche</strong>: Nov - Avr (chaleur, poussière)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                  </span>
                  <span className="text-slate-300"><strong>Saison des pluies</strong>: Mai - Oct (humidité, paludisme)</span>
                </div>
              </div>
            </div>
          )}

          {/* Current Season Banner */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl mb-4',
            seasonalData.currentSeason === 'DRY'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30'
              : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border border-blue-500/30'
          )}>
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              seasonalData.currentSeason === 'DRY'
                ? 'bg-amber-500/20 ring-1 ring-amber-500/30'
                : 'bg-blue-500/20 ring-1 ring-blue-500/30'
            )}>
              <CurrentSeasonIcon className={cn(
                'w-6 h-6',
                seasonalData.currentSeason === 'DRY' ? 'text-amber-400' : 'text-blue-400'
              )} />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Saison actuelle</div>
              <div className={cn(
                'font-bold',
                seasonalData.currentSeason === 'DRY' ? 'text-amber-400' : 'text-blue-400'
              )}>
                {seasonalData.currentSeason === 'DRY' ? 'Saison Sèche' : 'Saison des Pluies'}
              </div>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl mb-4">
            {[
              { key: 'overview' as ViewMode, label: 'Aperçu' },
              { key: 'products' as ViewMode, label: 'Produits' },
              { key: 'monthly' as ViewMode, label: 'Mensuel' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                  viewMode === tab.key
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Filter (for products view) */}
          {viewMode === 'products' && (
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl text-sm font-medium transition-all ring-1 ring-slate-700/50 active:scale-95"
              >
                <span>{selectedCategory}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  showCategoryDropdown && 'rotate-180'
                )} />
              </button>

              {showCategoryDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCategoryDropdown(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowCategoryDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-sm transition-colors',
                          selectedCategory === cat
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'hover:bg-slate-700/50 text-slate-300'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {viewMode === 'overview' && (
          <>
            {/* Season Comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">Saison Sèche</span>
                </div>
                <div className="text-2xl font-bold text-amber-400 tabular-nums">
                  {formatCurrency(seasonalData.dryRevenue).replace(' GNF', '')}
                </div>
                <div className="text-xs text-slate-400 mt-1">CA moyen / mois</div>
              </div>

              <div className="rounded-xl p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <CloudRain className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">Saison Pluies</span>
                </div>
                <div className="text-2xl font-bold text-blue-400 tabular-nums">
                  {formatCurrency(seasonalData.wetRevenue).replace(' GNF', '')}
                </div>
                <div className="text-xs text-slate-400 mt-1">CA moyen / mois</div>
              </div>
            </div>

            {/* Trend Distribution */}
            <div className="rounded-xl p-4 bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50">
              <h3 className="font-semibold text-white mb-3">Tendances des produits</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-amber-500/10 rounded-xl ring-1 ring-amber-500/20">
                  <Sun className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <div className="text-xl font-bold text-amber-400">{seasonalData.trendCounts.dry}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Sèche</div>
                </div>
                <div className="text-center p-3 bg-slate-500/10 rounded-xl ring-1 ring-slate-500/20">
                  <BarChart3 className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <div className="text-xl font-bold text-slate-300">{seasonalData.trendCounts.stable}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Stable</div>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-xl ring-1 ring-blue-500/20">
                  <CloudRain className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <div className="text-xl font-bold text-blue-400">{seasonalData.trendCounts.wet}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Pluies</div>
                </div>
              </div>
            </div>

            {/* Monthly Chart */}
            <div className="rounded-xl p-4 bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50">
              <h3 className="font-semibold text-white mb-3">CA moyen par mois</h3>
              <div className="flex items-end gap-1 h-32">
                {seasonalData.monthlyAverages.map((avg, month) => {
                  const height = seasonalData.maxMonthlyRevenue > 0
                    ? (avg / seasonalData.maxMonthlyRevenue) * 100
                    : 0;
                  const isDry = isDryMonth(month + 1);

                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'w-full rounded-t transition-all',
                          isDry
                            ? 'bg-gradient-to-t from-amber-500/50 to-amber-400/30'
                            : 'bg-gradient-to-t from-blue-500/50 to-blue-400/30'
                        )}
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[9px] text-slate-500 font-medium">
                        {MONTH_ABBR[month][0]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500/50" />
                  <span className="text-slate-400">Sèche</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500/50" />
                  <span className="text-slate-400">Pluies</span>
                </span>
              </div>
            </div>
          </>
        )}

        {viewMode === 'products' && (
          <>
            {seasonalData.productSeasonality.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
                  <Package className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-400 mb-2">Aucune donnée</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Pas assez de ventes pour analyser les tendances saisonnières.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {seasonalData.productSeasonality.map((item, index) => {
                  const config = getTrendConfig(item.trend);
                  const TrendIcon = config.icon;

                  return (
                    <div
                      key={item.product.id}
                      className={cn(
                        'relative overflow-hidden rounded-xl border transition-all duration-200',
                        'bg-gradient-to-r from-slate-800/60 to-slate-900/40',
                        'border-slate-700/50 hover:border-slate-600/50'
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="p-3.5">
                        <div className="flex items-start gap-3">
                          {/* Trend Icon */}
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                            config.bgColor,
                            config.ringColor
                          )}>
                            <TrendIcon className={cn('w-5 h-5', config.textColor)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-white truncate">
                                  {item.product.name}
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {item.product.category} • {item.totalSales} vendus
                                </p>
                              </div>
                              <span className={cn(
                                'text-xs font-medium px-2 py-1 rounded-lg',
                                config.bgColor,
                                config.textColor
                              )}>
                                {config.label}
                              </span>
                            </div>

                            {/* Season Breakdown */}
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="flex items-center gap-1">
                                <Sun className="w-3 h-3 text-amber-400" />
                                <span className="text-slate-400">Sèche:</span>
                                <span className="font-medium text-amber-400">{item.drySales}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <CloudRain className="w-3 h-3 text-blue-400" />
                                <span className="text-slate-400">Pluies:</span>
                                <span className="font-medium text-blue-400">{item.wetSales}</span>
                              </span>
                            </div>

                            {/* Mini bar chart */}
                            <div className="flex items-end gap-0.5 h-6 mt-2">
                              {item.monthlyPattern.map((sales, month) => {
                                const maxSales = Math.max(...item.monthlyPattern);
                                const height = maxSales > 0 ? (sales / maxSales) * 100 : 0;
                                const isDry = isDryMonth(month + 1);

                                return (
                                  <div
                                    key={month}
                                    className={cn(
                                      'flex-1 rounded-sm transition-all',
                                      isDry ? 'bg-amber-500/40' : 'bg-blue-500/40',
                                      sales === 0 && 'opacity-30'
                                    )}
                                    style={{ height: `${Math.max(height, 8)}%` }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewMode === 'monthly' && (
          <div className="space-y-2">
            {MONTH_NAMES.map((name, month) => {
              const avg = seasonalData.monthlyAverages[month];
              const isDry = isDryMonth(month + 1);
              const isCurrentMonth = new Date().getMonth() === month;

              return (
                <div
                  key={month}
                  className={cn(
                    'rounded-xl p-3.5 border transition-all',
                    isCurrentMonth
                      ? isDry
                        ? 'bg-amber-500/10 border-amber-500/30 ring-2 ring-amber-500/20'
                        : 'bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/20'
                      : 'bg-gradient-to-r from-slate-800/60 to-slate-900/40 border-slate-700/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                      isDry
                        ? 'bg-amber-500/10 ring-amber-500/30'
                        : 'bg-blue-500/10 ring-blue-500/30'
                    )}>
                      {isDry ? (
                        <Sun className="w-5 h-5 text-amber-400" />
                      ) : (
                        <CloudRain className="w-5 h-5 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{name}</h4>
                        {isCurrentMonth && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white">
                            Actuel
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isDry ? 'Saison sèche' : 'Saison des pluies'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className={cn(
                        'text-lg font-bold tabular-nums',
                        isDry ? 'text-amber-400' : 'text-blue-400'
                      )}>
                        {formatCurrency(avg).replace(' GNF', '')}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">CA moy.</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          isDry
                            ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                            : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                        )}
                        style={{
                          width: `${seasonalData.maxMonthlyRevenue > 0
                            ? (avg / seasonalData.maxMonthlyRevenue) * 100
                            : 0}%`
                        }}
                      />
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
