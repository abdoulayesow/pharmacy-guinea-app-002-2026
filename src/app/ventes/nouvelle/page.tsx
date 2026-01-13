'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { formatCurrency } from '@/lib/shared/utils';
import type { Product, Sale, SaleItem, CartItem, StockMovement } from '@/lib/shared/types';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Step = 'search' | 'cart' | 'payment' | 'receipt';
type PaymentMethod = 'CASH' | 'ORANGE_MONEY';

interface CompletedSale extends Sale {
  items: CartItem[];
}

export default function NouvelleVentePage() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuthStore();
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getTotal } = useCartStore();

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lastSale, setLastSale] = useState<CompletedSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cash calculator state
  const [showCashCalculator, setShowCashCalculator] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');

  // Get products from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cartTotal = getTotal();
  const changeAmount = amountReceived ? parseFloat(amountReceived) - cartTotal : 0;

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
    if (!currentUser || cartItems.length === 0) return;

    // For cash, validate amount received
    if (method === 'CASH' && showCashCalculator) {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < cartTotal) {
        toast.error('Montant reçu insuffisant');
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Store cart items before clearing (for receipt display)
      const saleItems = [...cartItems];

      // Create sale record
      const sale: Sale = {
        created_at: new Date(),
        total: cartTotal,
        payment_method: method,
        payment_ref: method === 'ORANGE_MONEY' ? `OM-${Date.now()}` : null,
        user_id: currentUser.id,
        synced: false,
      };

      // Add sale to database
      const saleId = await db.sales.add(sale);

      // Create sale items records
      const saleItemsToAdd: SaleItem[] = saleItems.map((item) => ({
        sale_id: saleId as number,
        product_id: item.product.id!,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));

      await db.sale_items.bulkAdd(saleItemsToAdd);

      // Update product stock and create stock movements
      for (const item of saleItems) {
        const product = await db.products.get(item.product.id!);
        if (product) {
          // Update stock
          const newStock = product.stock - item.quantity;
          await db.products.update(item.product.id!, {
            stock: newStock,
            synced: false,
            updatedAt: new Date(),
          });

          // Create stock movement record for audit trail
          const movement: StockMovement = {
            product_id: item.product.id!,
            type: 'SALE',
            quantity_change: -item.quantity,
            reason: `Vente #${saleId}`,
            created_at: new Date(),
            user_id: currentUser.id,
            synced: false,
          };

          const movementId = await db.stock_movements.add(movement);

          // Queue stock movement for sync
          await queueTransaction('STOCK_MOVEMENT', 'CREATE', { ...movement, id: movementId }, String(movementId));
        }
      }

      // Queue sale for sync
      await queueTransaction('SALE', 'CREATE', { ...sale, id: saleId }, String(saleId));

      // Set last sale for receipt (with stored items)
      setLastSale({
        ...sale,
        id: saleId as number,
        items: saleItems,
      });

      // Clear cart and reset states
      clearCart();
      setAmountReceived('');
      setShowCashCalculator(false);

      // Show success toast
      toast.success('Vente enregistrée avec succès!');

      // Go to receipt
      setStep('receipt');
    } catch (error) {
      console.error('Error completing sale:', error);
      toast.error('Erreur lors de la vente. Veuillez réessayer.');
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
  };

  // Quick amount buttons for cash calculator
  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  // Search Step
  if (step === 'search') {
    return (
      <div className="min-h-screen bg-slate-800 pb-24">
        <Header />

        <main className="max-w-md mx-auto px-4 py-6 space-y-4">
          <div className="bg-slate-900 rounded-xl p-5 shadow-md border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold tracking-tight">Nouvelle vente</h2>
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
                className="pl-12 pr-10 h-14 bg-slate-800 border-2 border-slate-700 focus:border-blue-500 rounded-xl text-base shadow-sm focus:shadow-md transition-all"
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
                      toast.error('Produit en rupture de stock');
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
                className="w-full max-w-md mx-auto h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 rounded-xl font-semibold active:scale-95 transition-all duration-200"
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
                className="bg-slate-900 rounded-t-3xl w-full p-6 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300"
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
                    <div className="flex items-center justify-between mb-4 bg-slate-800 rounded-xl p-4">
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
        </main>

        <Navigation />
      </div>
    );
  }

  // Cart Step
  if (step === 'cart') {
    return (
      <div className="min-h-screen bg-slate-800 pb-24">
        <Header />

        <main className="max-w-md mx-auto px-4 py-6 space-y-4 pb-48">
          <div className="bg-slate-900 rounded-xl p-5 shadow-md border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-white text-xl font-bold tracking-tight">Panier</h2>
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
                    onClick={() => setStep('payment')}
                    className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
                  >
                    Procéder au paiement →
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

  // Payment Step
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-slate-800 pb-24">
        <Header />

        <main className="max-w-md mx-auto px-4 py-6 space-y-5">
          <div className="bg-slate-900 rounded-xl p-6 shadow-md border border-slate-700">
            <h2 className="text-slate-300 mb-2 text-lg font-medium">Encaissement</h2>
            <div className="text-4xl font-bold text-emerald-400">
              {formatCurrency(cartTotal)}
            </div>
          </div>

          <Card className="p-5 rounded-xl shadow-sm border border-slate-700 bg-slate-900">
            <h3 className="text-white font-semibold text-lg mb-4">Résumé de la commande</h3>
            <div className="space-y-2 mb-4">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between text-sm p-3 bg-slate-800 rounded-lg"
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

          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">Méthode de paiement</h3>

            {/* Cash payment with calculator */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (!showCashCalculator) {
                    setShowCashCalculator(true);
                  } else {
                    handlePayment('CASH');
                  }
                }}
                disabled={isProcessing}
                className="w-full p-5 bg-emerald-900/20 border-2 border-emerald-700 hover:border-emerald-600 hover:shadow-lg rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md flex items-center justify-center">
                      {isProcessing && showCashCalculator ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Banknote className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-lg mb-1">Espèces</div>
                      <div className="text-sm text-emerald-400 font-medium">Paiement en cash</div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center transition-colors">
                    {showCashCalculator ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Calculator className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
              </button>

              {/* Cash Calculator Panel */}
              {showCashCalculator && (
                <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 space-y-4 animate-in slide-in-from-top duration-200">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Montant reçu (GNF)
                    </label>
                    <Input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={cartTotal.toString()}
                      className="h-14 text-xl font-bold text-center rounded-xl border-2 focus:border-emerald-500"
                    />
                  </div>

                  {/* Quick amount buttons */}
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setAmountReceived(amount.toString())}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95',
                          parseFloat(amountReceived) === amount
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        )}
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>

                  {/* Change display */}
                  {amountReceived && parseFloat(amountReceived) >= cartTotal && (
                    <div className="bg-emerald-900/30 rounded-xl p-4 border border-emerald-700">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-300 font-medium">Monnaie à rendre</span>
                        <span className="text-2xl font-bold text-emerald-400">
                          {formatCurrency(changeAmount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {amountReceived && parseFloat(amountReceived) < cartTotal && (
                    <div className="bg-red-900/30 rounded-xl p-4 border border-red-700">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">
                          Montant insuffisant (manque {formatCurrency(cartTotal - parseFloat(amountReceived))})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Orange Money payment */}
            <button
              onClick={() => handlePayment('ORANGE_MONEY')}
              disabled={isProcessing}
              className="w-full p-5 bg-orange-900/20 border-2 border-orange-700 hover:border-orange-600 hover:shadow-lg rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-md flex items-center justify-center">
                    {isProcessing && !showCashCalculator ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <CreditCard className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-lg mb-1">Orange Money</div>
                    <div className="text-sm text-orange-400 font-medium">Paiement mobile</div>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center transition-colors">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>

            <Button
              variant="outline"
              onClick={() => {
                setStep('cart');
                setShowCashCalculator(false);
                setAmountReceived('');
              }}
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

  // Receipt Step
  if (step === 'receipt' && lastSale) {
    return (
      <div className="min-h-screen bg-slate-800 pb-24">
        <Header />

        <main className="max-w-md mx-auto px-4 py-6 space-y-5">
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
                  className="bg-slate-800 rounded-lg p-3 border border-slate-700"
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
                  {lastSale.payment_method === 'ORANGE_MONEY' ? 'Orange Money' : 'Espèces'}
                </span>
              </div>
            </div>

            <div className="text-center text-sm text-slate-400 font-medium bg-slate-800 rounded-lg py-3">
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
