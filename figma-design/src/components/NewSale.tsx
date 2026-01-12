import { useState } from 'react';
import { useApp } from '../lib/context';
import { formatCurrency } from '../lib/utils';
import { Search, ShoppingCart, Plus, Minus, X, Check, Sparkles, CreditCard, Banknote } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

type Step = 'search' | 'cart' | 'payment' | 'receipt';

export function NewSale() {
  const { products, cart, addToCart, removeFromCart, updateCartQuantity, completeSale, lastSale } = useApp();
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  );

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleAddToCart = () => {
    if (selectedProduct && quantity > 0) {
      addToCart(selectedProduct, quantity);
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  const handlePayment = (method: 'cash' | 'orange-money') => {
    const sale = completeSale(method);
    if (sale) {
      setStep('receipt');
    }
  };

  const handleNewSale = () => {
    setStep('search');
    setSearchQuery('');
    setSelectedProduct(null);
    setQuantity(1);
  };

  // Search Step
  if (step === 'search') {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Nouvelle vente</h2>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg text-base"
            />
          </div>
        </div>

        {/* Product List */}
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <Card className="p-12 text-center rounded-lg">
              <div className="text-gray-300 dark:text-gray-600 mb-3">
                <Search className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun produit trouvé</p>
            </Card>
          ) : (
            filteredProducts.map(product => (
              <Card
                key={product.id}
                className="p-5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg transition-all duration-200 active:scale-[0.98] rounded-lg bg-white dark:bg-gray-800"
                onClick={() => {
                  setSelectedProduct(product);
                  setQuantity(1);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-gray-900 dark:text-white font-semibold mb-1">{product.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{product.category}</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">{formatCurrency(product.price)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      product.stock === 0
                        ? 'bg-red-600 text-white'
                        : product.stock <= product.minStock
                        ? 'bg-gray-600 dark:bg-gray-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      Stock: {product.stock}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Cart Summary Button */}
        {cart.length > 0 && (
          <div className="fixed bottom-24 left-0 right-0 px-4 z-30">
            <Button
              onClick={() => setStep('cart')}
              className="w-full max-w-md mx-auto h-14 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg rounded-md font-semibold active:scale-95 transition-all duration-200"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Voir le panier ({cart.length}) • {formatCurrency(cartTotal)}
            </Button>
          </div>
        )}

        {/* Quick Add Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end z-50" onClick={() => setSelectedProduct(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-t-xl w-full p-6 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1">
                  <h3 className="text-gray-900 dark:text-white font-semibold text-xl mb-1">{selectedProduct.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedProduct.category}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-5 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-1">Prix unitaire</div>
                  <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(selectedProduct.price)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-3">Quantité</div>
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
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center font-medium">
                    Stock disponible: {selectedProduct.stock}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                  <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Total</span>
                    <span className="text-3xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(selectedProduct.price * quantity)}</span>
                  </div>
                  <Button
                    onClick={handleAddToCart}
                    disabled={quantity > selectedProduct.stock || selectedProduct.stock === 0}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-md shadow-lg active:scale-95 transition-all"
                  >
                    Ajouter au panier
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Cart Step
  if (step === 'cart') {
    return (
      <div className="space-y-4 pb-36">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Panier</h2>
            </div>
            <button onClick={() => setStep('search')} className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300">
              <Plus className="w-5 h-5" />
              Ajouter
            </button>
          </div>
        </div>

        {cart.length === 0 ? (
          <Card className="p-12 text-center rounded-lg">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-4">Votre panier est vide</p>
            <Button onClick={() => setStep('search')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              Ajouter des produits
            </Button>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {cart.map(item => (
                <Card key={item.product.id} className="p-5 rounded-lg shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="text-gray-900 dark:text-white font-semibold mb-1">{item.product.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{formatCurrency(item.product.price)} × {item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="w-9 h-9 p-0 rounded-lg border-2 active:scale-90 transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-10 text-center font-semibold text-lg">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="w-9 h-9 p-0 rounded-lg border-2 active:scale-90 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.product.id)}
                        className="w-9 h-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Sous-total</span>
                    <span className="text-emerald-900 dark:text-emerald-400 font-bold text-lg">{formatCurrency(item.product.price * item.quantity)}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Total and Payment Button */}
            <div className="fixed bottom-20 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 pt-4 pb-4 px-4 z-30">
              <div className="max-w-md mx-auto space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-5 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold text-lg">Total</span>
                    <span className="text-3xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
                <Button
                  onClick={() => setStep('payment')}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-lg active:scale-95 transition-all"
                >
                  Procéder au paiement →
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Payment Step
  if (step === 'payment') {
    return (
      <div className="space-y-5">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-gray-700 dark:text-gray-300 mb-2 text-lg font-medium">Encaissement</h2>
          <div className="text-4xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(cartTotal)}</div>
        </div>

        <Card className="p-5 rounded-lg shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-4">Résumé de la commande</h3>
          <div className="space-y-2 mb-4">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center justify-between text-sm p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{item.product.name} × {item.quantity}</span>
                <span className="text-gray-900 dark:text-white font-semibold">{formatCurrency(item.product.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
            <span className="text-gray-900 dark:text-white font-semibold text-lg">Total</span>
            <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(cartTotal)}</span>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Méthode de paiement</h3>
          
          <button
            onClick={() => handlePayment('cash')}
            className="w-full p-5 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-800 hover:border-green-500 dark:hover:border-green-600 hover:shadow-lg rounded-lg text-left transition-all group active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center">
                  <Banknote className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-gray-900 dark:text-white font-semibold text-lg mb-1">Espèces</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Paiement en cash</div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-200 dark:bg-green-800 group-hover:bg-green-500 flex items-center justify-center transition-colors">
                <Check className="w-5 h-5 text-green-700 dark:text-green-300 group-hover:text-white" />
              </div>
            </div>
          </button>

          <button
            onClick={() => handlePayment('orange-money')}
            className="w-full p-5 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-800 hover:border-orange-500 dark:hover:border-orange-600 hover:shadow-lg rounded-lg text-left transition-all group active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-500 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-gray-900 dark:text-white font-semibold text-lg mb-1">Orange Money</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Paiement mobile</div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-200 dark:bg-orange-800 group-hover:bg-orange-500 flex items-center justify-center transition-colors">
                <Check className="w-5 h-5 text-orange-700 dark:text-orange-300 group-hover:text-white" />
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
      </div>
    );
  }

  // Receipt Step
  if (step === 'receipt' && lastSale) {
    return (
      <div className="space-y-5">
        <div className="bg-emerald-600 rounded-lg p-8 text-center shadow-lg border border-emerald-500">
          <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">Vente confirmée</h2>
          <p className="text-emerald-100 text-lg font-medium">Paiement enregistré avec succès</p>
        </div>

        <Card className="p-6 rounded-lg shadow-sm">
          <div className="text-center mb-5 pb-5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-900 dark:text-white font-bold text-2xl mb-1">Seri</h3>
            <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-2">Pharmacie Thierno Mamadou</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {new Date(lastSale.date).toLocaleDateString('fr-GN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {new Date(lastSale.date).toLocaleTimeString('fr-GN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>

          <div className="space-y-3 mb-5">
            {lastSale.items.map(item => (
              <div key={item.product.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-gray-900 dark:text-white flex-1 font-semibold">{item.product.name}</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{formatCurrency(item.product.price * item.quantity)}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {item.quantity} × {formatCurrency(item.product.price)}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-5 mb-5 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-900 dark:text-white font-semibold text-xl">Total</span>
              <span className="text-3xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(lastSale.total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-3 border-t border-emerald-200 dark:border-emerald-700">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Paiement</span>
              <span className="text-gray-900 dark:text-white font-semibold capitalize">
                {lastSale.paymentMethod === 'orange-money' ? 'Orange Money' : 'Espèces'}
              </span>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-gray-700 rounded-lg py-3">
            Ticket #{lastSale.id}
          </div>
        </Card>

        <Button
          onClick={handleNewSale}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-lg active:scale-95 transition-all"
        >
          Nouvelle vente
        </Button>
      </div>
    );
  }

  return null;
}