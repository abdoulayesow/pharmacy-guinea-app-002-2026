'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RefreshCw,
  Search,
  Plus,
  X,
  Pill,
  Beaker,
  UserCog,
  ChevronRight,
  Trash2,
  Sparkles,
  AlertTriangle,
  GripVertical,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { generateId, formatCurrency } from '@/lib/shared/utils';
import type { Product, ProductSubstitute, SubstituteEquivalenceType } from '@/lib/shared/types';
import { cn } from '@/lib/utils';

interface SubstituteLinkingSectionProps {
  productId: string;
  productName: string;
  className?: string;
}

interface LinkedSubstitute {
  substitute: ProductSubstitute;
  product: Product;
}

const EQUIVALENCE_TYPES: {
  value: SubstituteEquivalenceType;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Pill;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    value: 'DCI',
    label: 'Même principe actif (DCI)',
    shortLabel: 'DCI',
    description: 'Molécule identique, marque différente',
    icon: Pill,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
  },
  {
    value: 'THERAPEUTIC_CLASS',
    label: 'Même classe thérapeutique',
    shortLabel: 'Classe',
    description: 'Effet similaire, molécule différente',
    icon: Beaker,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-500/40',
  },
  {
    value: 'MANUAL',
    label: 'Alternative manuelle',
    shortLabel: 'Manuel',
    description: 'Substitut recommandé par le pharmacien',
    icon: UserCog,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-500/40',
  },
];

