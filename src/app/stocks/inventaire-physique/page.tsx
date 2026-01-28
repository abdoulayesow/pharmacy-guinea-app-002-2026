'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ClipboardCheck,
  Package,
  Search,
  Check,
  X,
  AlertTriangle,
  Save,
  RotateCcw,
  Filter,
  ChevronDown,
  Minus,
  Plus,
  CheckCircle2,
  XCircle,
  Equal,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { formatCurrency } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import type { Product } from '@/lib/shared/types';
import { Navigation } from '@/components/Navigation';
import { useAuthStore } from '@/stores/auth';

interface CountEntry {
  productId: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number;
  status: 'pending' | 'counted' | 'adjusted';
}

type FilterMode = 'all' | 'pending' | 'counted' | 'variance';
type SortMode = 'name' | 'category' | 'variance';

export default function PhysicalInventoryPage() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [counts, setCounts] = useState<Map<string, CountEntry>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  // Fetch products from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['Tous', ...Array.from(cats).sort()];
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = products;

    // Category filter
    if (selectedCategory !== 'Tous') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterMode !== 'all') {
      result = result.filter(p => {
        const entry = counts.get(p.id!);
        switch (filterMode) {
          case 'pending':
            return !entry || entry.status === 'pending';
          case 'counted':
            return entry?.status === 'counted' || entry?.status === 'adjusted';
          case 'variance':
            return entry && entry.variance !== 0;
          default:
            return true;
        }
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'variance':
          const varA = counts.get(a.id!)?.variance || 0;
          const varB = counts.get(b.id!)?.variance || 0;
          return Math.abs(varB) - Math.abs(varA);
        default:
          return 0;
      }
    });

    return result;
  }, [products, searchQuery, filterMode, sortMode, counts, selectedCategory]);

  // Summary stats
  const stats = useMemo(() => {
    const counted = Array.from(counts.values()).filter(c => c.status === 'counted' || c.status === 'adjusted').length;
    const withVariance = Array.from(counts.values()).filter(c => c.variance !== 0).length;
    const totalVariance = Array.from(counts.values()).reduce((sum, c) => sum + c.variance, 0);
    const positiveVariance = Array.from(counts.values()).filter(c => c.variance > 0).length;
    const negativeVariance = Array.from(counts.values()).filter(c => c.variance < 0).length;

    return {
      total: products.length,
      counted,
      pending: products.length - counted,
      withVariance,
      totalVariance,
      positiveVariance,
      negativeVariance,
      progress: products.length > 0 ? (counted / products.length) * 100 : 0,
    };
  }, [products.length, counts]);

  // Update count for a product
  const updateCount = useCallback((productId: string, product: Product, newQty: number | null) => {
    setCounts(prev => {
      const updated = new Map(prev);
      const expectedQty = product.stock;
      const variance = newQty !== null ? newQty - expectedQty : 0;

      updated.set(productId, {
        productId,
        expectedQty,
        countedQty: newQty,
        variance,
        status: newQty !== null ? 'counted' : 'pending',
      });

      return updated;
    });
  }, []);

  // Increment/decrement helpers
  const adjustCount = useCallback((productId: string, product: Product, delta: number) => {
    const current = counts.get(productId);
    const currentQty = current?.countedQty ?? product.stock;
    const newQty = Math.max(0, currentQty + delta);
    updateCount(productId, product, newQty);
  }, [counts, updateCount]);

  // Save all adjustments
  const saveAdjustments = async () => {
    // Verify user is authenticated
    if (!currentUser?.id) {
      console.error('No authenticated user');
      return;
    }

    const adjustments = Array.from(counts.values()).filter(c => c.variance !== 0 && c.countedQty !== null);

    if (adjustments.length === 0) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }

    setIsSaving(true);

    try {
      for (const adj of adjustments) {
        const product = products.find(p => p.id === adj.productId);
        if (!product) continue;

        // Create stock movement record
        await db.stock_movements.add({
          id: crypto.randomUUID(),
          product_id: adj.productId,
          type: 'INVENTORY',
          quantity_change: adj.variance,
          reason: `Inventaire physique: ${adj.countedQty} comptés (attendu: ${adj.expectedQty})`,
          created_at: new Date(),
          user_id: currentUser.id,
          synced: false,
        });

        // Update product quantity
        await db.products.update(adj.productId, {
          stock: adj.countedQty!,
          updatedAt: new Date(),
          synced: false,
        });

        // Add to sync queue
        await queueTransaction('PRODUCT', 'UPDATE', {
          id: adj.productId,
          stock: adj.countedQty,
          updatedAt: new Date().toISOString(),
        });

        // Update count status
        setCounts(prev => {
          const updated = new Map(prev);
          const entry = updated.get(adj.productId);
          if (entry) {
            entry.status = 'adjusted';
            entry.expectedQty = adj.countedQty!;
            entry.variance = 0;
          }
          return updated;
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving adjustments:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset all counts
  const resetCounts = () => {
    setCounts(new Map());
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return 'text-slate-400';
    if (variance > 0) return 'text-emerald-400';
    return 'text-red-400';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance === 0) return Equal;
    if (variance > 0) return Plus;
    return Minus;
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
              <h1 className="text-xl font-bold tracking-tight">Inventaire Physique</h1>
              <p className="text-sm text-slate-400 mt-0.5">Comptage et ajustement des stocks</p>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetCounts}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl transition-all duration-200 active:scale-95 ring-1 ring-slate-700/50"
              title="Réinitialiser"
            >
              <RotateCcw className="w-5 h-5 text-slate-400" />
            </button>

            {/* Save Button */}
            <button
              onClick={saveAdjustments}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 active:scale-95',
                saveSuccess
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/25'
              )}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Enregistré</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="text-sm">Valider</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Progression</span>
              <span className="text-cyan-400 font-medium">
                {stats.counted}/{stats.total} produits ({stats.progress.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-500"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl p-2.5 bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">En attente</div>
              <div className="text-lg font-bold text-slate-300 tabular-nums">{stats.pending}</div>
            </div>

            <div className="rounded-xl p-2.5 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Comptés</div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">{stats.counted}</div>
            </div>

            <div className="rounded-xl p-2.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Excédent</div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">+{stats.positiveVariance}</div>
            </div>

            <div className="rounded-xl p-2.5 bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Manquant</div>
              <div className="text-lg font-bold text-red-400 tabular-nums">-{stats.negativeVariance}</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700/50 rounded-lg"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex gap-2">
            {/* Category Dropdown */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl text-sm font-medium transition-all ring-1 ring-slate-700/50 active:scale-95"
              >
                <span className="truncate">{selectedCategory}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-slate-400 transition-transform shrink-0',
                  showFilterDropdown && 'rotate-180'
                )} />
              </button>

              {showFilterDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowFilterDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-sm transition-colors',
                          selectedCategory === cat
                            ? 'bg-cyan-500/20 text-cyan-300'
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

            {/* Status Filter Pills */}
            <div className="flex gap-1">
              {[
                { key: 'all' as FilterMode, label: 'Tous' },
                { key: 'pending' as FilterMode, label: 'En attente' },
                { key: 'variance' as FilterMode, label: 'Écarts' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilterMode(opt.key)}
                  className={cn(
                    'px-2.5 py-2 text-xs font-medium rounded-xl transition-all whitespace-nowrap',
                    filterMode === opt.key
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'text-slate-400 hover:text-white bg-slate-800/60 ring-1 ring-slate-700/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-2">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
              <ClipboardCheck className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Aucun produit</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              {searchQuery
                ? 'Aucun produit ne correspond à votre recherche.'
                : 'Aucun produit à afficher pour ce filtre.'}
            </p>
          </div>
        ) : (
          filteredProducts.map((product, index) => {
            const entry = counts.get(product.id!);
            const countedQty = entry?.countedQty ?? null;
            const displayQty = countedQty ?? product.stock;
            const variance = entry?.variance ?? 0;
            const isCounted = entry?.status === 'counted' || entry?.status === 'adjusted';
            const VarianceIcon = getVarianceIcon(variance);

            return (
              <div
                key={product.id}
                className={cn(
                  'relative overflow-hidden rounded-xl border transition-all duration-200',
                  'bg-gradient-to-r from-slate-800/60 to-slate-900/40',
                  isCounted
                    ? variance === 0
                      ? 'border-slate-600/50'
                      : variance > 0
                        ? 'border-emerald-500/30 ring-1 ring-emerald-500/20'
                        : 'border-red-500/30 ring-1 ring-red-500/20'
                    : 'border-slate-700/50 hover:border-slate-600/50'
                )}
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="p-3.5">
                  <div className="flex items-center gap-3">
                    {/* Status Indicator */}
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0',
                      isCounted
                        ? variance === 0
                          ? 'bg-slate-500/10 ring-slate-500/30'
                          : variance > 0
                            ? 'bg-emerald-500/10 ring-emerald-500/30'
                            : 'bg-red-500/10 ring-red-500/30'
                        : 'bg-slate-800/60 ring-slate-700/50'
                    )}>
                      {isCounted ? (
                        <Check className={cn(
                          'w-5 h-5',
                          variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-400' : 'text-red-400'
                        )} />
                      ) : (
                        <Package className="w-5 h-5 text-slate-500" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white truncate">{product.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{product.category}</span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-400">
                          Système: <span className="font-medium text-slate-300">{product.stock}</span>
                        </span>
                      </div>
                    </div>

                    {/* Count Controls */}
                    <div className="flex items-center gap-2">
                      {/* Variance Badge */}
                      {isCounted && variance !== 0 && (
                        <div className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tabular-nums',
                          variance > 0
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          <VarianceIcon className="w-3 h-3" />
                          {Math.abs(variance)}
                        </div>
                      )}

                      {/* Decrement */}
                      <button
                        onClick={() => adjustCount(product.id!, product, -1)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700/80 rounded-xl ring-1 ring-slate-700/50 active:scale-95 transition-all"
                      >
                        <Minus className="w-4 h-4 text-slate-300" />
                      </button>

                      {/* Quantity Display */}
                      <div className="w-14 text-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={displayQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateCount(product.id!, product, isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className={cn(
                            'w-full text-center text-lg font-bold tabular-nums bg-transparent border-none focus:outline-none focus:ring-0',
                            isCounted ? getVarianceColor(variance) : 'text-white'
                          )}
                        />
                      </div>

                      {/* Increment */}
                      <button
                        onClick={() => adjustCount(product.id!, product, 1)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700/80 rounded-xl ring-1 ring-slate-700/50 active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4 text-slate-300" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Navigation />
    </div>
  );
}
