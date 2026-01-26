'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  AlertTriangle,
  RotateCcw,
  Trash2,
  User,
  ChevronDown,
  X,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { formatDate, formatTime } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { StockMovement, StockMovementType, Product, User as UserType } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';

// Movement type configuration with icons and colors
const MOVEMENT_TYPES: Record<StockMovementType, {
  label: string;
  icon: typeof ShoppingCart;
  bgColor: string;
  textColor: string;
  ringColor: string;
  gradientFrom: string;
  gradientTo: string;
}> = {
  SALE: {
    label: 'Vente',
    icon: ShoppingCart,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    ringColor: 'ring-blue-500/30',
    gradientFrom: 'from-blue-500/20',
    gradientTo: 'to-blue-600/10',
  },
  SALE_EDIT: {
    label: 'Correction vente',
    icon: ClipboardCheck,
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
    ringColor: 'ring-cyan-500/30',
    gradientFrom: 'from-cyan-500/20',
    gradientTo: 'to-cyan-600/10',
  },
  RECEIPT: {
    label: 'Réception',
    icon: Truck,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    ringColor: 'ring-emerald-500/30',
    gradientFrom: 'from-emerald-500/20',
    gradientTo: 'to-emerald-600/10',
  },
  ADJUSTMENT: {
    label: 'Ajustement',
    icon: ClipboardCheck,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    ringColor: 'ring-amber-500/30',
    gradientFrom: 'from-amber-500/20',
    gradientTo: 'to-amber-600/10',
  },
  INVENTORY: {
    label: 'Inventaire',
    icon: Package,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    ringColor: 'ring-purple-500/30',
    gradientFrom: 'from-purple-500/20',
    gradientTo: 'to-purple-600/10',
  },
  DAMAGED: {
    label: 'Endommagé',
    icon: AlertTriangle,
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    ringColor: 'ring-orange-500/30',
    gradientFrom: 'from-orange-500/20',
    gradientTo: 'to-orange-600/10',
  },
  EXPIRED: {
    label: 'Expiré',
    icon: Trash2,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    ringColor: 'ring-red-500/30',
    gradientFrom: 'from-red-500/20',
    gradientTo: 'to-red-600/10',
  },
  SUPPLIER_RETURN: {
    label: 'Retour fournisseur',
    icon: RotateCcw,
    bgColor: 'bg-rose-500/10',
    textColor: 'text-rose-400',
    ringColor: 'ring-rose-500/30',
    gradientFrom: 'from-rose-500/20',
    gradientTo: 'to-rose-600/10',
  },
};

type DateFilter = 'all' | 'today' | 'week' | 'month';