export function SubstituteLinkingSection({
  productId,
  productName,
  className,
}: SubstituteLinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedType, setSelectedType] = useState<SubstituteEquivalenceType>('DCI');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get all products for search
  const allProducts = useLiveQuery(() => db.products.toArray()) ?? [];

  // Get linked substitutes for this product
  const linkedSubstitutes = useLiveQuery(async () => {
    const subs = await db
      .table('product_substitutes')
      .where('product_id')
      .equals(productId)
      .toArray();

    const withProducts: LinkedSubstitute[] = [];
    for (const sub of subs) {
      const product = await db.products.get(sub.substitute_id);
      if (product) {
        withProducts.push({ substitute: sub, product });
      }
    }
    return withProducts.sort((a, b) => a.substitute.priority - b.substitute.priority);
  }, [productId]) ?? [];

  // Filter products for search (exclude current product and already linked)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const linkedIds = new Set(linkedSubstitutes.map(ls => ls.product.id));

    return allProducts
      .filter(p =>
        p.id !== productId &&
        !linkedIds.has(p.id) &&
        (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         p.category?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .slice(0, 8);
  }, [allProducts, searchQuery, productId, linkedSubstitutes]);

  // Reset modal state
  const resetModal = useCallback(() => {
    setSearchQuery('');
    setSelectedProduct(null);
    setSelectedType('DCI');
    setNotes('');
    setShowSearchModal(false);
  }, []);

  // Add substitute link
  const handleAddSubstitute = async () => {
    if (!selectedProduct) return;

    setIsSubmitting(true);

    try {
      const newPriority = linkedSubstitutes.length + 1;

      const substituteLink: ProductSubstitute = {
        id: generateId(),
        product_id: productId,
        substitute_id: selectedProduct.id!,
        equivalence_type: selectedType,
        notes: notes.trim() || undefined,
        priority: newPriority,
        created_at: new Date(),
        synced: false,
      };

      await db.table('product_substitutes').add(substituteLink);
      await queueTransaction('PRODUCT_SUBSTITUTE' as any, 'CREATE', substituteLink);

      toast.success(`${selectedProduct.name} lié comme substitut`);
      resetModal();
    } catch (error) {
      console.error('Error adding substitute:', error);
      toast.error('Erreur lors de l\'ajout du substitut');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove substitute link
  const handleRemoveSubstitute = async (substituteId: string, productName: string) => {
    try {
      await db.table('product_substitutes').delete(substituteId);
      await queueTransaction('PRODUCT_SUBSTITUTE' as any, 'DELETE', { id: substituteId });
      toast.success(`${productName} retiré des substituts`);
    } catch (error) {
      console.error('Error removing substitute:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTypeConfig = (type: SubstituteEquivalenceType) =>
    EQUIVALENCE_TYPES.find(t => t.value === type) ?? EQUIVALENCE_TYPES[2];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Section Header - Collapsible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300',
          'bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-950/40',
          'border-2 hover:border-amber-500/50',
          isExpanded ? 'border-amber-500/50' : 'border-amber-700/30',
          'group'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300',
            'bg-gradient-to-br from-amber-600/30 to-orange-600/20',
            'border border-amber-500/30',
            'group-hover:scale-105 group-hover:border-amber-400/50'
          )}>
            <RefreshCw className={cn(
              'w-5 h-5 text-amber-400 transition-transform duration-500',
              isExpanded && 'rotate-180'
            )} />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
              Produits de substitution
            </h4>
            <p className="text-xs text-amber-400/60 mt-0.5">
              {linkedSubstitutes.length === 0
                ? 'Aucun substitut configuré'
                : `${linkedSubstitutes.length} substitut${linkedSubstitutes.length > 1 ? 's' : ''} lié${linkedSubstitutes.length > 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <ChevronRight className={cn(
          'w-5 h-5 text-amber-500 transition-transform duration-300',
          isExpanded && 'rotate-90'
        )} />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
          {/* Linked Substitutes List */}
          {linkedSubstitutes.length > 0 && (
            <div className="space-y-2">
              {linkedSubstitutes.map(({ substitute, product }, index) => {
                const typeConfig = getTypeConfig(substitute.equivalence_type);
                const TypeIcon = typeConfig.icon;

                return (
                  <div
                    key={substitute.id}
                    className={cn(
                      'relative p-3 rounded-xl transition-all duration-200',
                      'bg-slate-900/80 border-2 border-slate-700/50',
                      'hover:border-slate-600 hover:bg-slate-800/80',
                      'group/item'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Priority Indicator */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <span className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          'text-xs font-bold',
                          index === 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                        )}>
                          {index + 1}
                        </span>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h5 className="text-white font-semibold truncate text-sm">
                            {product.name}
                          </h5>
                          <span className="text-emerald-400 font-bold text-sm whitespace-nowrap">
                            {formatCurrency(product.price)}
                          </span>
                        </div>

                        {/* Equivalence Type Badge */}
                        <div className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold',
                          typeConfig.bgColor,
                          typeConfig.color,
                          'border',
                          typeConfig.borderColor
                        )}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig.shortLabel}
                        </div>

                        {/* Notes */}
                        {substitute.notes && (
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                            {substitute.notes}
                          </p>
                        )}

                        {/* Stock indicator */}
                        <div className="mt-2">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-md',
                            product.stock > 0
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                          )}>
                            Stock: {product.stock}
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveSubstitute(substitute.id, product.name)}
                        className={cn(
                          'p-2 rounded-lg transition-all duration-200',
                          'text-slate-500 hover:text-red-400',
                          'hover:bg-red-500/10',
                          'opacity-0 group-hover/item:opacity-100'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {linkedSubstitutes.length === 0 && (
            <div className={cn(
              'p-6 rounded-xl text-center',
              'bg-slate-900/50 border-2 border-dashed border-slate-700'
            )}>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <RefreshCw className="w-6 h-6 text-amber-500/50" />
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">
                Aucun produit de substitution
              </p>
              <p className="text-xs text-slate-500">
                Ajoutez des alternatives pour ce produit
              </p>
            </div>
          )}

          {/* Add Substitute Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className={cn(
              'w-full p-4 rounded-xl transition-all duration-300',
              'bg-gradient-to-r from-amber-600/10 via-orange-600/15 to-amber-600/10',
              'border-2 border-dashed border-amber-600/30',
              'hover:border-amber-500/60 hover:bg-amber-600/20',
              'active:scale-[0.98]',
              'group/add'
            )}
          >
            <div className="flex items-center justify-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-amber-500/20 border border-amber-500/40',
                'group-hover/add:scale-110 group-hover/add:bg-amber-500/30',
                'transition-all duration-300'
              )}>
                <Plus className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-amber-300 font-semibold">
                Ajouter un substitut
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Search & Add Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={resetModal}
        >
          <div
            className={cn(
              'relative w-full sm:max-w-lg max-h-[90vh] overflow-hidden',
              'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/10',
              'rounded-t-3xl sm:rounded-3xl',
              'border-t-2 sm:border-2 border-amber-500/30',
              'shadow-2xl shadow-amber-900/20',
              'animate-in slide-in-from-bottom sm:zoom-in duration-300'
            )}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700 p-5">
              {/* Decorative Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 left-4 w-20 h-20 border border-white/30 rounded-full" />
                <div className="absolute bottom-2 right-8 w-12 h-12 border border-white/20 rounded-full" />
              </div>

              <button
                onClick={resetModal}
                className="absolute top-4 right-4 text-amber-200 hover:text-white w-10 h-10 rounded-xl hover:bg-amber-800/50 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center',
                  'bg-white/20 backdrop-blur-sm',
                  'border-2 border-white/30',
                  'shadow-lg'
                )}>
                  <RefreshCw className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl tracking-tight">
                    Ajouter un substitut
                  </h3>
                  <p className="text-amber-100/80 text-sm font-medium mt-0.5">
                    pour {productName}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5 overflow-y-auto max-h-[60vh]">
              {/* Step 1: Search Product */}
              {!selectedProduct && (
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">
                      <Search className="w-4 h-4" />
                      Rechercher un produit
                    </label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Nom du produit..."
                        className={cn(
                          'pl-12 h-14 bg-slate-950 rounded-xl',
                          'border-2 border-amber-900/50 focus:border-amber-500',
                          'text-base font-medium'
                        )}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchQuery.trim() && (
                    <div className="space-y-2">
                      {searchResults.length === 0 ? (
                        <div className="p-6 text-center rounded-xl bg-slate-950/50 border border-slate-800">
                          <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">Aucun produit trouvé</p>
                        </div>
                      ) : (
                        searchResults.map(product => (
                          <button
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className={cn(
                              'w-full p-4 rounded-xl text-left transition-all duration-200',
                              'bg-slate-900/80 border-2 border-slate-700/50',
                              'hover:border-amber-500/50 hover:bg-slate-800',
                              'active:scale-[0.98]',
                              'group/result'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h5 className="text-white font-semibold truncate">
                                  {product.name}
                                </h5>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-400">
                                    {product.category}
                                  </span>
                                  <span className="text-xs text-slate-600">•</span>
                                  <span className={cn(
                                    'text-xs font-medium',
                                    product.stock > 0 ? 'text-emerald-400' : 'text-red-400'
                                  )}>
                                    Stock: {product.stock}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-400 font-bold">
                                  {formatCurrency(product.price)}
                                </span>
                                <ChevronRight className="w-4 h-4 text-amber-500 group-hover/result:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Initial State */}
                  {!searchQuery.trim() && (
                    <div className="p-8 text-center">
                      <Sparkles className="w-10 h-10 text-amber-500/30 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">
                        Recherchez un produit à lier comme substitut
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Configure Link */}
              {selectedProduct && (
                <div className="space-y-5 animate-in slide-in-from-right duration-300">
                  {/* Selected Product Card */}
                  <div className={cn(
                    'p-4 rounded-xl',
                    'bg-gradient-to-br from-amber-950/30 to-orange-950/20',
                    'border-2 border-amber-600/40'
                  )}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-400/70 font-medium uppercase tracking-wider mb-1">
                          Produit sélectionné
                        </p>
                        <h5 className="text-white font-bold text-lg truncate">
                          {selectedProduct.name}
                        </h5>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {selectedProduct.category}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Equivalence Type Selection */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">
                      <Beaker className="w-4 h-4" />
                      Type d'équivalence
                    </label>
                    <div className="space-y-2">
                      {EQUIVALENCE_TYPES.map(type => {
                        const TypeIcon = type.icon;
                        const isSelected = selectedType === type.value;

                        return (
                          <button
                            key={type.value}
                            onClick={() => setSelectedType(type.value)}
                            className={cn(
                              'w-full p-4 rounded-xl text-left transition-all duration-200',
                              'border-2',
                              isSelected
                                ? cn(type.bgColor, type.borderColor, 'ring-2 ring-offset-2 ring-offset-slate-900', type.borderColor.replace('border-', 'ring-'))
                                : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                isSelected ? type.bgColor : 'bg-slate-800',
                                'border',
                                isSelected ? type.borderColor : 'border-slate-700'
                              )}>
                                <TypeIcon className={cn(
                                  'w-5 h-5',
                                  isSelected ? type.color : 'text-slate-400'
                                )} />
                              </div>
                              <div className="flex-1">
                                <h6 className={cn(
                                  'font-semibold',
                                  isSelected ? type.color : 'text-white'
                                )}>
                                  {type.label}
                                </h6>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {type.description}
                                </p>
                              </div>
                              {isSelected && (
                                <div className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center',
                                  type.bgColor, type.color
                                )}>
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                      Notes (optionnel)
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Ex: Même dosage, marque différente..."
                      rows={2}
                      className={cn(
                        'w-full p-4 rounded-xl resize-none',
                        'bg-slate-950 border-2 border-slate-700',
                        'focus:border-amber-500 focus:outline-none focus:ring-0',
                        'text-white placeholder:text-slate-600 text-sm'
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-5 pt-2 border-t border-slate-800 bg-slate-900/50 space-y-3">
              {selectedProduct ? (
                <Button
                  onClick={handleAddSubstitute}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full h-14 font-bold text-base rounded-xl transition-all',
                    'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600',
                    'hover:from-amber-500 hover:via-orange-400 hover:to-amber-500',
                    'shadow-lg shadow-amber-500/25 border-2 border-amber-400/50',
                    'active:scale-[0.98]',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Lier comme substitut
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={resetModal}
                  className="w-full h-12 rounded-xl border-2 border-slate-700 font-semibold text-slate-300 hover:text-white hover:border-slate-600"
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
