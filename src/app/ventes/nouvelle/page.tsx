'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Check,
  Sparkles,
  Banknote,
  CreditCard,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Calculator,
  History,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { db, selectBatchForSale, type BatchAllocation } from '@/lib/client/db';
import { queueTransaction, processSyncQueue } from '@/lib/client/sync';
import { formatCurrency, generateId } from '@/lib/shared/utils';
import type { Product, Sale, SaleItem, CartItem, StockMovement } from '@/lib/shared/types';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { CustomerAutocomplete } from '@/components/CustomerAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
// Phase 4: Pharmacy workflow components
import { PrescriptionCapture, PrescriptionIndicator, type CapturedPrescription } from '@/components/features/PrescriptionCapture';
import { ProductSubstitutes } from '@/components/features/ProductSubstitutes';
import { StockoutReportModal } from '@/components/features/StockoutReportModal';
import type { SalePrescription } from '@/lib/shared/types';

type Step = 'search' | 'cart' | 'customer_info' | 'payment' | 'receipt'; // 🆕 Added customer_info step
type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'CREDIT'; // 🆕 Added CREDIT

interface CompletedSale extends Sale {
  items: CartItem[];
}

export default function NouvelleVentePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isAuthenticated, currentUser, isInactive, lastActivityAt } = useAuthStore();
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getTotal } = useCartStore();

  // Check if user is authenticated via Zustand OR via Google session + recently active
  const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;
  const isRecentlyActive = hasGoogleSession && lastActivityAt && !isInactive();
  const isFullyAuthenticated = isAuthenticated || isRecentlyActive;

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lastSale, setLastSale] = useState<CompletedSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🆕 Customer info state (optional)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Cash calculator state
  const [showCashCalculator, setShowCashCalculator] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');

  // 🆕 Orange Money transaction reference state
  const [showOrangeMoneyDialog, setShowOrangeMoneyDialog] = useState(false);
  const [orangeMoneyRef, setOrangeMoneyRef] = useState('');

  // 🆕 Credit sale state
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditDueDate, setCreditDueDate] = useState<Date>(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Default: 3 days from now
  );

  // 🆕 Phase 4: Pharmacy workflow state
  const [prescriptions, setPrescriptions] = useState<CapturedPrescription[]>([]);
  const [showStockoutModal, setShowStockoutModal] = useState(false);
  const [stockoutProduct, setStockoutProduct] = useState<Product | null>(null);
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const [outOfStockProduct, setOutOfStockProduct] = useState<Product | null>(null);

  // Get products from IndexedDB with calculated stock
  // Note: Stock is calculated from UNSYNCED movements only to prevent concurrent update conflicts
  // Synced movements are already reflected in product.stock from the server
  const products = useLiveQuery(async () => {
    const allProducts = await db.products.toArray();

    // Calculate stock for each product from UNSYNCED movements only
    const productsWithStock = await Promise.all(
      allProducts.map(async (product) => {
        if (!product.id) return product;

        // Get UNSYNCED stock movements for this product
        const movements = await db.stock_movements
          .where('product_id')
          .equals(product.id)
          .filter(m => !m.synced) // CRITICAL: Only unsynced movements
          .toArray();

        // Sum all unsynced movements
        const totalMovements = movements.reduce((sum, movement) => {
          return sum + movement.quantity_change;
        }, 0);

        // Return product with calculated stock
        // product.stock = server value (includes synced movements)
        // + unsynced local movements
        return {
          ...product,
          stock: product.stock + totalMovements,
        };
      })
    );

    return productsWithStock;
  }) ?? [];

  useEffect(() => {
    // Wait for session to load before checking auth
    if (sessionStatus === 'loading') return;

    if (!isFullyAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/ventes/nouvelle')}`);
    }
  }, [isFullyAuthenticated, sessionStatus, router]);

  // Show loading while session is loading, or redirect if not authenticated
  if (sessionStatus === 'loading' || !isFullyAuthenticated) {
    return null;
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cartTotal = getTotal();
  const changeAmount = amountReceived ? parseFloat(amountReceived) - cartTotal : 0;

  // 🆕 Smart suggested amounts algorithm
  const getSmartSuggestedAmounts = (total: number): number[] => {
    const exactAmount = total;
    const roundTo10k = Math.ceil(total / 10000) * 10000;
    const roundTo100k = Math.ceil(total / 100000) * 100000;

    // Start with exact, round to 10k, round to 100k
    const amounts = [exactAmount];

    if (roundTo10k !== exactAmount) amounts.push(roundTo10k);
    if (roundTo100k !== exactAmount && roundTo100k !== roundTo10k) amounts.push(roundTo100k);

    // Add common larger amounts that are greater than total
    const commonAmounts = [50000, 100000, 200000, 500000].filter(amt => amt > total && !amounts.includes(amt));

    // Return up to 5 unique amounts
    return [...amounts, ...commonAmounts].slice(0, 5);
  };

  const smartAmounts = getSmartSuggestedAmounts(cartTotal);

  const handleAddToCart = () => {
    if (selectedProduct && quantity > 0) {
      // Check stock availability
      if (quantity > selectedProduct.stock) {
        toast.error('Stock insuffisant');
        return;
      }

      // Add multiple quantities at once
      for (let i = 0; i < quantity; i++) {
        addToCart(selectedProduct);
      }

      toast.success(`${selectedProduct.name} ajouté au panier`);
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  const handlePayment = async (method: PaymentMethod) => {
    // Use session user if available, fallback to Zustand currentUser
    const activeUser = session?.user || currentUser;

    if (!activeUser || cartItems.length === 0) {
      toast.error('Erreur: Utilisateur ou panier non valide');
      return;
    }

    // For cash, validate amount received
    if (method === 'CASH' && showCashCalculator) {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < cartTotal) {
        toast.error('Montant reçu insuffisant');
        return;
      }
    }

    // 🆕 For credit sales, enforce customer name requirement
    if (method === 'CREDIT' && !customerName.trim()) {
      toast.error('Veuillez entrer le nom du client pour un paiement à crédit');
      setShowCreditDialog(false);
      setStep('customer_info'); // Redirect to customer info step
      return;
    }

    setIsProcessing(true);

    try {
      // Store cart items before clearing (for receipt display)
      const saleItems = [...cartItems];

      // Create sale record with customer info and payment tracking
      const saleId = generateId();
      const sale: Sale = {
        id: saleId,
        created_at: new Date(),
        total: cartTotal,
        payment_method: method,
        payment_ref: method === 'ORANGE_MONEY' ? orangeMoneyRef || `OM-${Date.now()}` : null,
        user_id: activeUser.id,
        synced: false,
        // 🆕 Customer info (optional)
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        // 🆕 Payment tracking - depends on payment method
        payment_status: method === 'CREDIT' ? 'PENDING' : 'PAID',
        amount_paid: method === 'CREDIT' ? 0 : cartTotal,
        amount_due: method === 'CREDIT' ? cartTotal : 0,
        due_date: method === 'CREDIT' ? creditDueDate : undefined,
      };

      // Add sale to database
      await db.sales.add(sale);

      // 🆕 FEFO: Allocate batches for each product before creating sale items
      const batchAllocationsMap = new Map<string, BatchAllocation[]>();

      try {
        for (const item of saleItems) {
          if (!item.product.id) continue;

          // Allocate batches using FEFO (First Expired First Out)
          const allocations = await selectBatchForSale(item.product.id, item.quantity);
          batchAllocationsMap.set(item.product.id, allocations);
        }
      } catch (error) {
        // Rollback sale if batch allocation fails
        await db.sales.delete(saleId);

        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        toast.error(
          `Impossible de compléter la vente: ${errorMsg}`,
          { duration: 6000 }
        );
        setIsProcessing(false);
        return;
      }

      // Create sale items records with batch tracking
      const saleItemsToAdd: SaleItem[] = [];

      for (const item of saleItems) {
        if (!item.product.id) continue;

        const allocations = batchAllocationsMap.get(item.product.id) || [];

        // Create one sale item per batch allocation (may span multiple batches)
        for (const allocation of allocations) {
          saleItemsToAdd.push({
            id: generateId(),
            sale_id: saleId,
            product_id: item.product.id,
            product_batch_id: allocation.batchId,
            quantity: allocation.quantity,
            unit_price: item.product.price,
            subtotal: item.product.price * allocation.quantity,
          });
        }
      }

      await db.sale_items.bulkAdd(saleItemsToAdd);

      // 🆕 Update batch quantities (decrement from allocated batches)
      for (const item of saleItems) {
        if (!item.product.id) continue;

        const allocations = batchAllocationsMap.get(item.product.id) || [];

        for (const allocation of allocations) {
          const batch = await db.product_batches.get(allocation.batchId);
          if (batch) {
            // Decrement batch quantity
            await db.product_batches.update(allocation.batchId, {
              quantity: batch.quantity - allocation.quantity,
              updatedAt: new Date(),
            });

            // Queue batch update for sync
            await queueTransaction(
              'PRODUCT_BATCH',
              'UPDATE',
              { ...batch, quantity: batch.quantity - allocation.quantity, updatedAt: new Date() }
            );
          }
        }
      }

      // Create stock movements (don't update product.stock directly)
      // Stock is calculated from movements to prevent concurrent update conflicts
      for (const item of saleItems) {
        const product = await db.products.get(item.product.id!);
        if (product) {
          // Create stock movement record (source of truth for stock changes)
          const movementId = generateId();
          const movement: StockMovement = {
            id: movementId,
            product_id: item.product.id!,
            type: 'SALE',
            quantity_change: -item.quantity,
            reason: `Vente #${saleId}`,
            created_at: new Date(),
            user_id: activeUser.id,
            synced: false,
          };

          await db.stock_movements.add(movement);

          // Queue stock movement for sync
          await queueTransaction('STOCK_MOVEMENT', 'CREATE', movement);

          // Mark product as unsynced (for background sync to pick up)
          await db.products.update(item.product.id!, {
            synced: false,
            updatedAt: new Date(),
          });
        }
      }

      // Queue sale for sync
      await queueTransaction('SALE', 'CREATE', sale);

      // 🆕 Save prescriptions if any were captured
      if (prescriptions.length > 0) {
        for (const prescription of prescriptions) {
          const salePrescription: SalePrescription = {
            id: generateId(),
            sale_id: saleId,
            image_data: prescription.imageData,
            image_type: prescription.imageType,
            captured_at: prescription.capturedAt,
            synced: false,
          };

          await db.sale_prescriptions.add(salePrescription);
          // Note: Prescription sync can be added later when backend supports it
        }
      }

      // 🆕 OPTIMISTIC LOCKING: Try immediate sync with 5s timeout
      let syncFailed = false;
      let stockError: string | null = null;

      try {
        const syncResult = await Promise.race([
          processSyncQueue(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sync timeout')), 5000)
          ),
        ]);

        // Check if sync failed due to stock validation
        if (syncResult && typeof syncResult === 'object' && 'failed' in syncResult && (syncResult as any).failed > 0) {
          const errors = (syncResult as any).errors || [];
          stockError = errors.find((e: string) => e.includes('Stock insuffisant'));

          if (stockError) {
            syncFailed = true;
          }
        }
      } catch (error) {
        console.warn('[Sale] Immediate sync failed, will retry in background', error);
        // Not a critical error - background sync will retry
      }

      // 🆕 If stock validation failed, rollback the sale
      if (syncFailed && stockError) {
        console.error('[Sale] Stock validation failed on server, rolling back local sale');

        // Delete sale and sale items from IndexedDB
        await db.sales.delete(saleId);
        await db.sale_items.where('sale_id').equals(saleId).delete();

        // Delete stock movements created for this sale
        const saleMovements = await db.stock_movements
          .where('reason')
          .equals(`Vente #${saleId}`)
          .toArray();

        for (const movement of saleMovements) {
          if (movement.id) {
            await db.stock_movements.delete(movement.id);
          }
        }

        // Remove from sync queue (sale + stock movements)
        const queueItems = await db.sync_queue
          .where('localId')
          .equals(parseInt(String(saleId), 10))
          .toArray();
        for (const qi of queueItems) {
          if (qi.id) {
            await db.sync_queue.delete(qi.id);
          }
        }

        // Also remove stock movement queue items
        const movementQueueItems = await db.sync_queue
          .where('entity_type')
          .equals('STOCK_MOVEMENT')
          .toArray();

        for (const item of movementQueueItems) {
          const payload = item.payload as any;
          if (payload?.reason === `Vente #${saleId}`) {
            await db.sync_queue.delete(item.id!);
          }
        }

        // Show error to user
        toast.error(
          'Stock insuffisant sur le serveur. La vente a été annulée. ' +
          'Veuillez synchroniser et réessayer.',
          { duration: 6000 }
        );

        setIsProcessing(false);
        return; // Don't proceed to receipt
      }

      // Set last sale for receipt (with stored items)
      setLastSale({
        ...sale,
        id: saleId,
        items: saleItems,
      });

      // Clear cart and reset all states
      clearCart();
      setAmountReceived('');
      setShowCashCalculator(false);
      setCustomerName('');
      setCustomerPhone('');
      setOrangeMoneyRef('');
      setShowOrangeMoneyDialog(false);
      setShowCreditDialog(false);
      setCreditDueDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
      setPrescriptions([]); // 🆕 Clear prescriptions

      // Show success toast
      toast.success('Vente enregistrée avec succès!');

      // Go to receipt
      setStep('receipt');
    } catch (error) {
      console.error('Error completing sale:', error);
      toast.error(`Erreur lors de la vente: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewSale = () => {
    setStep('search');
    setSearchQuery('');
    setSelectedProduct(null);
    setQuantity(1);
    setLastSale(null);
    setAmountReceived('');
    setShowCashCalculator(false);
    setCustomerName('');
    setCustomerPhone('');
    setOrangeMoneyRef('');
    setShowOrangeMoneyDialog(false);
    setShowCreditDialog(false);
    setCreditDueDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setPrescriptions([]); // 🆕 Clear prescriptions
    setShowSubstitutes(false); // 🆕 Clear substitutes panel
    setOutOfStockProduct(null); // 🆕 Clear out-of-stock product
  };

  // (Removed old quickAmounts - now using smartAmounts algorithm)

  // Search Step
  if (step === 'search') {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />

        <main className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 sm:space-y-5 lg:space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-5 shadow-md border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold tracking-tight flex-1">Nouvelle vente</h2>
              <button
                onClick={() => router.push('/ventes/historique')}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all active:scale-95"
              >
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Historique</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search
                className={cn(
                  'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors',
                  searchQuery ? 'text-blue-500' : 'text-gray-400'
                )}
              />
              <Input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 h-14 bg-slate-950 border-2 border-slate-700 focus:border-blue-500 rounded-xl text-base shadow-sm focus:shadow-md transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-slate-300" />
                </button>
              )}
            </div>
          </div>

          {/* Product List */}
          <div className="space-y-3">
            {filteredProducts.length === 0 ? (
              <Card className="p-12 text-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50">
                <div className="text-slate-600 mb-3">
                  <Search className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-slate-400 font-medium">Aucun produit trouvé</p>
              </Card>
            ) : (
              filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className={cn(
                    'p-5 cursor-pointer hover:border-emerald-600 hover:shadow-lg transition-all duration-200 active:scale-[0.98] rounded-xl bg-slate-900 border border-slate-700',
                    product.stock === 0 && 'opacity-60'
                  )}
                  onClick={() => {
                    if (product.stock === 0) {
                      // Show substitutes panel for out-of-stock products
                      setOutOfStockProduct(product);
                      setShowSubstitutes(true);
                      return;
                    }
                    setSelectedProduct(product);
                    setQuantity(1);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-white font-semibold mb-1">{product.name}</div>
                      <div className="text-sm text-slate-400 mb-2">
                        {product.category || 'Général'}
                      </div>
                      <div className="text-emerald-400 font-bold text-lg">
                        {formatCurrency(product.price)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          'px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-sm',
                          product.stock === 0
                            ? 'bg-red-600 text-white'
                            : product.stock <= product.minStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        )}
                      >
                        {product.stock === 0 ? (
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Rupture
                          </span>
                        ) : product.stock <= product.minStock ? (
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Stock: {product.stock}
                          </span>
                        ) : (
                          `Stock: ${product.stock}`
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Cart Summary Button */}
          {cartItems.length > 0 && (
            <div className="fixed bottom-24 left-0 right-0 px-4 z-30">
              <Button
                onClick={() => setStep('cart')}
                className="w-full max-w-md sm:max-w-lg mx-auto h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 rounded-xl font-semibold active:scale-95 transition-all duration-200"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Voir le panier ({cartItems.length}) • {formatCurrency(cartTotal)}
              </Button>
            </div>
          )}

          {/* Quick Add Modal */}
          {selectedProduct && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end z-50 animate-in fade-in duration-200"
              onClick={() => setSelectedProduct(null)}
            >
              <div
                className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-3xl w-full p-6 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-xl mb-1">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {selectedProduct.category || 'Général'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-slate-400 hover:text-slate-300 w-11 h-11 rounded-xl hover:bg-slate-700 flex items-center justify-center transition-all active:scale-90"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 rounded-xl p-5 border border-emerald-800">
                    <div className="text-sm text-emerald-400 font-medium mb-1">
                      Prix unitaire
                    </div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {formatCurrency(selectedProduct.price)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-300 font-semibold mb-3">Quantité</div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-14 h-14 rounded-xl border-2 active:scale-90 transition-all"
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="text-center h-14 text-2xl font-bold border-2 rounded-xl"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                        disabled={quantity >= selectedProduct.stock}
                        className="w-14 h-14 rounded-xl border-2 active:scale-90 transition-all"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="text-sm text-slate-400 mt-2 text-center font-medium">
                      Stock disponible: {selectedProduct.stock}
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-5">
                    <div className="flex items-center justify-between mb-4 bg-slate-950 rounded-xl p-4">
                      <span className="text-slate-300 font-medium">Total</span>
                      <span className="text-3xl font-bold text-emerald-400">
                        {formatCurrency(selectedProduct.price * quantity)}
                      </span>
                    </div>
                    <Button
                      onClick={handleAddToCart}
                      disabled={quantity > selectedProduct.stock || selectedProduct.stock === 0}
                      className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
                    >
                      Ajouter au panier
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🆕 Product Substitutes Panel (shown when clicking out-of-stock product) */}
          {showSubstitutes && outOfStockProduct && (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end z-50 animate-in fade-in duration-200"
              onClick={() => {
                setShowSubstitutes(false);
                setOutOfStockProduct(null);
              }}
            >
              <div
                className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-3xl w-full p-5 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg">Alternatives disponibles</h3>
                  <button
                    onClick={() => {
                      setShowSubstitutes(false);
                      setOutOfStockProduct(null);
                    }}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <ProductSubstitutes
                  product={outOfStockProduct}
                  onAddToCart={(product, qty) => {
                    for (let i = 0; i < qty; i++) {
                      addToCart(product);
                    }
                    setShowSubstitutes(false);
                    setOutOfStockProduct(null);
                  }}
                  onReportStockout={() => {
                    setStockoutProduct(outOfStockProduct);
                    setShowStockoutModal(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* 🆕 Stockout Report Modal */}
          <StockoutReportModal
            isOpen={showStockoutModal}
            onClose={() => {
              setShowStockoutModal(false);
              setStockoutProduct(null);
            }}
            product={stockoutProduct}
            userId={session?.user?.id || currentUser?.id || ''}
            onReported={() => {
              setShowSubstitutes(false);
              setOutOfStockProduct(null);
            }}
          />
        </main>

        <Navigation />
      </div>
    );
  }

  // Cart Step
  if (step === 'cart') {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />

        <main className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 sm:space-y-5 lg:space-y-6 pb-48">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-5 shadow-md border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-white text-xl font-bold tracking-tight">Panier</h2>
                {/* 🆕 Prescription indicator */}
                <PrescriptionIndicator
                  count={prescriptions.length}
                  onClick={() => {/* Scroll to prescription section */}}
                />
              </div>
              <button
                onClick={() => setStep('search')}
                className="text-emerald-400 font-semibold text-sm flex items-center gap-1 hover:text-emerald-300 px-3 py-2 rounded-lg hover:bg-emerald-900/20 transition-all"
              >
                <Plus className="w-5 h-5" />
                Ajouter
              </button>
            </div>
          </div>

          {cartItems.length === 0 ? (
            <Card className="p-12 text-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50">
              <ShoppingCart className="w-16 h-16 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium mb-4">Votre panier est vide</p>
              <Button
                onClick={() => setStep('search')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                Ajouter des produits
              </Button>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <Card key={item.product.id} className="p-5 rounded-xl shadow-sm border border-slate-700 bg-slate-900">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="text-white font-semibold mb-1">
                          {item.product.name}
                        </div>
                        <div className="text-sm text-slate-400 mb-2">
                          {formatCurrency(item.product.price)} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id!, item.quantity - 1)}
                          className="w-10 h-10 p-0 rounded-lg border-2 active:scale-90 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-10 text-center font-bold text-lg text-white">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id!, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-10 h-10 p-0 rounded-lg border-2 active:scale-90 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            removeFromCart(item.product.id!);
                            toast.info(`${item.product.name} retiré du panier`);
                          }}
                          className="w-10 h-10 p-0 text-red-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                      <span className="text-sm text-slate-400 font-medium">Sous-total</span>
                      <span className="text-emerald-400 font-bold text-lg">
                        {formatCurrency(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>

              {/* 🆕 Prescription Capture Section */}
              <PrescriptionCapture
                prescriptions={prescriptions}
                onCapture={(prescription) => {
                  setPrescriptions(prev => [...prev, prescription]);
                }}
                onRemove={(id) => {
                  setPrescriptions(prev => prev.filter(p => p.id !== id));
                }}
                maxPrescriptions={3}
              />

              {/* Total and Payment Button */}
              <div className="fixed bottom-20 left-0 right-0 bg-slate-900 border-t border-slate-700 pt-4 pb-4 px-4 z-30">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 rounded-xl p-5 border border-emerald-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold text-lg">Total</span>
                      <span className="text-3xl font-bold text-emerald-400">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setStep('customer_info')}
                    className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
                  >
                    Continuer →
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>

        <Navigation />
      </div>
    );
  }

  // 🆕 Customer Info Step (Optional)
  if (step === 'customer_info') {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />

        <main className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 sm:space-y-6 lg:space-y-7">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-6 sm:p-7 lg:p-8 shadow-md border border-slate-700">
            <h2 className="text-white text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-2">Informations client</h2>
            <p className="text-slate-400 text-sm sm:text-base">Optionnel - Vous pouvez passer cette étape</p>
          </div>

          <Card className="p-5 rounded-xl shadow-sm border border-slate-700 bg-slate-900">
            <CustomerAutocomplete
              customerName={customerName}
              customerPhone={customerPhone}
              onCustomerSelect={(name, phone) => {
                setCustomerName(name);
                setCustomerPhone(phone);
              }}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
            />
          </Card>

          <div className="space-y-3">
            <Button
              onClick={() => setStep('payment')}
              className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
            >
              {customerName ? 'Continuer avec ces informations →' : 'Passer cette étape →'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setStep('cart')}
              className="w-full h-12 rounded-xl border-2 font-semibold"
            >
              ← Retour au panier
            </Button>
          </div>
        </main>

        <Navigation />
      </div>
    );
  }

  // Payment Step
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />

        <main className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 sm:space-y-6 lg:space-y-7">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-6 shadow-md border border-slate-700">
            <h2 className="text-slate-300 mb-2 text-lg sm:text-xl lg:text-2xl font-medium">Encaissement</h2>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-emerald-400">
              {formatCurrency(cartTotal)}
            </div>
          </div>

          <Card className="p-5 sm:p-6 lg:p-7 rounded-xl shadow-sm border border-slate-700 bg-slate-900">
            <h3 className="text-white font-semibold text-lg sm:text-xl lg:text-2xl mb-4">Résumé de la commande</h3>
            <div className="space-y-2 mb-4">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between text-sm p-3 bg-slate-950 rounded-lg"
                >
                  <span className="text-slate-300 font-medium">
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="text-white font-semibold">
                    {formatCurrency(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-700 pt-4 flex items-center justify-between bg-emerald-900/20 rounded-lg p-4">
              <span className="text-white font-semibold text-lg">Total</span>
              <span className="text-2xl font-bold text-emerald-400">
                {formatCurrency(cartTotal)}
              </span>
            </div>
          </Card>

          {/* Customer Info Display - Show if customer info was entered */}
          {customerName && (
            <Card className="p-5 sm:p-6 rounded-xl shadow-md border border-blue-700/50 bg-gradient-to-br from-blue-900/30 to-blue-900/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                    Client
                  </div>
                  <div className="text-white font-bold text-lg mb-0.5 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {customerName}
                  </div>
                  {customerPhone && (
                    <div className="text-sm text-blue-300/70 font-medium">{customerPhone}</div>
                  )}
                </div>
                <button
                  onClick={() => setStep('customer_info')}
                  className="text-blue-400 hover:text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                >
                  Modifier
                </button>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg sm:text-xl lg:col-span-2">Méthode de paiement</h3>

            {/* Payment cards container - Grid layout on large screens */}
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {/* Cash payment with calculator - TACTILE REGISTER AESTHETIC */}
              <div className="space-y-3 lg:col-span-2">
              <button
                onClick={() => setShowCashCalculator(!showCashCalculator)}
                disabled={isProcessing}
                className="group relative w-full p-5 bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border-2 border-emerald-700/50 hover:border-emerald-500 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  boxShadow: showCashCalculator
                    ? 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(16, 185, 129, 0.2)'
                    : '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-800 shadow-lg flex items-center justify-center transform transition-transform group-hover:scale-110"
                      style={{
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2), inset 0 -2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      <Banknote className="w-7 h-7 text-white drop-shadow-md" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-xl sm:text-2xl lg:text-3xl mb-0.5 tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        Espèces
                      </div>
                      <div className="text-sm sm:text-base text-emerald-400/90 font-semibold uppercase tracking-wider">
                        Paiement Cash
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-11 h-11 rounded-lg flex items-center justify-center transition-all",
                    showCashCalculator
                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110"
                      : "bg-emerald-700/50 group-hover:bg-emerald-600/50"
                  )}>
                    {showCashCalculator ? (
                      <Check className="w-6 h-6 text-white animate-in zoom-in duration-200" />
                    ) : (
                      <Calculator className="w-5 h-5 text-emerald-300" />
                    )}
                  </div>
                </div>
              </button>

              {/* Cash Calculator Panel - COMPACT REGISTER INTERFACE */}
              {showCashCalculator && (
                <div
                  className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 rounded-xl p-4 border-2 border-emerald-700/30 shadow-xl space-y-3 animate-in slide-in-from-top duration-300"
                  style={{
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Register display - Compact */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-emerald-400 mb-1.5 uppercase tracking-widest">
                      Montant Reçu
                    </label>
                    <div className="relative bg-slate-950 rounded-lg p-3 border-2 border-emerald-900/50"
                      style={{
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
                      }}
                    >
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder={cartTotal.toString()}
                        className="h-12 text-2xl font-bold text-center bg-transparent border-none text-emerald-400 placeholder:text-emerald-900/50 focus-visible:ring-0"
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          textShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
                          letterSpacing: '0.05em',
                        }}
                        autoFocus
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                        GNF
                      </div>
                    </div>
                  </div>

                  {/* Change display - Compact receipt style */}
                  {amountReceived && parseFloat(amountReceived) >= cartTotal && (
                    <div
                      className="relative bg-gradient-to-br from-emerald-950/50 to-emerald-900/30 rounded-lg p-3 border-2 border-emerald-600/50 animate-in slide-in-from-bottom duration-200"
                      style={{
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Monnaie</span>
                        <div className="flex items-center gap-2">
                          {changeAmount === 0 && (
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/50">
                              EXACT
                            </span>
                          )}
                          <span className="text-2xl font-black text-emerald-400"
                            style={{
                              fontVariantNumeric: 'tabular-nums',
                              textShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                            }}
                          >
                            {formatCurrency(changeAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {amountReceived && parseFloat(amountReceived) < cartTotal && (
                    <div className="bg-red-950/50 rounded-lg p-3 border-2 border-red-700/50 animate-in slide-in-from-bottom duration-200">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-sm">Montant insuffisant</span>
                          <span className="text-xs text-red-300 ml-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            (Manque {formatCurrency(cartTotal - parseFloat(amountReceived))})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirmation button - Always visible when calculator is open */}
                  <Button
                    onClick={() => handlePayment('CASH')}
                    disabled={isProcessing || !amountReceived || parseFloat(amountReceived) < cartTotal}
                    className="relative w-full h-14 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 text-white font-black text-base rounded-xl shadow-lg shadow-emerald-500/40 active:scale-95 transition-all border-2 border-emerald-400 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    style={{
                      boxShadow: (!amountReceived || parseFloat(amountReceived) < cartTotal) ? undefined : '0 6px 20px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      <>
                        <Check className="w-6 h-6 mr-2" />
                        <span className="uppercase tracking-wider">Confirmer Paiement</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Orange Money payment - DIGITAL TRANSACTION AESTHETIC */}
            <button
              onClick={() => setShowOrangeMoneyDialog(true)}
              disabled={isProcessing}
              className="group relative w-full p-5 bg-gradient-to-br from-orange-900/30 to-orange-900/10 border-2 border-orange-700/50 hover:border-orange-500 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-700 to-orange-800 shadow-lg flex items-center justify-center transform transition-transform group-hover:scale-110 group-hover:rotate-3"
                    style={{
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2), inset 0 -2px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {isProcessing && !showCashCalculator ? (
                      <Loader2 className="w-7 h-7 text-white animate-spin drop-shadow-md" />
                    ) : (
                      <CreditCard className="w-7 h-7 text-white drop-shadow-md" />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-bold text-xl sm:text-2xl lg:text-3xl mb-0.5 tracking-tight">
                      Orange Money
                    </div>
                    <div className="text-sm sm:text-base text-orange-400/90 font-semibold uppercase tracking-wider flex items-center gap-2">
                      <span>Paiement Mobile</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-lg bg-orange-600/50 group-hover:bg-orange-500 flex items-center justify-center transition-all shadow-inner">
                  <Check className="w-6 h-6 text-orange-200 group-hover:text-white" />
                </div>
              </div>
            </button>

            {/* Credit payment - CONTRACT/SIGNATURE AESTHETIC */}
            <button
              onClick={() => setShowCreditDialog(true)}
              disabled={isProcessing}
              className="group relative w-full p-5 bg-gradient-to-br from-amber-900/30 to-amber-900/10 border-2 border-amber-700/50 hover:border-amber-500 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              style={{
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-amber-700 to-amber-800 shadow-lg flex items-center justify-center transform transition-transform group-hover:scale-110"
                    style={{
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2), inset 0 -2px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    <Calculator className="w-7 h-7 text-white drop-shadow-md" />
                    {/* Clock/time indicator */}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-950 rounded-full border-2 border-amber-400 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-amber-400" />
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-bold text-xl sm:text-2xl lg:text-3xl mb-0.5 tracking-tight flex items-center gap-2">
                      Crédit
                      {/* Trust badge */}
                      <span className="text-xs sm:text-sm font-bold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-700/50">
                        DIFFÉRÉ
                      </span>
                    </div>
                    <div className="text-sm sm:text-base text-amber-400/90 font-semibold uppercase tracking-wider">
                      Payer plus tard
                    </div>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-lg bg-amber-600/50 group-hover:bg-amber-500 flex items-center justify-center transition-all shadow-inner">
                  <Check className="w-6 h-6 text-amber-200 group-hover:text-white" />
                </div>
              </div>
            </button>
            </div>
            {/* End payment cards grid */}

            <Button
              variant="outline"
              onClick={() => {
                setStep('customer_info');
                setShowCashCalculator(false);
                setAmountReceived('');
              }}
              className="w-full h-12 rounded-xl border-2 font-semibold"
            >
              ← Retour
            </Button>
          </div>

          {/* Orange Money Dialog - FINTECH VERIFICATION FLOW */}
          {showOrangeMoneyDialog && (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 animate-in fade-in duration-300 px-4"
              onClick={() => setShowOrangeMoneyDialog(false)}
            >
              <div
                className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/20 rounded-3xl w-full max-w-md sm:max-w-lg shadow-2xl animate-in zoom-in duration-300 border-2 border-orange-500/30 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{
                  boxShadow: '0 20px 60px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                {/* Animated signal waves background */}
                <div className="absolute top-0 right-0 w-64 h-64 overflow-hidden pointer-events-none">
                  <div
                    className="absolute top-0 right-0 w-48 h-48 rounded-full border-2 border-orange-500/10 animate-ping"
                    style={{ animationDuration: '3s' }}
                  />
                  <div
                    className="absolute top-0 right-0 w-48 h-48 rounded-full border-2 border-orange-500/10 animate-ping"
                    style={{ animationDuration: '3s', animationDelay: '1s' }}
                  />
                </div>

                {/* Header with security badge */}
                <div className="relative bg-gradient-to-r from-orange-600 to-orange-500 p-6 pb-8">
                  <button
                    onClick={() => setShowOrangeMoneyDialog(false)}
                    className="absolute top-4 right-4 text-orange-200 hover:text-white w-10 h-10 rounded-lg hover:bg-orange-700/50 flex items-center justify-center transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-xl flex items-center justify-center border-2 border-white/30">
                      <CreditCard className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-2xl tracking-tight drop-shadow-md">
                        Orange Money
                      </h3>
                      <div className="flex items-center gap-2 text-orange-100 text-sm font-semibold">
                        <div className="w-2 h-2 rounded-full bg-orange-200 animate-pulse" />
                        <span>Paiement Sécurisé</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount display */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                    <div className="text-xs font-bold text-orange-100 mb-1 uppercase tracking-widest">
                      Montant à Payer
                    </div>
                    <div className="text-4xl font-black text-white"
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        textShadow: '0 2px 20px rgba(0,0,0,0.3)',
                      }}
                    >
                      {formatCurrency(cartTotal)}
                    </div>
                  </div>
                </div>

                {/* Form content */}
                <div className="relative p-6 space-y-5">
                  {/* Reference input with verification styling */}
                  <div>
                    <label className="block text-xs font-bold text-orange-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-black border border-orange-500/50">
                        1
                      </span>
                      Référence de Transaction
                      <span className="ml-auto text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                        OPTIONNEL
                      </span>
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={orangeMoneyRef}
                        onChange={(e) => setOrangeMoneyRef(e.target.value.toUpperCase())}
                        placeholder="OM202601131234 (optionnel)"
                        className="h-16 bg-slate-950 border-2 border-orange-900/50 focus:border-orange-500 rounded-xl text-lg font-bold text-center text-white placeholder:text-slate-700 tracking-wider"
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '0.1em',
                        }}
                        autoFocus
                      />
                      {orangeMoneyRef && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center animate-in zoom-in duration-200">
                            <Check className="w-5 h-5 text-emerald-400" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
                      </div>
                      <p className="font-medium leading-relaxed">
                        {orangeMoneyRef ? (
                          "Code de confirmation saisi - sera enregistré avec la vente"
                        ) : (
                          "Laisser vide pour générer automatiquement une référence (OM-timestamp)"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Security indicators */}
                  <div className="flex items-center justify-center gap-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Connexion Sécurisée</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                    <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                      <span>256-bit SSL</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowOrangeMoneyDialog(false);
                        setOrangeMoneyRef('');
                      }}
                      className="flex-1 h-14 rounded-xl border-2 border-slate-700 hover:border-slate-600 font-bold text-slate-300 hover:text-white transition-all"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={() => {
                        setShowOrangeMoneyDialog(false);
                        handlePayment('ORANGE_MONEY');
                      }}
                      disabled={isProcessing}
                      className="relative flex-[2] h-14 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-orange-400 hover:to-orange-500 text-white font-black rounded-xl shadow-xl shadow-orange-500/50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-orange-400 overflow-hidden"
                      style={{
                        boxShadow: '0 8px 24px rgba(249, 115, 22, 0.5)',
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        <>
                          <Check className="w-6 h-6 mr-2 drop-shadow-lg" />
                          <span className="uppercase tracking-wider">{orangeMoneyRef ? 'Confirmer Paiement' : 'Payer Sans Réf.'}</span>
                        </>
                      )}
                      {/* Shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Credit Payment Dialog - CONTRACT/SIGNATURE AESTHETIC */}
          {showCreditDialog && (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 animate-in fade-in duration-300 px-4"
              onClick={() => setShowCreditDialog(false)}
            >
              <div
                className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 rounded-3xl w-full max-w-md sm:max-w-lg shadow-2xl animate-in zoom-in duration-300 border-2 border-amber-500/30 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{
                  boxShadow: '0 20px 60px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {/* Document lined paper texture */}
                <div
                  className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{
                    backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 31px, rgba(245, 158, 11, 0.3) 31px, rgba(245, 158, 11, 0.3) 32px)`,
                  }}
                />

                {/* Header - Contract style */}
                <div className="relative bg-gradient-to-br from-amber-900/40 to-amber-950/40 p-6 border-b-2 border-amber-700/50">
                  <button
                    onClick={() => setShowCreditDialog(false)}
                    className="absolute top-4 right-4 text-amber-300 hover:text-amber-200 w-10 h-10 rounded-lg hover:bg-amber-900/30 flex items-center justify-center transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-start gap-4 mb-3">
                    <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-lg flex items-center justify-center border-2 border-amber-400/50">
                      <Calculator className="w-7 h-7 text-white drop-shadow-md" />
                      {/* Obligation seal */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-950 border-2 border-amber-400 flex items-center justify-center">
                        <div className="text-[8px] font-black text-amber-400">₢</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white font-black text-2xl tracking-tight mb-1">
                        Crédit
                      </h3>
                      <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Paiement Différé</span>
                      </div>
                    </div>
                  </div>

                  {/* Trust badge */}
                  <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-700/50 rounded-lg px-3 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Accord Confidentiel
                    </span>
                  </div>
                </div>

                {/* Form content - Scrollable */}
                <div className="relative max-h-[70vh] overflow-y-auto">
                  <div className="relative p-5 space-y-4">
                  {/* Amount obligation */}
                  <div className="relative bg-gradient-to-br from-amber-950/50 to-amber-900/20 rounded-2xl p-5 border-2 border-amber-700/50"
                    style={{
                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-widest">
                          Montant Dû
                        </div>
                        <div className="text-3xl font-black text-amber-400"
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            textShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          {formatCurrency(cartTotal)}
                        </div>
                      </div>
                      {/* Time badge */}
                      <div className="bg-amber-900/40 border border-amber-700 rounded-lg px-3 py-2 text-center">
                        <div className="text-[10px] font-bold text-amber-400 uppercase">Délai</div>
                        <div className="text-lg font-black text-amber-300">
                          {Math.ceil((creditDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}j
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-300/70 font-medium border-t border-amber-700/30 pt-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>
                        Échéance: {creditDueDate.toLocaleDateString('fr-GN', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Date picker with signature feel */}
                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-black border border-amber-500/50">
                        1
                      </span>
                      Date d'Échéance Convenue
                    </label>
                    <Input
                      type="date"
                      value={creditDueDate.toISOString().split('T')[0]}
                      onChange={(e) => setCreditDueDate(new Date(e.target.value))}
                      min={new Date().toISOString().split('T')[0]}
                      className="h-14 bg-slate-950 border-2 border-amber-900/50 focus:border-amber-500 rounded-xl text-lg font-bold text-center text-amber-400"
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  </div>

                  {/* Quick duration presets */}
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                      Périodes Usuelles
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 7, 14, 30].map((days) => (
                        <button
                          key={days}
                          onClick={() => setCreditDueDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000))}
                          className={cn(
                            "px-3 py-3 rounded-lg text-sm font-bold transition-all active:scale-95 border-2",
                            Math.ceil((creditDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) === days
                              ? "bg-gradient-to-b from-amber-500 to-amber-600 text-white border-amber-400 shadow-lg"
                              : "bg-gradient-to-b from-slate-800 to-slate-900 text-slate-300 border-slate-700/50 hover:border-amber-600"
                          )}
                          style={{
                            boxShadow: Math.ceil((creditDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) === days
                              ? '0 4px 12px rgba(245, 158, 11, 0.4), inset 0 -1px 2px rgba(0,0,0,0.3)'
                              : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                          }}
                        >
                          <div className="text-xs opacity-70">+{days}</div>
                          <div className="font-black">J</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer name requirement - Always show for credit */}
                  <div className={cn(
                    "rounded-xl p-4 border-2 transition-all",
                    customerName
                      ? "bg-slate-950/50 border-amber-700/30"
                      : "bg-red-950/30 border-red-700/50 animate-pulse"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border",
                          customerName
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                            : "bg-red-500/20 border-red-500/50 text-red-400"
                        )}>
                          2
                        </span>
                        <span className={customerName ? "text-amber-400" : "text-red-400"}>
                          {customerName ? "Client Signataire" : "Nom du Client Requis"}
                        </span>
                      </div>
                      {customerName && <div className="w-1 h-1 rounded-full bg-amber-500" />}
                      {!customerName && <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />}
                    </div>
                    {customerName ? (
                      <>
                        <div className="text-white font-bold text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {customerName}
                        </div>
                        {customerPhone && (
                          <div className="text-sm text-amber-300/70 mt-1 font-medium">{customerPhone}</div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setShowCreditDialog(false);
                          setStep('customer_info');
                        }}
                        className="w-full mt-2 px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <AlertCircle className="w-5 h-5" />
                        <span>Ajouter les informations du client</span>
                      </button>
                    )}
                  </div>

                  {/* Legal notice */}
                  <div className="bg-amber-900/10 rounded-xl p-4 border border-amber-700/30">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                      </div>
                      <p className="text-xs text-amber-300/90 font-medium leading-relaxed">
                        Le montant total devra être réglé avant la date d'échéance. Un suivi sera disponible dans l'historique des ventes.
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreditDialog(false);
                        setCreditDueDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
                      }}
                      className="flex-1 h-12 rounded-xl border-2 border-slate-700 hover:border-slate-600 font-bold text-slate-300 hover:text-white transition-all"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={() => {
                        setShowCreditDialog(false);
                        handlePayment('CREDIT');
                      }}
                      disabled={isProcessing || !customerName.trim()}
                      className="relative flex-[2] h-12 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:via-amber-400 hover:to-amber-500 text-white font-black rounded-xl shadow-xl shadow-amber-500/50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-amber-400 overflow-hidden"
                      style={{
                        boxShadow: customerName.trim() ? '0 8px 24px rgba(245, 158, 11, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)' : undefined,
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                          Confirmation...
                        </>
                      ) : !customerName.trim() ? (
                        <>
                          <AlertCircle className="w-6 h-6 mr-2" />
                          <span className="uppercase tracking-wider">Nom client requis</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-6 h-6 mr-2 drop-shadow-lg" />
                          <span className="uppercase tracking-wider">Confirmer</span>
                        </>
                      )}
                      {/* Shine effect */}
                      {customerName.trim() && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                      )}
                    </Button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <Navigation />
      </div>
    );
  }

  // Receipt Step
  if (step === 'receipt' && lastSale) {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />

        <main className="max-w-md sm:max-w-lg lg:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 sm:space-y-6 lg:space-y-7">
          {/* Success banner */}
          <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 rounded-2xl p-10 text-center shadow-2xl shadow-emerald-600/40 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl" />

            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mx-auto mb-5 shadow-2xl">
                <Check className="w-10 h-10 text-emerald-600 stroke-[3]" />
              </div>
              <h2 className="text-white text-3xl font-bold mb-2">Vente confirmée</h2>
              <p className="text-emerald-100 text-lg font-medium">Paiement enregistré avec succès</p>
            </div>
          </div>

          <Card className="p-6 rounded-xl shadow-sm border border-slate-700 bg-slate-900">
            <div className="text-center mb-5 pb-5 border-b border-slate-700">
              <h3 className="text-white font-bold text-2xl mb-1">Seri</h3>
              <p className="text-emerald-400 font-medium mb-2">
                Pharmacie Thierno Mamadou
              </p>
              <p className="text-sm text-slate-400 font-medium">
                {new Date(lastSale.created_at).toLocaleDateString('fr-GN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-slate-400 font-medium">
                {new Date(lastSale.created_at).toLocaleTimeString('fr-GN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Receipt Items - Now using stored items from lastSale */}
            <div className="space-y-2 mb-5">
              {lastSale.items.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-slate-950 rounded-lg p-3 border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-white font-semibold flex-1">
                      {item.product.name}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {formatCurrency(item.product.price * item.quantity)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 font-medium">
                    {item.quantity} × {formatCurrency(item.product.price)}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-900/20 rounded-xl p-5 mb-5 border border-emerald-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold text-xl">Total</span>
                <span className="text-3xl font-bold text-emerald-400">
                  {formatCurrency(lastSale.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-emerald-700">
                <span className="text-slate-300 font-medium">Paiement</span>
                <span className="text-white font-semibold">
                  {lastSale.payment_method === 'ORANGE_MONEY'
                    ? 'Orange Money'
                    : lastSale.payment_method === 'CREDIT'
                    ? 'À crédit'
                    : 'Espèces'}
                </span>
              </div>
              {/* 🆕 Credit payment details */}
              {lastSale.payment_method === 'CREDIT' && lastSale.due_date && (
                <div className="mt-3 pt-3 border-t border-emerald-700">
                  <div className="bg-amber-900/20 rounded-lg p-3 border border-amber-700">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-amber-300 font-semibold">Paiement différé</span>
                    </div>
                    <div className="text-sm text-slate-300">
                      <span className="font-medium">À payer avant le:</span>
                      <div className="text-white font-bold mt-1">
                        {new Date(lastSale.due_date).toLocaleDateString('fr-GN', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    {lastSale.customer_name && (
                      <div className="text-sm text-slate-300 mt-2 pt-2 border-t border-amber-700/50">
                        <span className="font-medium">Client:</span>
                        <div className="text-white font-semibold">{lastSale.customer_name}</div>
                        {lastSale.customer_phone && (
                          <div className="text-slate-400 text-xs mt-0.5">{lastSale.customer_phone}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-center text-sm text-slate-400 font-medium bg-slate-950 rounded-lg py-3">
              Ticket #{lastSale.id}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => {
                // Generate receipt text for WhatsApp
                const receiptText = `Merci pour votre achat!\n\n🏥 Pharmacie Thierno Mamadou\n\n${lastSale.items
                  .map(
                    (item) =>
                      `${item.product.name}\n${item.quantity} × ${formatCurrency(item.product.price)}`
                  )
                  .join('\n\n')}\n\n💰 Total: ${formatCurrency(lastSale.total)}\n\n${
                  lastSale.payment_method === 'ORANGE_MONEY'
                    ? '📱 Orange Money'
                    : '💵 Espèces'
                }\n\nTicket #${lastSale.id}`;

                // Share via WhatsApp
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(receiptText)}`;
                window.open(whatsappUrl, '_blank');
                toast.success('Ouverture de WhatsApp...');
              }}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Partager sur WhatsApp
            </Button>

            <Button
              onClick={handleNewSale}
              className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
            >
              Nouvelle vente
            </Button>
          </div>
        </main>

        <Navigation />
      </div>
    );
  }

  return null;
}