export default function StockHistoryPage() {
  const router = useRouter();

  // Filter states
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedTypes, setSelectedTypes] = useState<Set<StockMovementType>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch data from IndexedDB
  const movements = useLiveQuery(
    () => db.stock_movements.orderBy('created_at').reverse().toArray()
  ) ?? [];

  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

  // Create lookup maps
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const userMap = useMemo(() => {
    const map = new Map<string, UserType>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return movements.filter(movement => {
      // Date filter
      const movementDate = new Date(movement.created_at);
      if (dateFilter === 'today' && movementDate < today) return false;
      if (dateFilter === 'week' && movementDate < weekAgo) return false;
      if (dateFilter === 'month' && movementDate < monthAgo) return false;

      // Type filter
      if (selectedTypes.size > 0 && !selectedTypes.has(movement.type)) return false;

      // Search filter (product name)
      if (searchQuery) {
        const product = productMap.get(movement.product_id);
        const productName = product?.name?.toLowerCase() || '';
        const reason = movement.reason?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        if (!productName.includes(query) && !reason.includes(query)) return false;
      }

      return true;
    });
  }, [movements, dateFilter, selectedTypes, searchQuery, productMap]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalMovements = filteredMovements.length;
    const netChange = filteredMovements.reduce((sum, m) => sum + m.quantity_change, 0);

    const byType: Record<string, { count: number; quantity: number }> = {};
    filteredMovements.forEach(m => {
      if (!byType[m.type]) {
        byType[m.type] = { count: 0, quantity: 0 };
      }
      byType[m.type].count++;
      byType[m.type].quantity += m.quantity_change;
    });

    const incomingQty = filteredMovements
      .filter(m => m.quantity_change > 0)
      .reduce((sum, m) => sum + m.quantity_change, 0);

    const outgoingQty = Math.abs(
      filteredMovements
        .filter(m => m.quantity_change < 0)
        .reduce((sum, m) => sum + m.quantity_change, 0)
    );

    return { totalMovements, netChange, byType, incomingQty, outgoingQty };
  }, [filteredMovements]);

  // Toggle type filter
  const toggleType = (type: StockMovementType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSearchQuery('');
    setDateFilter('all');
  };

  const hasActiveFilters = selectedTypes.size > 0 || searchQuery || dateFilter !== 'all';

  // Group movements by date
  const groupedMovements = useMemo(() => {
    const groups: { date: string; movements: typeof filteredMovements }[] = [];
    let currentDate = '';

    filteredMovements.forEach(movement => {
      const dateStr = formatDate(new Date(movement.created_at));
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: dateStr, movements: [] });
      }
      groups[groups.length - 1].movements.push(movement);
    });

    return groups;
  }, [filteredMovements]);

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
              <h1 className="text-xl font-bold tracking-tight">Historique des mouvements</h1>
              <p className="text-sm text-slate-400 mt-0.5">Traçabilité du stock</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-2.5 rounded-xl transition-all duration-200 active:scale-95 ring-1',
                showFilters
                  ? 'bg-purple-500/20 ring-purple-500/50 text-purple-300'
                  : 'hover:bg-slate-800/80 ring-slate-700/50'
              )}
            >
              <Filter className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50 shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center ring-1 ring-purple-500/30">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Mouvements</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{stats.totalMovements}</div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50 shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/30">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Entrées</div>
              <div className="text-lg font-bold tabular-nums text-emerald-400 mt-0.5">+{stats.incomingQty}</div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-3 border border-slate-700/50 shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center ring-1 ring-red-500/30">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Sorties</div>
              <div className="text-lg font-bold tabular-nums text-red-400 mt-0.5">-{stats.outgoingQty}</div>
            </div>
          </div>
        </div>

        {/* Expandable Filters */}
        <div className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          showFilters ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        )}>
          <div className="px-4 pb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Période</span>
              </div>
              <div className="flex gap-2">
                {([
                  { value: 'all', label: 'Tout' },
                  { value: 'today', label: "Aujourd'hui" },
                  { value: 'week', label: '7 jours' },
                  { value: 'month', label: '30 jours' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setDateFilter(value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                      dateFilter === value
                        ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50'
                        : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 ring-1 ring-slate-700/50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Type de mouvement</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MOVEMENT_TYPES) as StockMovementType[]).map((type) => {
                  const config = MOVEMENT_TYPES[type];
                  const isSelected = selectedTypes.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                        isSelected
                          ? `${config.bgColor} ${config.textColor} ring-1 ${config.ringColor}`
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 ring-1 ring-slate-700/50'
                      )}
                    >
                      <config.icon className="w-3 h-3" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 rounded-lg transition-all"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Movement List */}
      <div className="px-4 py-4">
        {groupedMovements.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
              <Package className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-1">Aucun mouvement</h3>
            <p className="text-sm text-slate-500">
              {hasActiveFilters
                ? 'Aucun mouvement ne correspond aux filtres'
                : 'Les mouvements de stock apparaîtront ici'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMovements.map((group, groupIndex) => (
              <div key={group.date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2">
                    {group.date}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-slate-700/50 to-transparent" />
                </div>

                {/* Movements for this date */}
                <div className="space-y-2">
                  {group.movements.map((movement, index) => {
                    const config = MOVEMENT_TYPES[movement.type];
                    const product = productMap.get(movement.product_id);
                    const user = userMap.get(movement.user_id);
                    const isPositive = movement.quantity_change > 0;

                    return (
                      <div
                        key={movement.id}
                        className={cn(
                          'relative overflow-hidden rounded-xl border transition-all duration-200',
                          'bg-gradient-to-r',
                          config.gradientFrom,
                          config.gradientTo,
                          'border-slate-700/50 hover:border-slate-600/50',
                          'active:scale-[0.99]'
                        )}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <div className="p-3.5">
                          <div className="flex items-start gap-3">
                            {/* Type Icon */}
                            <div className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                              config.bgColor,
                              config.ringColor
                            )}>
                              <config.icon className={cn('w-5 h-5', config.textColor)} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-white truncate">
                                    {product?.name || 'Produit inconnu'}
                                  </h4>
                                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                    {movement.reason || config.label}
                                  </p>
                                </div>

                                {/* Quantity Badge */}
                                <div className={cn(
                                  'flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-sm shrink-0',
                                  isPositive
                                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                                )}>
                                  {isPositive ? (
                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                  )}
                                  <span className="tabular-nums">
                                    {isPositive ? '+' : ''}{movement.quantity_change}
                                  </span>
                                </div>
                              </div>

                              {/* Meta info */}
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
                                  config.bgColor,
                                  config.textColor
                                )}>
                                  {config.label}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatTime(new Date(movement.created_at))}
                                </span>
                                {user && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {user.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
