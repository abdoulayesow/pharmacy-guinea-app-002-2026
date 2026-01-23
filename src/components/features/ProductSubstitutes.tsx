'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RefreshCw,
  Plus,
  AlertTriangle,
  Package,
  ChevronRight,
  Sparkles,
  Info,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import type { Product, ProductSubstitute } from '@/lib/shared/types';
import { cn } from '@/lib/utils';

interface SubstituteWithProduct {
  substitute: ProductSubstitute;
  product: Product;
}

interface ProductSubstitutesProps {
  product: Product; // The out-of-stock product
  onAddToCart: (product: Product, quantity: number) => void;
  onReportStockout: () => void;
  className?: string;
}

/**
 * Find substitute products for an out-of-stock item
 *
 * Strategy:
 * 1. Check ProductSubstitute table for configured substitutes
 * 2. Fallback to same category products with available stock
 */
async function findSubstitutes(
  product: Product,
  limit: number = 5
): Promise<SubstituteWithProduct[]> {
  const substitutes: SubstituteWithProduct[] = [];

  // 1. Check for configured substitutes
  try {
    const configuredSubs = await db
      .table('product_substitutes')
      .where('product_id')
      .equals(product.id)
      .toArray();

    for (const sub of configuredSubs) {
      const subProduct = await db.products.get(sub.substitute_id);
      if (subProduct && subProduct.stock > 0) {
        substitutes.push({
          substitute: sub,
          product: subProduct,
        });
      }
    }
  } catch {
    // Table may not exist yet - fallback to category-based
  }

  // 2. Fallback: same category products
  if (substitutes.length < limit && product.category) {
    const categoryProducts = await db.products
      .where('category')
      .equals(product.category)
      .filter((p) => p.id !== product.id && p.stock > 0)
      .limit(limit - substitutes.length)
      .toArray();

    for (const p of categoryProducts) {
      // Check if not already in list
      if (!substitutes.some((s) => s.product.id === p.id)) {
        substitutes.push({
          substitute: {
            id: `auto-${p.id}`,
            product_id: product.id,
            substitute_id: p.id,
            equivalence_type: 'THERAPEUTIC_CLASS',
            notes: `Même catégorie: ${product.category}`,
            priority: 10,
            created_at: new Date(),
            synced: true,
          },
          product: p,
        });
      }
    }
  }

  // Sort by priority
  return substitutes.sort((a, b) => a.substitute.priority - b.substitute.priority);
}

