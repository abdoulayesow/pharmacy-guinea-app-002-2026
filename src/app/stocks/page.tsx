'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { queueTransaction } from '@/lib/client/sync';
import { cn } from '@/lib/client/utils';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Package,
  Plus,
  Search,
  Clock,
  X,
  TrendingUp,
  TrendingDown,
  Edit3,
  AlertCircle,
} from 'lucide-react';
import type { Product, StockMovementType } from '@/lib/shared/types';
import { getExpirationStatus, getExpirationSummary, sortByExpirationDate } from '@/lib/client/expiration';

const CATEGORIES = [
  'Antidouleur',
  'Antibiotique',
  'Vitamines',
  'Diabète',
  'Gastro',
  'Cardiovasculaire',
  'Respiratoire',
  'Autre',
];

const MOVEMENT_TYPES: { value: StockMovementType; label: string }[] = [
  { value: 'INVENTORY', label: 'Inventaire' },
  { value: 'RECEIPT', label: 'Réception' },
  { value: 'ADJUSTMENT', label: 'Ajustement' },
  { value: 'DAMAGED', label: 'Avarie' },
  { value: 'EXPIRED', label: 'Périmé' },
];

export default function StocksPage() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuthStore();
  const { updatePendingCount } = useSyncStore();
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'alerts' | 'expiring'>('all'); // 🆕
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Stock adjustment modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<StockMovementType>('ADJUSTMENT');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isAddingStock, setIsAddingStock] = useState(true); // true = add, false = remove

  // Form states - Add/Edit Product
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [expirationDate, setExpirationDate] = useState(''); // 🆕
  const [lotNumber, setLotNumber] = useState(''); // 🆕

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Get products from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'Tous' ||
      product.category === selectedCategory;

    // 🆕 Apply filter by type (all, alerts, expiring)
    let matchesFilter = true;
    if (selectedFilter === 'alerts') {
      matchesFilter = product.stock <= product.minStock;
    } else if (selectedFilter === 'expiring') {
      if (!product.expirationDate) return false;
      const expInfo = getExpirationStatus(product.expirationDate);
      matchesFilter = expInfo.status === 'warning' || expInfo.status === 'critical' || expInfo.status === 'expired';
    }

    return matchesSearch && matchesCategory && matchesFilter;
  });

  // Calculate stats
  const lowStockCount = products.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const expirationSummary = getExpirationSummary(products); // 🆕

  // Stock level indicator - red (zero), gray (low), emerald (good)
  const getStockLevel = (product: Product) => {
    if (product.stock === 0) {
      return { level: 'zero', color: 'bg-red-500', label: 'Rupture' };
    }
    if (product.stock <= product.minStock) {
      return { level: 'low', color: 'bg-gray-500', label: 'Faible' };
    }
    return { level: 'good', color: 'bg-emerald-500', label: 'Bon' };
  };

  // Open add modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
    resetProductForm();
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setMinStock(product.minStock.toString());
    setExpirationDate(product.expirationDate ? new Date(product.expirationDate).toISOString().split('T')[0] : ''); // 🆕
    setLotNumber(product.lotNumber || ''); // 🆕
    setShowAddModal(true);
  };

  // Reset product form
  const resetProductForm = () => {
    setName('');
    setCategory(CATEGORIES[0]);
    setPrice('');
    setStock('');
    setMinStock('');
    setExpirationDate(''); // 🆕
    setLotNumber(''); // 🆕
  };

  // Submit add/edit product
  const handleSubmitProduct = async (e: FormEvent) => {
    e.preventDefault();

    const productData = {
      name,
      category,
      price: parseInt(price),
      priceBuy: parseInt(price), // Use same price for buy/sell for now
      stock: parseInt(stock),
      minStock: parseInt(minStock),
      expirationDate: expirationDate ? new Date(expirationDate) : undefined, // 🆕
      lotNumber: lotNumber.trim() || undefined, // 🆕
      synced: false,
      updatedAt: new Date(),
    };

    if (editingProduct) {
      // Update existing product
      await db.products.update(editingProduct.id!, productData);

      // Queue product update for sync
      await queueTransaction('PRODUCT', 'UPDATE', {
        ...productData,
        id: editingProduct.id,
      });
    } else {
      // Add new product
      const id = await db.products.add(productData);

      // Queue product creation for sync
      await queueTransaction('PRODUCT', 'CREATE', {
        ...productData,
        id,
      });
    }

    await updatePendingCount();
    setShowAddModal(false);
    resetProductForm();
  };

  // Open stock adjustment modal
  const handleOpenAdjustment = (product: Product) => {
    setAdjustingProduct(product);
    setAdjustmentType('ADJUSTMENT');
    setAdjustmentQuantity('');
    setAdjustmentReason('');
    setIsAddingStock(true);
    setShowAdjustModal(true);
  };

  // Reset adjustment form
  const resetAdjustmentForm = () => {
    setAdjustingProduct(null);
    setAdjustmentType('ADJUSTMENT');
    setAdjustmentQuantity('');
    setAdjustmentReason('');
    setIsAddingStock(true);
  };

  // Submit stock adjustment
  const handleSubmitAdjustment = async (e: FormEvent) => {
    e.preventDefault();

    if (!adjustingProduct || !currentUser) return;

    const quantity = parseInt(adjustmentQuantity);
    if (isNaN(quantity) || quantity <= 0) return;

    // Calculate quantity change (positive for add, negative for remove)
    const quantityChange = isAddingStock ? quantity : -quantity;
    const newStock = adjustingProduct.stock + quantityChange;

    // Prevent negative stock
    if (newStock < 0) {
      alert('Le stock ne peut pas être négatif');
      return;
    }

    // 1. Create stock movement record
    const movement = {
      product_id: adjustingProduct.id!,
      type: adjustmentType,
      quantity_change: quantityChange,
      reason: adjustmentReason.trim(),
      created_at: new Date(),
      user_id: currentUser.id,
      synced: false,
    };

    const movementId = await db.stock_movements.add(movement);

    // 2. Update product stock
    await db.products.update(adjustingProduct.id!, {
      stock: newStock,
      synced: false,
      updatedAt: new Date(),
    });

    // 3. Queue stock movement for sync
    await queueTransaction('STOCK_MOVEMENT', 'CREATE', {
      ...movement,
      id: movementId,
    });

    // 4. Queue product update for sync
    await queueTransaction('PRODUCT', 'UPDATE', {
      id: adjustingProduct.id,
      stock: newStock,
      synced: false,
      updatedAt: new Date(),
    });

    await updatePendingCount();
    setShowAdjustModal(false);
    resetAdjustmentForm();
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Header Card - Dark Theme */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-4 border border-slate-700">
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-white text-lg font-bold">Stock</h2>
              </div>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg h-10 px-3 font-semibold text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
              Nouveau produit
            </Button>
          </div>

          {/* Search Bar - Dark Theme */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-10 bg-slate-950 border-slate-700 focus:border-emerald-500 rounded-lg text-white placeholder:text-slate-500"
            />
          </div>

          {/* Category Filter Tabs - Horizontal Scroll */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('Tous')}
              className={cn(
                'px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all font-medium min-h-[44px]',
                selectedCategory === 'Tous'
                  ? 'bg-slate-700 text-white'
                  : 'bg-transparent text-slate-400 hover:bg-slate-950'
              )}
            >
              Tous
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all font-medium min-h-[44px]',
                  selectedCategory === cat
                    ? 'bg-slate-700 text-white'
                    : 'bg-transparent text-slate-400 hover:bg-slate-950'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Tabs - All / Stock Alerts / Expiration */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={cn(
              'flex-1 h-10 rounded-lg font-semibold text-xs transition-all',
              selectedFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            Tous
          </button>
          <button
            onClick={() => setSelectedFilter('alerts')}
            className={cn(
              'flex-1 h-10 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2',
              selectedFilter === 'alerts'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            <Clock className="w-4 h-4" />
            Alertes
            {lowStockCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {lowStockCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedFilter('expiring')}
            className={cn(
              'flex-1 h-10 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2',
              selectedFilter === 'expiring'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-700'
            )}
          >
            <AlertCircle className="w-4 h-4" />
            Péremption
            {expirationSummary.total > 0 && (
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                expirationSummary.expired > 0 || expirationSummary.critical > 0
                  ? 'bg-red-500 text-white'
                  : 'bg-amber-500 text-white'
              )}>
                {expirationSummary.total}
              </span>
            )}
          </button>
        </div>

        {/* Product List - Simplified Dark Theme */}
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="py-20 text-center">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-white font-semibold mb-1">Aucun produit trouvé</p>
              <p className="text-sm text-slate-400">
                {selectedCategory !== 'Tous' ? 'pour cette catégorie' : 'dans l\'inventaire'}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const stockInfo = getStockLevel(product);
              const expirationInfo = getExpirationStatus(product.expirationDate); // 🆕

              return (
                <div
                  key={product.id}
                  className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-3 border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white mb-1 truncate">
                        {product.name}
                      </h3>
                      <p className="text-sm text-slate-400 mb-2">{product.category}</p>

                      {/* 🆕 Expiration Badge */}
                      {product.expirationDate && (
                        <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mb-2', expirationInfo.bgColor, expirationInfo.color)}>
                          <Clock className="w-3.5 h-3.5" />
                          {expirationInfo.label}
                        </div>
                      )}

                      <p className="text-xl font-bold text-emerald-500">
                        {formatCurrency(product.price)}
                      </p>
                    </div>

                    {/* Stock Badge - with red for zero stock */}
                    <div className="text-right ml-3 shrink-0">
                      <div
                        className={cn(
                          'px-3 py-1.5 rounded-lg font-bold text-base text-white',
                          stockInfo.color
                        )}
                      >
                        {product.stock}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Min: {product.minStock}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOpenEdit(product)}
                      variant="outline"
                      className="flex-1 h-10 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-950 hover:text-white text-sm"
                    >
                      <Edit3 className="w-4 h-4 mr-1.5" />
                      Modifier
                    </Button>
                    <Button
                      onClick={() => handleOpenAdjustment(product)}
                      className="flex-1 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold"
                    >
                      <TrendingUp className="w-4 h-4 mr-1.5" />
                      Ajuster stock
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto border-t border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white font-bold text-xl">
                  {editingProduct ? 'Modifier produit' : 'Nouveau produit'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetProductForm();
                }}
                className="text-slate-400 hover:text-white w-10 h-10 rounded-lg hover:bg-slate-950 flex items-center justify-center transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Nom du produit *
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Paracétamol 500mg"
                  className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Catégorie *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:border-emerald-500 transition-all"
                  required
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Prix unitaire (GNF) *
                </label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                  required
                />
              </div>

              {/* Stock Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Stock actuel *
                  </label>
                  <Input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Stock minimum *
                  </label>
                  <Input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder="0"
                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* 🆕 Expiration Date & Lot Number */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-white mb-3">Informations de péremption (optionnel)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Date d&apos;expiration
                    </label>
                    <Input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="h-12 bg-slate-950 border-slate-700 text-white rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Numéro de lot
                    </label>
                    <Input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="LOT-2024-001"
                      className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  💡 La date d&apos;expiration permettra de suivre les produits périmés et d&apos;envoyer des alertes
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    resetProductForm();
                  }}
                  className="flex-1 h-12 rounded-lg border border-slate-700 text-white hover:bg-slate-950"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                >
                  {editingProduct ? 'Modifier' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && adjustingProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto border-t border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white font-bold text-xl">Ajuster le stock</h3>
                <p className="text-slate-400 text-sm mt-1">{adjustingProduct.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  resetAdjustmentForm();
                }}
                className="text-slate-400 hover:text-white w-10 h-10 rounded-lg hover:bg-slate-950 flex items-center justify-center transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-5">
              {/* Current Stock Display */}
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Stock actuel</p>
                <p className="text-white text-2xl font-bold">{adjustingProduct.stock} unités</p>
              </div>

              {/* Add or Remove Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingStock(true)}
                  className={cn(
                    'h-14 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
                    isAddingStock
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-700'
                  )}
                >
                  <TrendingUp className="w-5 h-5" />
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingStock(false)}
                  className={cn(
                    'h-14 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2',
                    !isAddingStock
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-700'
                  )}
                >
                  <TrendingDown className="w-5 h-5" />
                  Retirer
                </button>
              </div>

              {/* Movement Type */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Type de mouvement *
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as StockMovementType)}
                  className="w-full h-12 px-3.5 rounded-lg border border-slate-700 bg-slate-950 text-white focus:border-emerald-500 transition-all"
                  required
                >
                  {MOVEMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Quantité *
                </label>
                <Input
                  type="number"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(e.target.value)}
                  placeholder="0"
                  min="1"
                  className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Raison / Commentaire *
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Ex: Réception fournisseur, Inventaire, Produit périmé..."
                  rows={3}
                  className="w-full px-3.5 py-3 rounded-lg border border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-emerald-500 transition-all resize-none"
                  required
                />
              </div>

              {/* Preview New Stock */}
              {adjustmentQuantity && (
                <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-sm mb-1">Nouveau stock</p>
                  <p className="text-white text-2xl font-bold">
                    {adjustingProduct.stock + (isAddingStock ? 1 : -1) * parseInt(adjustmentQuantity || '0')} unités
                  </p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAdjustModal(false);
                    resetAdjustmentForm();
                  }}
                  className="flex-1 h-12 rounded-lg border border-slate-700 text-white hover:bg-slate-950"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    'flex-1 h-12 rounded-lg text-white font-semibold',
                    isAddingStock
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-red-500 hover:bg-red-600'
                  )}
                >
                  {isAddingStock ? 'Ajouter' : 'Retirer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
