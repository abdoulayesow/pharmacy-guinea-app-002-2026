'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate, generateId } from '@/lib/shared/utils';
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
  PackagePlus,
  Calendar,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Product, StockMovementType, ProductBatch } from '@/lib/shared/types';
import { getExpirationStatus, getExpirationSummary, sortByExpirationDate } from '@/lib/client/expiration';
import { getExpirationAlertLevel } from '@/lib/client/db';
import { SubstituteLinkingSection } from '@/components/features/SubstituteLinkingSection';

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
  const { data: session, status: sessionStatus } = useSession();
  const { isAuthenticated, currentUser, isInactive, lastActivityAt } = useAuthStore();
  const { updatePendingCount } = useSyncStore();

  // Check if user is authenticated via Zustand OR via Google session + recently active
  const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;
  const isRecentlyActive = hasGoogleSession && lastActivityAt && !isInactive();
  const isFullyAuthenticated = isAuthenticated || isRecentlyActive;
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'alerts' | 'expiring'>('all'); // 🆕
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 🆕 Batch receipt modal states
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchLotNumber, setBatchLotNumber] = useState('');
  const [batchExpirationDate, setBatchExpirationDate] = useState('');
  const [batchQuantity, setBatchQuantity] = useState('');
  const [batchUnitCost, setBatchUnitCost] = useState('');

  // 🆕 Expanded batches state (track which products show batch details)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

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
    // Wait for session to load before checking auth
    if (sessionStatus === 'loading') return;

    if (!isFullyAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/stocks')}`);
    }
  }, [isFullyAuthenticated, sessionStatus, router]);

  // Show nothing while loading or redirecting
  if (sessionStatus === 'loading' || !isFullyAuthenticated) {
    return null;
  }

  // Get products from IndexedDB with calculated stock
  // Stock is calculated from UNSYNCED movements only to prevent concurrent update conflicts
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

  // 🆕 Get batches for all products
  const allBatches = useLiveQuery(() => db.product_batches.toArray()) ?? [];

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
      // Add new product with UUID
      const productId = generateId();
      const newProduct = { ...productData, id: productId };
      await db.products.add(newProduct);

      // Queue product creation for sync
      await queueTransaction('PRODUCT', 'CREATE', newProduct);
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

  // 🆕 Open batch receipt modal
  const handleOpenBatchReceipt = (productId: string) => {
    setBatchProductId(productId);
    setBatchLotNumber('');
    setBatchExpirationDate('');
    setBatchQuantity('');
    setBatchUnitCost('');
    setShowBatchModal(true);
  };

  // 🆕 Reset batch form
  const resetBatchForm = () => {
    setBatchProductId(null);
    setBatchLotNumber('');
    setBatchExpirationDate('');
    setBatchQuantity('');
    setBatchUnitCost('');
  };

  // 🆕 Submit batch receipt
  const handleSubmitBatch = async (e: FormEvent) => {
    e.preventDefault();

    if (!batchProductId || !currentUser) return;

    const quantity = parseInt(batchQuantity);
    const unitCost = parseInt(batchUnitCost);

    if (isNaN(quantity) || quantity <= 0) {
      alert('La quantité doit être supérieure à 0');
      return;
    }

    const expirationDate = new Date(batchExpirationDate);
    const now = new Date();

    if (expirationDate <= now) {
      alert('La date d\'expiration doit être dans le futur');
      return;
    }

    // 1. Create ProductBatch record with UUID
    const batchId = generateId();
    const batch = {
      id: batchId,
      product_id: batchProductId,
      lot_number: batchLotNumber.trim(),
      expiration_date: expirationDate,
      quantity,
      initial_qty: quantity,
      unit_cost: isNaN(unitCost) ? undefined : unitCost,
      received_date: now,
      createdAt: now,
      updatedAt: now,
      synced: false,
    };

    await db.product_batches.add(batch);

    // 2. Create stock movement for receipt with UUID
    const movementId = generateId();
    const movement = {
      id: movementId,
      product_id: batchProductId,
      type: 'RECEIPT' as StockMovementType,
      quantity_change: quantity,
      reason: `Réception lot ${batchLotNumber.trim()}`,
      created_at: now,
      user_id: currentUser.id,
      synced: false,
    };

    await db.stock_movements.add(movement);

    // 3. Update product stock
    const product = products.find(p => p.id === batchProductId);
    if (product) {
      const newStock = product.stock + quantity;
      await db.products.update(batchProductId, {
        stock: newStock,
        synced: false,
        updatedAt: now,
      });

      // 4. Queue for sync
      await queueTransaction('PRODUCT_BATCH', 'CREATE', batch);

      await queueTransaction('STOCK_MOVEMENT', 'CREATE', movement);

      await queueTransaction('PRODUCT', 'UPDATE', {
        id: batchProductId,
        stock: newStock,
        synced: false,
        updatedAt: now,
      });

      await updatePendingCount();
    }

    setShowBatchModal(false);
    resetBatchForm();
  };

  // 🆕 Toggle batch expansion
  const toggleBatchExpansion = (productId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // 🆕 Get batches for a product
  const getBatchesForProduct = (productId: string): ProductBatch[] => {
    return allBatches
      .filter(b => b.product_id === productId && b.quantity > 0)
      .sort((a, b) => {
        const dateA = a.expiration_date instanceof Date ? a.expiration_date : new Date(a.expiration_date);
        const dateB = b.expiration_date instanceof Date ? b.expiration_date : new Date(b.expiration_date);
        return dateA.getTime() - dateB.getTime();
      });
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

    // 1. Create stock movement record with UUID
    const movementId = generateId();
    const movement = {
      id: movementId,
      product_id: adjustingProduct.id!,
      type: adjustmentType,
      quantity_change: quantityChange,
      reason: adjustmentReason.trim(),
      created_at: new Date(),
      user_id: currentUser.id,
      synced: false,
    };

    await db.stock_movements.add(movement);

    // 2. Update product stock
    await db.products.update(adjustingProduct.id!, {
      stock: newStock,
      synced: false,
      updatedAt: new Date(),
    });

    // 3. Queue stock movement for sync
    await queueTransaction('STOCK_MOVEMENT', 'CREATE', movement);

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
{/* FAB moved to bottom of page */}
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

        {/* Filter Badges - All / Stock Alerts / Expiration */}
        <div className="flex flex-wrap gap-3">
          {/* All Filter Badge */}
          <button
            onClick={() => setSelectedFilter('all')}
            aria-label="Tous les produits"
            aria-pressed={selectedFilter === 'all'}
            className={cn(
              'relative min-h-12 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95',
              'flex items-center justify-center gap-2 shadow-sm',
              selectedFilter === 'all'
                ? 'bg-slate-700 text-white border-2 border-slate-600'
                : 'bg-slate-900/50 text-slate-300 border-2 border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
            )}
          >
            <span>Tous</span>
          </button>

          {/* Alerts Filter Badge */}
          <button
            onClick={() => setSelectedFilter('alerts')}
            aria-label={`Alertes de stock${lowStockCount > 0 ? ` (${lowStockCount})` : ''}`}
            aria-pressed={selectedFilter === 'alerts'}
            className={cn(
              'relative min-h-12 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95',
              'flex items-center justify-center gap-2 shadow-sm',
              selectedFilter === 'alerts'
                ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-500/50 ring-2 ring-yellow-500/20'
                : 'bg-slate-900/50 text-slate-300 border-2 border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-500/10'
            )}
          >
            <Clock className="w-4 h-4" />
            <span>Alertes</span>
            {lowStockCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-6 h-6 flex items-center justify-center px-1.5 rounded-full text-xs font-bold shadow-lg bg-red-500 text-white">
                {lowStockCount}
              </span>
            )}
          </button>

          {/* Expiration Filter Badge */}
          <button
            onClick={() => setSelectedFilter('expiring')}
            aria-label={`Alertes de péremption${expirationSummary.total > 0 ? ` (${expirationSummary.total})` : ''}`}
            aria-pressed={selectedFilter === 'expiring'}
            className={cn(
              'relative min-h-12 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95',
              'flex items-center justify-center gap-2 shadow-sm',
              expirationSummary.expired > 0 || expirationSummary.critical > 0
                ? selectedFilter === 'expiring'
                  ? 'bg-red-500/20 text-red-300 border-2 border-red-500/50 ring-2 ring-red-500/20'
                  : 'bg-slate-900/50 text-slate-300 border-2 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10'
                : selectedFilter === 'expiring'
                  ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-500/50 ring-2 ring-amber-500/20'
                  : 'bg-slate-900/50 text-slate-300 border-2 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10'
            )}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Péremption</span>
            {expirationSummary.total > 0 && (
              <span className={cn(
                'absolute -top-2 -right-2 min-w-6 h-6 flex items-center justify-center px-1.5 rounded-full text-xs font-bold shadow-lg',
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
              const productBatches = getBatchesForProduct(product.id!);
              const isExpanded = expandedBatches.has(product.id!);

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
                  <div className="flex gap-2 mb-2">
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

                  {/* 🆕 Batch Receipt Button */}
                  <Button
                    onClick={() => handleOpenBatchReceipt(product.id!)}
                    className="w-full h-10 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold mb-2"
                  >
                    <PackagePlus className="w-4 h-4 mr-1.5" />
                    Nouvelle réception
                  </Button>

                  {/* 🆕 Batch List Toggle */}
                  {productBatches.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleBatchExpansion(product.id!)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-700 hover:bg-slate-950 transition-all text-sm text-slate-300"
                      >
                        <span className="font-semibold flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Lots en stock ({productBatches.length})
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {/* 🆕 Expanded Batch Details */}
                      {isExpanded && (
                        <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          {productBatches.map((batch) => {
                            const alertLevel = getExpirationAlertLevel(batch.expiration_date);
                            const alertColors = {
                              critical: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-300' },
                              warning: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-300' },
                              notice: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-300' },
                              ok: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-300' },
                            };
                            const colors = alertColors[alertLevel];

                            return (
                              <div
                                key={batch.id}
                                className={cn(
                                  'p-3 rounded-lg border-2 transition-all',
                                  colors.bg,
                                  colors.border
                                )}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="text-sm font-bold text-white">
                                        {batch.lot_number}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                      <span className={cn('text-xs font-semibold', colors.text)}>
                                        Exp: {formatDate(batch.expiration_date)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className={cn('px-3 py-1 rounded-lg font-bold text-sm', colors.text, colors.bg)}>
                                    {batch.quantity} unités
                                  </div>
                                </div>
                                {batch.unit_cost && (
                                  <p className="text-xs text-slate-400">
                                    Coût unitaire: {formatCurrency(batch.unit_cost)}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
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
                  La date d&apos;expiration permettra de suivre les produits périmés et d&apos;envoyer des alertes
                </p>
              </div>

              {/* Substitute Linking Section - Only show when editing */}
              {editingProduct && editingProduct.id && (
                <SubstituteLinkingSection
                  productId={editingProduct.id}
                  productName={editingProduct.name}
                />
              )}

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

      {/* 🆕 Batch Receipt Modal */}
      {showBatchModal && batchProductId && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto border-t border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white font-bold text-xl">Nouvelle réception</h3>
                <p className="text-slate-400 text-sm mt-1">
                  {products.find(p => p.id === batchProductId)?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBatchModal(false);
                  resetBatchForm();
                }}
                className="text-slate-400 hover:text-white w-10 h-10 rounded-lg hover:bg-slate-950 flex items-center justify-center transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="space-y-4">
              {/* Lot Number */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  <Hash className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  Numéro de lot *
                </label>
                <Input
                  type="text"
                  value={batchLotNumber}
                  onChange={(e) => setBatchLotNumber(e.target.value)}
                  placeholder="Ex: LOT-2024-001"
                  className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg font-mono"
                  required
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Le numéro de lot permettra de tracer ce lot spécifique
                </p>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  <Calendar className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  Date d&apos;expiration *
                </label>
                <Input
                  type="date"
                  value={batchExpirationDate}
                  onChange={(e) => setBatchExpirationDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-12 bg-slate-950 border-slate-700 text-white rounded-lg"
                  required
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  La date d&apos;expiration doit être dans le futur
                </p>
              </div>

              {/* Quantity and Unit Cost Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    <Package className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    Quantité reçue *
                  </label>
                  <Input
                    type="number"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    placeholder="0"
                    min="1"
                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Coût unitaire (GNF)
                  </label>
                  <Input
                    type="number"
                    value={batchUnitCost}
                    onChange={(e) => setBatchUnitCost(e.target.value)}
                    placeholder="0"
                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg"
                  />
                </div>
              </div>

              {/* Info Box - FEFO Explanation */}
              <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <PackagePlus className="w-4 h-4 text-purple-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-purple-300 mb-1">
                      Gestion automatique FEFO
                    </h4>
                    <p className="text-xs text-purple-200/80 leading-relaxed">
                      Les lots avec les dates d&apos;expiration les plus proches seront vendus en premier automatiquement (First Expired First Out).
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBatchModal(false);
                    resetBatchForm();
                  }}
                  className="flex-1 h-12 rounded-lg border border-slate-700 text-white hover:bg-slate-950"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  <PackagePlus className="w-4 h-4 mr-1.5" />
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAB - Add Product */}
      <button
        onClick={handleOpenAdd}
        className="fixed right-4 bottom-24 w-14 h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 ring-4 ring-purple-500/20 hover:ring-8"
        aria-label="Ajouter un produit"
      >
        <Plus className="w-7 h-7" />
      </button>

      <Navigation />
    </div>
  );
}
