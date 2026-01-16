'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/client/utils';
import { formatCurrency } from '@/lib/shared/utils';
import {
  ArrowLeft,
  RotateCcw,
  Building2,
  Package,
  Hash,
  DollarSign,
  AlertCircle,
  Calendar,
  Save,
  Search,
} from 'lucide-react';
import type { ReturnReason, SupplierOrder } from '@/lib/shared/types';
import { queueTransaction } from '@/lib/client/sync';
import { toast } from 'sonner';

const RETURN_REASONS: { value: ReturnReason; label: string; icon: string }[] = [
  { value: 'EXPIRING', label: 'Produit périmé/expirant', icon: '⏰' },
  { value: 'DAMAGED', label: 'Produit endommagé', icon: '📦' },
  { value: 'OTHER', label: 'Autre raison', icon: '📝' },
];

export default function NewReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { isAuthenticated } = useAuthStore();
  const preselectedSupplierId = searchParams.get('supplierId');

  const [supplierId, setSupplierId] = useState(preselectedSupplierId || '');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<ReturnReason>('EXPIRING');
  const [creditAmount, setCreditAmount] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? [];
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  
  // Get supplier to calculate due date (not used for returns, but needed for structure)
  const selectedSupplier = suppliers.find((s) => s.id === parseInt(supplierId));
  const selectedProduct = selectedProductId
    ? products.find((p) => p.id === selectedProductId)
    : null;

  // Filter products by search query
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Redirect if not authenticated (check both OAuth session and Zustand store)
  useEffect(() => {
    if (status === 'loading') return;
    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/fournisseurs/retour/nouveau')}`);
    }
  }, [isAuthenticated, session, status, router]);

  // Auto-calculate credit amount based on quantity and product price
  useEffect(() => {
    if (selectedProduct && quantity) {
      const calculatedCredit = selectedProduct.priceBuy
        ? selectedProduct.priceBuy * parseInt(quantity)
        : selectedProduct.price * parseInt(quantity);
      setCreditAmount(calculatedCredit.toString());
    }
  }, [selectedProduct, quantity]);

  const handleSelectProduct = (productId: number) => {
    setSelectedProductId(productId);
    setShowProductSearch(false);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setProductSearch(product.name);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !selectedSupplier) {
      toast.error('Veuillez sélectionner un produit et un fournisseur');
      return;
    }

    setIsSubmitting(true);

    try {
      const returnAmount = parseInt(creditAmount);
      const returnDateObj = new Date(returnDate);
      const returnQty = parseInt(quantity);

      // Validate return quantity doesn't exceed stock
      if (selectedProduct && returnQty > selectedProduct.stock) {
        toast.error(`Quantité de retour (${returnQty}) dépasse le stock disponible (${selectedProduct.stock})`);
        return;
      }

      // Create return as a SupplierOrder with type='RETURN'
      const returnOrder: Omit<SupplierOrder, 'id' | 'serverId'> = {
        supplierId: parseInt(supplierId),
        type: 'RETURN',
        orderDate: returnDateObj,
        totalAmount: returnAmount,
        calculatedTotal: returnAmount,
        amountPaid: 0, // Will be updated when refund is confirmed
        dueDate: returnDateObj, // Not used for returns, but required
        status: 'PENDING', // Return submitted, waiting for delivery/confirmation
        paymentStatus: 'PENDING', // Refund status: pending until confirmed
        returnReason: reason,
        returnProductId: selectedProductId,
        notes: `Retour: ${products.find(p => p.id === selectedProductId)?.name || 'Produit'} - Quantité: ${quantity}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false,
      };

      // Save to IndexedDB
      const localId = await db.supplier_orders.add(returnOrder);

      // Reduce stock immediately
      await db.products.update(selectedProductId, {
        stock: selectedProduct!.stock - returnQty,
        updatedAt: new Date(),
        synced: false,
      });

      // Create stock movement record
      await db.stock_movements.add({
        product_id: selectedProductId,
        type: 'SUPPLIER_RETURN',
        quantity_change: -returnQty,
        reason: `Retour fournisseur: ${RETURN_REASONS.find(r => r.value === reason)?.label || reason}`,
        supplier_order_id: localId,
        user_id: session?.user?.email || 'unknown',
        created_at: returnDateObj,
        synced: false,
      });

      // Queue for sync
      await queueTransaction('SUPPLIER_ORDER', 'CREATE', returnOrder, localId);
      await queueTransaction('PRODUCT', 'UPDATE', selectedProduct!, String(selectedProductId));

      toast.success('Retour enregistré - Stock réduit');

      // Navigate back to supplier detail
      router.push(`/fournisseurs/${supplierId}`);
    } catch (error) {
      console.error('Error recording return:', error);
      toast.error('Erreur lors de l\'enregistrement du retour');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show nothing while checking auth or if not authenticated
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || (!isAuthenticated && !hasOAuthSession)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Retour produit</h1>
            <p className="text-sm text-slate-400">Enregistrer un retour fournisseur</p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Icon Display */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center border-2 border-orange-500/30">
              <RotateCcw className="w-12 h-12 text-orange-400" />
            </div>
          </div>

          {/* Supplier Selection - Only show if not pre-selected */}
          {!preselectedSupplierId ? (
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
                Fournisseur
              </h3>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Retour à quel fournisseur? *
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 bg-slate-800 border border-slate-700 text-white rounded-xl text-base appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Choisir un fournisseur...</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSupplier && (
                  <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <p className="text-sm text-slate-400">
                      Le crédit sera déduit de vos prochains paiements à {selectedSupplier.name}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Show selected supplier as read-only when pre-selected */
            selectedSupplier && (
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
                  Fournisseur
                </h3>
                <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-emerald-500/30">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-white font-semibold">{selectedSupplier.name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Le crédit sera déduit de vos prochains paiements
                    </p>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Product Selection */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Produit retourné
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Rechercher le produit *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10">
                  <Search className="w-5 h-5" />
                </div>
                <Input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductSearch(true);
                    setSelectedProductId(null);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                  placeholder="Nom du produit..."
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                />
              </div>

              {/* Product Search Results */}
              {showProductSearch && productSearch && (
                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      Aucun produit trouvé
                    </div>
                  ) : (
                    filteredProducts.slice(0, 5).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product.id!)}
                        className="w-full p-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                      >
                        <p className="text-white font-medium">{product.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-400">{product.category}</span>
                          <span className="text-xs text-emerald-400 font-semibold">
                            {formatCurrency(product.priceBuy || product.price)}
                          </span>
                          <span className="text-xs text-slate-500">
                            Stock: {product.stock}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Product Display */}
              {selectedProduct && !showProductSearch && (
                <div className="mt-3 p-4 bg-slate-800 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{selectedProduct.name}</p>
                      <p className="text-sm text-slate-400 mt-1">{selectedProduct.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Prix d'achat</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {formatCurrency(selectedProduct.priceBuy || selectedProduct.price)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Quantité retournée *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Hash className="w-5 h-5" />
                </div>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="1"
                  max={selectedProduct?.stock || 999}
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                />
              </div>
              {selectedProduct && quantity && parseInt(quantity) > selectedProduct.stock && (
                <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Quantité supérieure au stock actuel ({selectedProduct.stock})
                </p>
              )}
            </div>
          </div>

          {/* Return Reason */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Raison du retour
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {RETURN_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={cn(
                    'h-14 rounded-xl font-semibold text-sm transition-all flex items-center gap-3 px-4',
                    reason === r.value
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  )}
                >
                  <span className="text-2xl">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Credit Amount */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Crédit
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Montant du crédit (GNF) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <DollarSign className="w-5 h-5" />
                </div>
                <Input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                />
              </div>
              {creditAmount && (
                <p className="text-sm text-emerald-400 mt-2 font-semibold">
                  Crédit: {formatCurrency(parseInt(creditAmount) || 0)}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Le crédit calculé automatiquement peut être ajusté si nécessaire
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Date du retour *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Calendar className="w-5 h-5" />
                </div>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white rounded-xl"
                  required
                />
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
            <p className="text-sm text-orange-400/90 leading-relaxed">
              💡 <span className="font-semibold">Important:</span> Le crédit sera enregistré
              et pourra être appliqué lors de vos prochains paiements à ce fournisseur.
              Contactez votre fournisseur pour confirmer l'acceptation du retour.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1 h-14 text-base bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !supplierId || !selectedProductId || !quantity || !creditAmount}
              className="flex-1 h-14 text-base bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Enregistrer le retour
                </span>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
