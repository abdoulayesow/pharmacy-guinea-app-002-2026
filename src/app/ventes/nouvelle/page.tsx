'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { formatCurrency } from '@/lib/shared/utils';
import type { Product, Sale, SaleItem } from '@/lib/shared/types';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Step = 'search' | 'cart' | 'payment' | 'receipt';
type PaymentMethod = 'CASH' | 'ORANGE_MONEY';

export default function NouvellVentePage() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuthStore();
  const { items: cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getTotal } = useCartStore();

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

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

  const handleAddToCart = () => {
    if (selectedProduct && quantity > 0) {
      // Add multiple quantities at once
      for (let i = 0; i < quantity; i++) {
        addToCart(selectedProduct);
      }
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  const handlePayment = async (method: PaymentMethod) => {
    if (!currentUser || cartItems.length === 0) return;

    try {
      // Create sale record
      const sale: Sale = {
        created_at: new Date(),
        total: cartTotal,
        payment_method: method,
        payment_ref: method === 'ORANGE_MONEY' ? `OM-${Date.now()}` : null,
        user_id: currentUser.id,
        synced: false,
      };

      // Add to database
      const saleId = await db.sales.add(sale);

      // Create sale items
      const saleItems: SaleItem[] = cartItems.map((item) => ({
        sale_id: saleId as number,
        product_id: item.product.id!,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));

      await db.sale_items.bulkAdd(saleItems);

      // Update product stock
      for (const item of cartItems) {
        const product = await db.products.get(item.product.id!);
        if (product) {
          await db.products.update(item.product.id!, {
            stock: product.stock - item.quantity,
            synced: false,
          });
        }
      }

      // Queue for sync
      await queueTransaction('SALE', 'CREATE', { ...sale, id: saleId }, String(saleId));

      // Set last sale for receipt
      setLastSale({ ...sale, id: saleId as number });

      // Clear cart and go to receipt
      clearCart();
      setStep('receipt');
    } catch (error) {
      console.error('Error completing sale:', error);
      alert('Erreur lors de la vente');
    }
  };

  const handleNewSale = () => {
    setStep('search');
    setSearchQuery('');
    setSelectedProduct(null);
    setQuantity(1);
    setLastSale(null);
  };

  // Search Step
  if (step === 'search') {
    return (
      <div className="min-h-screen bg-slate-800 pb-24">
        <Header />

        <main className="max-w-md mx-auto px-4 py-6 space-y-4">
          <div className="bg-slate-900 rounded-lg p-5 shadow-sm border border-slate-700 ">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-white text-xl font-semibold">Nouvelle vente</h2>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search
                className={cn(
                  'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors',
                  searchQuery ? 'text-blue-600' : 'text-gray-400'
                )}
              />
              <Input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 h-14 bg-slate-900 border-2 border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-xl text-base shadow-sm focus:shadow-md transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product List */}
          <div className="space-y-3">
            {filteredProducts.length === 0 ? (
              <Card className="p-12 text-center rounded-lg">
                <div className="text-slate-600 mb-3">
                  <Search className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-slate-400 font-medium">Aucun produit trouvé</p>
              </Card>
            ) : (
              filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="p-5 cursor-pointer hover:border-emerald-600 hover:shadow-lg transition-all duration-200 active:scale-[0.98] rounded-lg bg-slate-900"
                  onClick={() => {
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
                            ? 'bg-red-600 text-white border-2 border-red-700'
                            : product.stock <= product.minStock
                            ? 'bg-amber-500 text-white border-2 border-amber-600'
                            : 'bg-emerald-600 text-white border-2 border-emerald-700'
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
                className="w-full max-w-md mx-auto h-14 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg rounded-lg font-semibold active:scale-95 transition-all duration-200"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Voir le panier ({cartItems.length}) • {formatCurrency(cartTotal)}
              </Button>
            </div>
          )}

          {/* Quick Add Modal */}
          {selectedProduct && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end z-50"
              onClick={() => setSelectedProduct(null)}
            >
              <div
                className="bg-slate-900 rounded-t-xl w-full p-6 max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-xl mb-1">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {selectedProduct.category || 'Général'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-slate-400 hover:text-slate-300 w-10 h-10 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="bg-emerald-900/20 rounded-lg p-5 border border-emerald-800">
                    <div className="text-sm text-emerald-400 font-medium mb-1">
                      Prix unitaire
                    </div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {formatCurrency(selectedProduct.price)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-400 font-medium mb-3">Quantité</div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-12 h-12 rounded-lg border-2"
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="text-center h-12 text-2xl font-bold border-2 rounded-lg"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                        disabled={quantity >= selectedProduct.stock}
                        className="w-12 h-12 rounded-lg border-2"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="text-sm text-slate-400 mt-2 text-center font-medium">
                      Stock disponible: {selectedProduct.stock}
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-5">
                    <div className="flex items-center justify-between mb-4 bg-slate-800 rounded-lg p-4">
                      <span className="text-slate-300 font-medium">Total</span>
                      <span className="text-3xl font-bold text-emerald-400">
                        {formatCurrency(selectedProduct.price * quantity)}
                      </span>
                    </div>
                    <Button
                      onClick={handleAddToCart}
                      disabled={quantity > selectedProduct.stock || selectedProduct.stock === 0}
                      className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg active:scale-95 transition-all"
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

        <main className="max-w-md mx-auto px-4 py-6 space-y-4 pb-36">
          <div className="bg-slate-900 rounded-lg p-5 shadow-sm border border-slate-700 ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-white text-xl font-semibold">Panier</h2>
              </div>
              <button
                onClick={() => setStep('search')}
                className="text-emerald-400 font-semibold text-sm flex items-center gap-1 hover:text-emerald-300"
              >
                <Plus className="w-5 h-5" />
                Ajouter
              </button>
            </div>
          </div>

          {cartItems.length === 0 ? (
            <Card className="p-12 text-center rounded-lg">
              <ShoppingCart className="w-16 h-16 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium mb-4">Votre panier est vide</p>
              <Button
                onClick={() => setStep('search')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Ajouter des produits
              </Button>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <Card key={item.product.id} className="p-5 rounded-lg shadow-sm">
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
                          className="w-9 h-9 p-0 rounded-lg border-2 active:scale-90 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-10 text-center font-semibold text-lg">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id!, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-9 h-9 p-0 rounded-lg border-2 active:scale-90 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.product.id!)}
                          className="w-9 h-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-900/20 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                      <span className="text-sm text-slate-400 font-medium">Sous-total</span>
                      <span className="text-emerald-900 dark:text-emerald-400 font-bold text-lg">
                        {formatCurrency(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Total and Payment Button */}
              <div className="fixed bottom-20 left-0 right-0 bg-slate-800 border-t border-slate-700 pt-4 pb-4 px-4 z-30">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="bg-emerald-900/20 rounded-lg p-5 border border-emerald-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold text-lg">Total</span>
                      <span className="text-3xl font-bold text-emerald-400">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setStep('payment')}
                    className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg active:scale-95 transition-all"
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
          <div className="bg-slate-900 rounded-lg p-6 shadow-sm border border-slate-700">
            <h2 className="text-slate-300 mb-2 text-lg font-medium">Encaissement</h2>
            <div className="text-4xl font-bold text-emerald-400">
              {formatCurrency(cartTotal)}
            </div>
          </div>

          <Card className="p-5 rounded-lg shadow-sm">
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

            {/* Cash payment */}
            <button
              onClick={() => handlePayment('CASH')}
              className="w-full p-5 bg-emerald-900/20 dark:bg-emerald-900/20 border-2 border-emerald-700 dark:border-emerald-700 hover:border-emerald-600 dark:hover:border-emerald-600 hover:shadow-lg rounded-xl text-left transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-lg mb-1">Espèces</div>
                    <div className="text-sm text-emerald-400 font-medium">Paiement en cash</div>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center transition-colors">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>

            {/* Orange Money payment */}
            <button
              onClick={() => handlePayment('ORANGE_MONEY')}
              className="w-full p-5 bg-orange-900/20 dark:bg-orange-900/20 border-2 border-orange-700 dark:border-orange-700 hover:border-orange-600 dark:hover:border-orange-600 hover:shadow-lg rounded-xl text-left transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-orange-500 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-lg mb-1">Orange Money</div>
                    <div className="text-sm text-orange-400 font-medium">Paiement mobile</div>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center transition-colors">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>

            <Button
              variant="outline"
              onClick={() => setStep('cart')}
              className="w-full h-12 rounded-lg border-2 font-semibold"
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
          {/* Success state with celebration feel */}
          <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 rounded-2xl p-10 text-center shadow-2xl shadow-emerald-600/40 overflow-hidden">
            {/* Decorative elements */}
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

          <Card className="p-6 rounded-lg shadow-sm">
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

            {/* Receipt Items */}
            <div className="space-y-2 mb-5">
              {cartItems.map((item) => (
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

            <div className="bg-emerald-900/20 rounded-lg p-5 mb-5 border border-emerald-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold text-xl">Total</span>
                <span className="text-3xl font-bold text-emerald-400">
                  {formatCurrency(lastSale.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-3 border-t border-emerald-200 dark:border-emerald-700">
                <span className="text-slate-300 font-medium">Paiement</span>
                <span className="text-white font-semibold capitalize">
                  {lastSale.payment_method === 'ORANGE_MONEY' ? 'Orange Money' : 'Espèces'}
                </span>
              </div>
            </div>

            <div className="text-center text-sm text-slate-400 font-medium bg-slate-700 rounded-lg py-3">
              Ticket #{lastSale.id}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
              <Button
                onClick={() => {
                  // Generate receipt text for WhatsApp
                  const receiptText = `Merci pour votre achat!\n\n🏥 Pharmacie Thierno Mamadou\n\n${cartItems
                    .map(
                      (item) =>
                        `${item.product.name}\n${item.quantity} × ${formatCurrency(
                          item.product.price
                        )}`
                    )
                    .join('\n\n')}\n\n💰 Total: ${formatCurrency(lastSale.total)}\n\n${
                    lastSale.payment_method === 'ORANGE_MONEY'
                      ? '📱 Orange Money'
                      : '💵 Espèces'
                  }\n\nTicket #${lastSale.id}`;

                  // Share via WhatsApp
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
                    receiptText
                  )}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Partager sur WhatsApp
              </Button>

              <Button
                onClick={handleNewSale}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg active:scale-95 transition-all"
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