export function ProductSubstitutes({
  product,
  onAddToCart,
  onReportStockout,
  className,
}: ProductSubstitutesProps) {
  const [substitutes, setSubstitutes] = useState<SubstituteWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});

  // Load substitutes on mount
  useEffect(() => {
    async function loadSubstitutes() {
      setIsLoading(true);
      try {
        const subs = await findSubstitutes(product);
        setSubstitutes(subs);
        // Initialize quantities to 1
        const qtyMap: Record<string, number> = {};
        subs.forEach((s) => {
          qtyMap[s.product.id] = 1;
        });
        setSelectedQty(qtyMap);
      } catch (error) {
        console.error('Error loading substitutes:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSubstitutes();
  }, [product.id, product.category]);

  const handleAddSubstitute = (subProduct: Product) => {
    const qty = selectedQty[subProduct.id] || 1;
    if (qty > subProduct.stock) {
      toast.error('Stock insuffisant');
      return;
    }
    onAddToCart(subProduct, qty);
    toast.success(`${subProduct.name} ajouté au panier`);
  };

  const getEquivalenceLabel = (type: string): string => {
    switch (type) {
      case 'DCI':
        return 'Même principe actif';
      case 'THERAPEUTIC_CLASS':
        return 'Même classe thérapeutique';
      case 'MANUAL':
        return 'Alternative recommandée';
      default:
        return 'Alternative';
    }
  };

  const getEquivalenceColor = (type: string): string => {
    switch (type) {
      case 'DCI':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'THERAPEUTIC_CLASS':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'MANUAL':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header - Out of Stock Warning */}
      <div className="bg-gradient-to-br from-red-950/50 to-red-900/20 rounded-xl p-4 border-2 border-red-700/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/30 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-red-300 font-bold text-sm uppercase tracking-wider mb-1">
              Rupture de stock
            </h3>
            <p className="text-white font-semibold truncate">{product.name}</p>
            <p className="text-xs text-red-400/70 mt-1">
              Stock: 0 | Min: {product.minStock}
            </p>
          </div>
        </div>
      </div>

      {/* Substitutes Section */}
      <div className="bg-gradient-to-br from-emerald-950/30 to-emerald-900/10 rounded-xl border-2 border-emerald-700/30 overflow-hidden">
        {/* Section Header */}
        <div className="p-4 border-b border-emerald-700/30 bg-emerald-900/20">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            <h3 className="text-emerald-300 font-bold uppercase tracking-wider text-sm">
              Alternatives disponibles
            </h3>
            {!isLoading && (
              <span className="ml-auto bg-emerald-600/30 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/50">
                {substitutes.length}
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-400">Recherche d'alternatives...</p>
          </div>
        )}

        {/* No Substitutes */}
        {!isLoading && substitutes.length === 0 && (
          <div className="p-6 text-center">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">
              Aucune alternative disponible
            </p>
            <p className="text-xs text-slate-500">
              Signalez cette rupture pour le suivi
            </p>
          </div>
        )}

        {/* Substitutes List */}
        {!isLoading && substitutes.length > 0 && (
          <div className="divide-y divide-emerald-900/30">
            {substitutes.map(({ substitute, product: subProduct }) => (
              <div
                key={substitute.id}
                className="p-4 hover:bg-emerald-900/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Product Icon */}
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700">
                    <Package className="w-6 h-6 text-emerald-500" />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-white font-semibold truncate">
                        {subProduct.name}
                      </h4>
                      <span className="text-emerald-400 font-bold whitespace-nowrap">
                        {formatCurrency(subProduct.price)}
                      </span>
                    </div>

                    {/* Equivalence Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
                          getEquivalenceColor(substitute.equivalence_type)
                        )}
                      >
                        <Sparkles className="w-3 h-3" />
                        {getEquivalenceLabel(substitute.equivalence_type)}
                      </span>
                    </div>

                    {/* Notes */}
                    {substitute.notes && (
                      <p className="text-xs text-slate-400 mb-2 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {substitute.notes}
                      </p>
                    )}

                    {/* Stock & Add Button */}
                    <div className="flex items-center justify-between gap-3 mt-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-md text-xs font-bold',
                            subProduct.stock <= subProduct.minStock
                              ? 'bg-amber-600/20 text-amber-400 border border-amber-500/50'
                              : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50'
                          )}
                        >
                          Stock: {subProduct.stock}
                        </span>

                        {/* Quantity selector */}
                        <div className="flex items-center gap-1 bg-slate-800 rounded-lg border border-slate-700">
                          <button
                            onClick={() =>
                              setSelectedQty((prev) => ({
                                ...prev,
                                [subProduct.id]: Math.max(
                                  1,
                                  (prev[subProduct.id] || 1) - 1
                                ),
                              }))
                            }
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-white">
                            {selectedQty[subProduct.id] || 1}
                          </span>
                          <button
                            onClick={() =>
                              setSelectedQty((prev) => ({
                                ...prev,
                                [subProduct.id]: Math.min(
                                  subProduct.stock,
                                  (prev[subProduct.id] || 1) + 1
                                ),
                              }))
                            }
                            disabled={
                              (selectedQty[subProduct.id] || 1) >= subProduct.stock
                            }
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Add to cart */}
                      <Button
                        onClick={() => handleAddSubstitute(subProduct)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 rounded-lg shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Stockout Button */}
      <button
        onClick={onReportStockout}
        className="w-full p-4 rounded-xl border-2 border-amber-700/50 bg-gradient-to-br from-amber-950/30 to-amber-900/10 hover:border-amber-600 hover:bg-amber-900/20 transition-all active:scale-[0.98] group"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-600/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-left">
            <div className="text-amber-300 font-semibold">
              Signaler cette rupture
            </div>
            <div className="text-xs text-amber-400/70">
              Pour le suivi des demandes clients
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-500 ml-auto group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    </div>
  );
}

/**
 * Compact substitute indicator for product cards
 */
export function SubstituteAvailableBadge({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600/20 border border-emerald-500/50 rounded-md hover:bg-emerald-600/30 transition-colors"
    >
      <RefreshCw className="w-3 h-3 text-emerald-400" />
      <span className="text-xs font-bold text-emerald-300">
        {count} alternative{count > 1 ? 's' : ''}
      </span>
    </button>
  );
}
