'use client';

import { useState, FormEvent, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileBottomSheet } from '@/components/ui/MobileBottomSheet';
import { MobileSearchBar } from '@/components/ui/MobileSearchBar';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { cn } from '@/lib/client/utils';
import { formatCurrency, formatDate, generateId } from '@/lib/shared/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  Calendar,
  Save,
  Building2,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react';
import type { Product, SupplierOrderItem, ProductSupplier } from '@/lib/shared/types';

interface OrderItem {
  id?: string; // Temporary ID for items not yet saved
  product_id?: string; // UUID migration: string ID
  product_name: string;
  category?: string; // Category for new products (stored for creation during delivery)
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  isNewProduct?: boolean; // True if this is a new product not in catalog
}

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

// Helper to generate readable order number
function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CMD-${dateStr}-${random}`;
}

function NewOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { currentUser } = useAuthStore();

  // Use currentUser from store, fallback to session user
  const activeUser = currentUser || (session?.user ? {
    id: session.user.id,
    name: session.user.name || 'Utilisateur',
    role: session.user.role || 'EMPLOYEE'
  } : null);

  const preselectedSupplierId = searchParams.get('supplierId');

  const [supplierId, setSupplierId] = useState(preselectedSupplierId || '');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order items state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Product selection state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  // New product form state
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState(CATEGORIES[0]);
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductUnitPrice, setNewProductUnitPrice] = useState('');

  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? [];
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const productSuppliers = useLiveQuery(() => db.product_suppliers.toArray()) ?? [];
  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  // Get products linked to selected supplier
  // If no products are linked yet, show all products (allows ordering before links are set up)
  const supplierProducts = useMemo(() => {
    if (!selectedSupplier) return products;
    const linkedProductIds = productSuppliers
      .filter(ps => ps.supplier_id === selectedSupplier.id)
      .map(ps => ps.product_id);
    // If no products linked to this supplier, show all products
    if (linkedProductIds.length === 0) return products;
    return products.filter(p => linkedProductIds.includes(p.id!));
  }, [products, productSuppliers, selectedSupplier]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    const query = productSearchQuery.toLowerCase().trim();
    const productsToSearch = supplierProducts;

    return productsToSearch
      .filter((product) => {
        // Category filter
        if (selectedCategory !== 'Tous' && product.category !== selectedCategory) {
          return false;
        }
        // Search filter
        if (query) {
          return product.name.toLowerCase().includes(query) ||
            product.category.toLowerCase().includes(query);
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productSearchQuery, selectedCategory, products, supplierProducts, selectedSupplier]);

  // Auth is handled by AuthGuard wrapper - no need for duplicate check here

  // Calculate due date based on supplier payment terms
  const calculateDueDate = () => {
    if (!selectedSupplier || !orderDate) return null;
    const order = new Date(orderDate);
    order.setDate(order.getDate() + selectedSupplier.paymentTermsDays);
    return order;
  };

  const dueDate = calculateDueDate();

  // Calculate total from order items
  const calculatedTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [orderItems]);

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    // Get last price from supplier if available
    const productSupplier = productSuppliers.find(
      ps => ps.product_id === product.id && ps.supplier_id === supplierId
    );
    setUnitPrice(productSupplier?.default_price || product.priceBuy || product.price);
    setQuantity(1);
  };

  // Handle add product to order
  const handleAddProduct = () => {
    if (!selectedProduct) return;

    const item: OrderItem = {
      id: `temp-${Date.now()}`,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity,
      unit_price: unitPrice,
      subtotal: quantity * unitPrice,
    };

    setOrderItems([...orderItems, item]);
    handleCloseProductSelector();
  };

  // Handle add new product to order
  const handleAddNewProduct = () => {
    if (!newProductName.trim() || !newProductUnitPrice) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    const price = parseInt(newProductUnitPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Prix invalide');
      return;
    }

    const item: OrderItem = {
      id: `temp-${Date.now()}`,
      product_name: newProductName.trim(),
      category: newProductCategory,
      quantity: newProductQuantity,
      unit_price: price,
      subtotal: newProductQuantity * price,
      isNewProduct: true,
    };

    setOrderItems([...orderItems, item]);
    handleCloseNewProductForm();
  };

  // Handle edit item
  const handleEditItem = (itemId: string) => {
    const item = orderItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.product_id) {
      // Existing product
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        setSelectedProduct(product);
        setQuantity(item.quantity);
        setUnitPrice(item.unit_price);
        setEditingItemId(itemId);
        setShowProductSelector(true);
      }
    } else {
      // New product - edit inline
      setNewProductName(item.product_name);
      setNewProductQuantity(item.quantity);
      setNewProductUnitPrice(item.unit_price.toString());
      setEditingItemId(itemId);
      setShowNewProductForm(true);
    }
  };

  // Handle update edited item
  const handleUpdateItem = () => {
    if (!selectedProduct || !editingItemId) return;

    setOrderItems(orderItems.map(item => {
      if (item.id === editingItemId) {
        return {
          ...item,
          quantity,
          unit_price: unitPrice,
          subtotal: quantity * unitPrice,
        };
      }
      return item;
    }));

    handleCloseProductSelector();
  };

  // Handle update new product item
  const handleUpdateNewProductItem = () => {
    if (!editingItemId || !newProductName.trim() || !newProductUnitPrice) return;

    const price = parseInt(newProductUnitPrice);
    if (isNaN(price) || price <= 0) return;

    setOrderItems(orderItems.map(item => {
      if (item.id === editingItemId) {
        return {
          ...item,
          product_name: newProductName.trim(),
          quantity: newProductQuantity,
          unit_price: price,
          subtotal: newProductQuantity * price,
        };
      }
      return item;
    }));

    handleCloseNewProductForm();
  };

  // Handle remove item
  const handleRemoveItem = (itemId: string) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId));
    toast.success('Produit retiré de la commande');
  };

  // Close product selector and reset
  const handleCloseProductSelector = () => {
    setShowProductSelector(false);
    setProductSearchQuery('');
    setSelectedCategory('Tous');
    setSelectedProduct(null);
    setQuantity(1);
    setUnitPrice(0);
    setEditingItemId(null);
  };

  // Close new product form and reset
  const handleCloseNewProductForm = () => {
    setShowNewProductForm(false);
    setNewProductName('');
    setNewProductCategory(CATEGORIES[0]);
    setNewProductQuantity(1);
    setNewProductUnitPrice('');
    setEditingItemId(null);
  };

  // Handle submit order
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (orderItems.length === 0) {
      toast.error('Veuillez ajouter au moins un produit à la commande');
      return;
    }

    // Debug logging
    console.log('Validation check:', {
      supplierId,
      orderDate,
      activeUser,
      dueDate,
      selectedSupplier
    });

    if (!supplierId || !orderDate || !activeUser) {
      if (!supplierId) {
        toast.error('Veuillez sélectionner un fournisseur');
      } else if (!orderDate) {
        toast.error('Veuillez sélectionner une date de commande');
      } else if (!activeUser) {
        toast.error('Session utilisateur non valide');
      }
      return;
    }

    if (!dueDate) {
      toast.error('Erreur de calcul de la date d\'échéance');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create order with UUID and readable order number
      const orderId = generateId();
      const orderNumber = generateOrderNumber();
      await db.supplier_orders.add({
        id: orderId,
        orderNumber: orderNumber,
        supplierId: supplierId,
        type: 'ORDER',
        orderDate: new Date(orderDate),
        deliveryDate: undefined,
        totalAmount: calculatedTotal, // Keep for backward compatibility
        calculatedTotal: calculatedTotal,
        amountPaid: 0,
        dueDate: dueDate,
        status: 'ORDERED',
        paymentStatus: 'UNPAID',
        notes: notes.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false,
      });

      // Create order items
      for (const item of orderItems) {
        const itemId = generateId();
        await db.supplier_order_items.add({
          id: itemId,
          order_id: orderId,
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category, // Store category for new product creation during delivery
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          notes: item.notes,
          synced: false,
        });
      }

      // Queue for sync
      await queueTransaction('SUPPLIER_ORDER', 'CREATE', {
        id: orderId,
        supplierId: supplierId,
        orderDate: new Date(orderDate),
        deliveryDate: undefined,
        totalAmount: calculatedTotal,
        calculatedTotal: calculatedTotal,
        amountPaid: 0,
        dueDate: dueDate,
        status: 'ORDERED',
        notes: notes.trim() || undefined,
      });

      toast.success(`Commande ${orderNumber} créée avec succès`);
      router.push(`/fournisseurs/${supplierId}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth is handled by AuthGuard - no loading/redirect check needed here

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Nouvelle commande</h1>
            <p className="text-sm text-slate-400">Enregistrer une commande fournisseur</p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Supplier Selection */}
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
            Fournisseur
          </h3>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Sélectionner le fournisseur *
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
                  Délai de paiement: <span className="font-semibold text-white">{selectedSupplier.paymentTermsDays} jours</span>
                </p>
                {selectedSupplier.phone && (
                  <p className="text-sm text-slate-400 mt-1">
                    Téléphone: <span className="text-white">{selectedSupplier.phone}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Produits ({orderItems.length})
            </h3>
            <Button
              type="button"
              onClick={() => setShowProductSelector(true)}
              disabled={!supplierId}
              className="h-12 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>

          {orderItems.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-1">Aucun produit ajouté</p>
              <p className="text-sm text-slate-500">Ajoutez des produits à votre commande</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-semibold text-white truncate">
                          {item.product_name}
                        </h4>
                        {item.isNewProduct && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded">
                            Nouveau
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">
                        {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.subtotal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        type="button"
                        onClick={() => handleEditItem(item.id!)}
                        className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors active:scale-95"
                        aria-label="Modifier"
                      >
                        <Edit3 className="w-4 h-4 text-slate-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id!)}
                        className="w-10 h-10 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors active:scale-95"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          {orderItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-slate-300">Total</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(calculatedTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
            Détails de la commande
          </h3>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Date de commande *
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <Calendar className="w-5 h-5" />
              </div>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-14 pl-12 bg-slate-800 border-slate-700 text-white rounded-xl"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Commande mensuelle, livraison par camion..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Payment Terms Summary */}
        {dueDate && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-400 mb-1">
                  Date d'échéance calculée
                </p>
                <p className="text-2xl font-bold text-white mb-2">
                  {formatDate(dueDate)}
                </p>
                <p className="text-xs text-slate-400">
                  Paiement à effectuer dans <span className="font-semibold text-white">{selectedSupplier?.paymentTermsDays} jours</span> après la commande
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <form onSubmit={handleSubmit} className="pt-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1 h-14 text-base bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl active:scale-95"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !supplierId || orderItems.length === 0}
              className="flex-1 h-14 text-base bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Commander
                </span>
              )}
            </Button>
          </div>
        </form>
      </main>

      {/* Product Selector Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showProductSelector}
        onClose={handleCloseProductSelector}
        title={editingItemId ? 'Modifier le produit' : 'Sélectionner un produit'}
        footer={
          selectedProduct ? (
            <div className="space-y-3">
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Prix unitaire</p>
                <Input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseInt(e.target.value) || 0)}
                  className="h-12 bg-slate-800 border-slate-700 text-white text-lg font-semibold"
                  min="0"
                  step="1000"
                />
              </div>
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                unitPrice={unitPrice}
                min={1}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseProductSelector}
                  className="flex-1 h-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={editingItemId ? handleUpdateItem : handleAddProduct}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {editingItemId ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setShowProductSelector(false);
                setShowNewProductForm(true);
              }}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              Créer un nouveau produit
            </Button>
          )
        }
      >
        <div className="p-4 space-y-4">
          {/* Search Bar */}
          <MobileSearchBar
            value={productSearchQuery}
            onChange={setProductSearchQuery}
            placeholder="Rechercher un produit..."
          />

          {/* Category Filter - Horizontal Scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('Tous')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-sm whitespace-nowrap transition-all font-medium min-h-[40px]',
                selectedCategory === 'Tous'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              Tous
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-sm whitespace-nowrap transition-all font-medium min-h-[40px]',
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {selectedSupplier && (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
              <Building2 className="w-4 h-4 text-emerald-500" />
              <span>Produits de <span className="text-white font-medium">{selectedSupplier.name}</span></span>
            </div>
          )}

          {/* Product List */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-1">Aucun produit trouvé</p>
                {selectedCategory !== 'Tous' && (
                  <p className="text-sm text-slate-500">
                    Essayez de changer la catégorie ou la recherche
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 font-medium">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
                </p>
                {filteredProducts.map((product) => {
                  const productSupplier = productSuppliers.find(
                    ps => ps.product_id === product.id && ps.supplier_id === supplierId
                  );
                  const lastPrice = productSupplier?.default_price;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProduct(product)}
                      className={cn(
                        'w-full p-4 bg-slate-800 rounded-xl border text-left transition-all active:scale-95',
                        selectedProduct?.id === product.id
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-white mb-1 truncate">
                            {product.name}
                          </h4>
                          <span className="inline-block px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded mb-2">
                            {product.category}
                          </span>
                          {lastPrice && (
                            <p className="text-xs text-emerald-400 mt-1">
                              Dernier prix: {formatCurrency(lastPrice)}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-lg font-bold text-white mb-1">
                            {formatCurrency(product.priceBuy || product.price)}
                          </p>
                          <div className={cn(
                            'text-xs font-semibold px-2 py-1 rounded',
                            product.stock <= product.minStock
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          )}>
                            Stock: {product.stock}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </MobileBottomSheet>

      {/* New Product Form Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showNewProductForm}
        onClose={handleCloseNewProductForm}
        title={editingItemId ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
        footer={
          <div className="space-y-3">
            {/* Subtotal Preview */}
            {newProductUnitPrice && newProductQuantity > 0 && (
              <div className="flex items-center justify-between bg-slate-800 rounded-xl p-4">
                <span className="text-slate-400">Sous-total</span>
                <span className="text-xl font-bold text-emerald-400">
                  {formatCurrency((parseInt(newProductUnitPrice) || 0) * newProductQuantity)}
                </span>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseNewProductForm}
                className="flex-1 h-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={editingItemId ? handleUpdateNewProductItem : handleAddNewProduct}
                disabled={!newProductName.trim() || !newProductUnitPrice}
                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 rounded-xl"
              >
                {editingItemId ? 'Modifier' : 'Ajouter à la commande'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="p-4 space-y-5">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-300">
              Ce produit sera ajouté à l'inventaire lors de la réception de la commande.
            </p>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Nom du produit <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Ex: Amoxicilline 500mg"
              className="h-14 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base focus:border-emerald-500 focus:ring-emerald-500/20"
              autoFocus
            />
          </div>

          {/* Category - Horizontal Scroll Chips */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Catégorie
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewProductCategory(cat)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all font-medium min-h-[44px]',
                    newProductCategory === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price and Quantity Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Prix unitaire <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={newProductUnitPrice}
                  onChange={(e) => setNewProductUnitPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="h-14 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-lg font-semibold pr-16 focus:border-emerald-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                  GNF
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Quantité
              </label>
              <div className="flex items-center h-14 bg-slate-800 border border-slate-700 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewProductQuantity(Math.max(1, newProductQuantity - 1))}
                  className="w-14 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-l-xl transition-colors"
                >
                  <span className="text-2xl font-light">−</span>
                </button>
                <span className="flex-1 text-center text-xl font-bold text-white">
                  {newProductQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setNewProductQuantity(newProductQuantity + 1)}
                  className="w-14 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-r-xl transition-colors"
                >
                  <span className="text-2xl font-light">+</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Quantity Buttons */}
          <div className="flex gap-2">
            {[5, 10, 20, 50, 100].map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => setNewProductQuantity(qty)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  newProductQuantity === qty
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                )}
              >
                {qty}
              </button>
            ))}
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </div>
    }>
      <NewOrderPageContent />
    </Suspense>
  );
}
