/**
 * ProductSearch Component - Modal for adding products during sale editing
 *
 * Features:
 * - Product search with autocomplete
 * - Display name, price, and available stock
 * - Quantity input with stock validation
 * - Add to sale functionality
 */

'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// Using simple modal pattern instead of Dialog component
import { formatCurrency } from '@/lib/shared/utils';
import { Search, Package, Minus, Plus, X } from 'lucide-react';
import type { Product } from '@/lib/shared/types';

interface ProductSearchProps {
  open: boolean;
  onClose: () => void;
  onAddProduct: (product: Product, quantity: number) => void;
  excludeProductIds?: number[]; // Products already in the sale
}

export function ProductSearch({
  open,
  onClose,
  onAddProduct,
  excludeProductIds = [],
}: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Query all products
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      // Show all products when no search (sorted by name)
      return products
        .filter((p) => !excludeProductIds.includes(p.id!))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Fuzzy search by name or category
    return products
      .filter((p) => !excludeProductIds.includes(p.id!))
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchQuery, excludeProductIds]);

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return;
    if (selectedProduct && newQuantity > selectedProduct.stock) return;
    setQuantity(newQuantity);
  };

  // Handle add product
  const handleAddProduct = () => {
    if (!selectedProduct) return;
    onAddProduct(selectedProduct, quantity);
    handleClose();
  };

  // Handle close and reset
  const handleClose = () => {
    setSearchQuery('');
    setSelectedProduct(null);
    setQuantity(1);
    onClose();
  };

  // Get stock status color
  const getStockStatusColor = (product: Product) => {
    if (product.stock === 0) return 'text-red-500';
    if (product.stock <= product.minStock) return 'text-amber-500';
    return 'text-emerald-500';
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 animate-in fade-in duration-300 px-4"
      onClick={handleClose}
    >
      <div
        className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in duration-300 border-2 border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-emerald-500 p-5">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white w-10 h-10 rounded-lg hover:bg-emerald-700/50 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-2xl font-bold text-white pr-12">
            Ajouter un article
          </h2>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                autoFocus
                className="h-12 pl-10 bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-base"
              />
            </div>

            {/* Product list or selected product */}
            {!selectedProduct ? (
              <div className="max-h-96 overflow-y-auto">
                {filteredProducts.length > 0 ? (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        disabled={product.stock === 0}
                        className="w-full p-4 bg-slate-900/70 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Package className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              <span className="font-semibold text-white truncate">
                                {product.name}
                              </span>
                            </div>
                            <div className="text-sm text-slate-400">
                              {product.category}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-white mb-1">
                              {formatCurrency(product.price)}
                            </div>
                            <div className={`text-sm font-semibold ${getStockStatusColor(product)}`}>
                              {product.stock === 0 ? (
                                'Rupture'
                              ) : (
                                <>Stock: {product.stock}</>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    {searchQuery ? (
                      <p>Aucun produit trouvé pour "{searchQuery}"</p>
                    ) : (
                      <p>Aucun produit disponible</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selected product details */}
                <Card className="bg-slate-900 border-slate-700 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-5 w-5 text-emerald-500" />
                        <h3 className="text-xl font-bold text-white">
                          {selectedProduct.name}
                        </h3>
                      </div>
                      <div className="text-sm text-slate-400 mb-2">
                        {selectedProduct.category}
                      </div>
                      <div className="text-lg font-bold text-white">
                        {formatCurrency(selectedProduct.price)} / unité
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Stock disponible:</span>
                    <span className={`text-sm font-semibold ${getStockStatusColor(selectedProduct)}`}>
                      {selectedProduct.stock} unités
                    </span>
                  </div>
                </Card>

                {/* Quantity selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Quantité
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1}
                      className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-slate-700 transition-colors"
                    >
                      <Minus className="w-5 h-5 text-white" />
                    </button>

                    <Input
                      type="number"
                      min="1"
                      max={selectedProduct.stock}
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      className="flex-1 h-12 text-center text-2xl font-bold bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-xl"
                    />

                    <button
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={quantity >= selectedProduct.stock}
                      className="w-12 h-12 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
                    >
                      <Plus className="w-5 h-5 text-white" />
                    </button>
                  </div>

                  {quantity > selectedProduct.stock && (
                    <p className="text-sm text-red-400 mt-2">
                      Stock insuffisant (max: {selectedProduct.stock})
                    </p>
                  )}
                </div>

                {/* Subtotal */}
                <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-lg font-semibold text-white">Sous-total</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(selectedProduct.price * quantity)}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => setSelectedProduct(null)}
                    variant="outline"
                    className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 border-slate-700 text-white rounded-xl"
                  >
                    Retour
                  </Button>
                  <Button
                    onClick={handleAddProduct}
                    disabled={quantity > selectedProduct.stock || quantity < 1}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
                  >
                    Ajouter
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
