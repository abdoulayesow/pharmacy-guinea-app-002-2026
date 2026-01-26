'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileBottomSheet } from '@/components/ui/MobileBottomSheet';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { cn } from '@/lib/client/utils';
import { formatCurrency, formatDate, generateId } from '@/lib/shared/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  Calendar,
  DollarSign,
  Truck,
  CheckCircle2,
  Edit3,
  X,
  AlertCircle,
  Clock,
  Building2,
  Loader2,
} from 'lucide-react';
import type { SupplierOrder, SupplierOrderItem, Product, ProductSupplier, StockMovement } from '@/lib/shared/types';
import { OrderDetailSkeleton } from '@/components/ui/Skeleton';

interface DeliveryItem {
  orderItemId: string; // UUID migration: string ID
  productId?: string; // UUID migration: string ID
  productName: string;
  category?: string; // Category for new products (from order item)
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  expirationDate?: string;
  lotNumber?: string;
  isNewProduct: boolean;
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

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const { isAuthenticated, currentUser } = useAuthStore();
  const orderId = params.id as string;

  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Get order data
  const order = useLiveQuery(
    () => db.supplier_orders.get(orderId),
    [orderId]
  );
  const orderItems = useLiveQuery(
    () => db.supplier_order_items.where('order_id').equals(orderId).toArray(),
    [orderId]
  ) ?? [];
  const supplier = useLiveQuery(
    () => order ? db.suppliers.get(order.supplierId) : undefined,
    [order]
  );
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const productSuppliers = useLiveQuery(() => db.product_suppliers.toArray()) ?? [];

  // Redirect if not authenticated (check both OAuth session and Zustand store)
  useEffect(() => {
    if (status === 'loading') return;
    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/fournisseurs/commande/${orderId}`)}`);
    }
  }, [isAuthenticated, session, status, router, orderId]);

  // Calculate totals
  const orderTotal = useMemo(() => {
    if (order?.calculatedTotal !== undefined) {
      return order.calculatedTotal;
    }
    return orderItems.reduce((sum, item) => sum + item.subtotal, 0) || order?.totalAmount || 0;
  }, [order, orderItems]);

  const balance = orderTotal - (order?.amountPaid || 0);

  // Get payment status
  const getPaymentStatus = (): 'overdue' | 'urgent' | 'upcoming' | 'paid' => {
    if (!order || order.paymentStatus === 'PAID') return 'paid';
    if (balance === 0) return 'paid';

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(order.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'urgent';
    return 'upcoming';
  };

  const paymentStatus = getPaymentStatus();

  // Get status config based on order lifecycle and payment status
  const getStatusConfig = (order: SupplierOrder) => {
    switch (order.status) {
      case 'PENDING':
      case 'ORDERED':
        return {
          label: 'Commandé',
          icon: Package,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
        };
      case 'CANCELLED':
        return {
          label: 'Annulé',
          icon: Package,
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/10',
          borderColor: 'border-slate-500/30',
        };
      case 'DELIVERED':
        // For delivered orders, show payment status
        switch (order.paymentStatus) {
          case 'PAID':
            return {
              label: 'Payé',
              icon: CheckCircle2,
              color: 'text-emerald-400',
              bgColor: 'bg-emerald-500/10',
              borderColor: 'border-emerald-500/30',
            };
          case 'PARTIALLY_PAID':
            return {
              label: 'Partiellement payé',
              icon: DollarSign,
              color: 'text-amber-400',
              bgColor: 'bg-amber-500/10',
              borderColor: 'border-amber-500/30',
            };
          default:
            return {
              label: 'Livré',
              icon: Truck,
              color: 'text-purple-400',
              bgColor: 'bg-purple-500/10',
              borderColor: 'border-purple-500/30',
            };
        }
      default:
        return {
          label: 'En cours',
          icon: Package,
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/10',
          borderColor: 'border-slate-500/30',
        };
    }
  };

  // Initialize delivery items
  const initializeDeliveryItems = () => {
    const items: DeliveryItem[] = orderItems.map((item) => ({
      orderItemId: item.id!,
      productId: item.product_id,
      productName: item.product_name,
      category: item.category, // Include category for new product creation
      orderedQuantity: item.quantity,
      receivedQuantity: item.quantity, // Default to ordered quantity
      unitPrice: item.unit_price,
      isNewProduct: !item.product_id,
    }));
    setDeliveryItems(items);
    setCurrentDeliveryIndex(0);
    setShowDeliveryDialog(true);
  };

  // Generate lot number from product name and expiration date
  const generateLotNumber = (productName: string, expirationDate?: string) => {
    if (!expirationDate) return undefined;

    // Extract product code from product name (first letters of each word, max 6 chars)
    const words = productName.trim().split(/\s+/);
    let productCode = '';

    for (const word of words) {
      if (productCode.length >= 6) break;
      const cleanWord = word.replace(/[^a-zA-Z]/g, ''); // Remove non-letters
      if (cleanWord.length > 0) {
        productCode += cleanWord.substring(0, 1).toUpperCase();
      }
    }

    // If product code is too short, use more letters from first word
    if (productCode.length < 3 && words[0]) {
      const firstWord = words[0].replace(/[^a-zA-Z]/g, '');
      productCode = firstWord.substring(0, Math.min(5, firstWord.length)).toUpperCase();
    }

    // Format expiration date as MM-DD-YYYY
    const expDate = new Date(expirationDate);
    const month = String(expDate.getMonth() + 1).padStart(2, '0');
    const day = String(expDate.getDate()).padStart(2, '0');
    const year = expDate.getFullYear();

    return `${productCode}-LOT-${month}-${day}-${year}`;
  };

  // Calculate new total from received quantities
  const calculateNewTotal = useMemo(() => {
    return deliveryItems.reduce((sum, item) => {
      return sum + (item.receivedQuantity * item.unitPrice);
    }, 0);
  }, [deliveryItems]);

  // Handle delivery confirmation
  const handleConfirmDelivery = async () => {
    if (!order || !supplier || !currentUser) return;

    // Idempotency check: prevent duplicate delivery confirmation
    if (order.status === 'DELIVERED') {
      toast.error('Cette commande a déjà été confirmée comme livrée');
      return;
    }

    setIsProcessing(true);

    try {
      // Wrap all database operations in a transaction for atomicity
      await db.transaction(
        'rw',
        [db.products, db.supplier_order_items, db.product_suppliers, db.stock_movements, db.supplier_orders, db.product_batches, db.sync_queue],
        async () => {
          // Process each delivery item
          for (const deliveryItem of deliveryItems) {
            let productId = deliveryItem.productId;

            // If new product, create it (UUID migration: generate ID client-side)
            if (deliveryItem.isNewProduct || !productId) {
              const productCategory = deliveryItem.category || 'Autre'; // Use stored category or default
              const newProductId = generateId();
              const newProduct = {
                id: newProductId,
                name: deliveryItem.productName,
                category: productCategory,
                price: deliveryItem.unitPrice * 1.5, // Default markup
                priceBuy: deliveryItem.unitPrice,
                stock: deliveryItem.receivedQuantity,
                minStock: 10,
                synced: false,
                updatedAt: new Date(),
              };
              await db.products.add(newProduct);

              // Queue product creation for sync
              await queueTransaction('PRODUCT', 'CREATE', newProduct);

              productId = newProductId;

              // Update order item with product ID and received quantity
              await db.supplier_order_items.update(deliveryItem.orderItemId, {
                product_id: productId,
                quantityReceived: deliveryItem.receivedQuantity,
                subtotal: deliveryItem.receivedQuantity * deliveryItem.unitPrice,
                synced: false,
              });

              // Link product to supplier
              const existingLink = productSuppliers.find(
                ps => ps.product_id === productId! && ps.supplier_id === supplier.id!
              );

              if (!existingLink) {
                const productSupplierId = generateId();
                await db.product_suppliers.add({
                  id: productSupplierId, // UUID migration
                  product_id: productId!,
                  supplier_id: supplier.id!,
                  default_price: deliveryItem.unitPrice,
                  is_primary: false,
                  last_ordered_date: new Date(),
                  synced: false,
                });

                await queueTransaction('PRODUCT_SUPPLIER', 'CREATE', {
                  id: productSupplierId,
                  product_id: productId,
                  supplier_id: supplier.id!,
                  default_price: deliveryItem.unitPrice,
                  is_primary: false,
                  last_ordered_date: new Date(),
                });
              }

              // Queue product for sync
              await queueTransaction('PRODUCT', 'CREATE', {
                id: productId,
                name: deliveryItem.productName,
                category: productCategory,
                price: deliveryItem.unitPrice * 1.5,
                priceBuy: deliveryItem.unitPrice,
                stock: deliveryItem.receivedQuantity,
                minStock: 10,
              });

              // 🆕 CREATE PRODUCT BATCH for new product (FEFO Phase 3) - UUID migration
              const newProductBatchId = generateId();
              await db.product_batches.add({
                id: newProductBatchId,
                product_id: productId!,
                lot_number: deliveryItem.lotNumber || `LOT-${Date.now()}-${productId!}`,
                expiration_date: deliveryItem.expirationDate
                  ? new Date(deliveryItem.expirationDate)
                  : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default: 1 year from now
                quantity: deliveryItem.receivedQuantity,
                initial_qty: deliveryItem.receivedQuantity,
                unit_cost: deliveryItem.unitPrice,
                supplier_order_id: order.id,
                received_date: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                synced: false,
              });

              // Queue batch for sync
              await queueTransaction('PRODUCT_BATCH', 'CREATE', {
                id: newProductBatchId,
                product_id: productId!,
                lot_number: deliveryItem.lotNumber || `LOT-${Date.now()}-${productId!}`,
                expiration_date: deliveryItem.expirationDate
                  ? new Date(deliveryItem.expirationDate)
                  : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                quantity: deliveryItem.receivedQuantity,
                initial_qty: deliveryItem.receivedQuantity,
                unit_cost: deliveryItem.unitPrice,
                supplier_order_id: order.id,
                received_date: new Date(),
              });
            } else {
              // Existing product - update stock
              if (!productId) continue; // Skip if no product ID

              const product = await db.products.get(productId);
              if (product) {
                const newStock = product.stock + deliveryItem.receivedQuantity;

                // Consolidate all product updates into a single update call
                const productUpdates: Record<string, unknown> = {
                  stock: newStock,
                  synced: false,
                  updatedAt: new Date(),
                };

                if (deliveryItem.expirationDate) {
                  productUpdates.expirationDate = new Date(deliveryItem.expirationDate);
                }
                if (deliveryItem.lotNumber) {
                  productUpdates.lotNumber = deliveryItem.lotNumber;
                }

                await db.products.update(productId, productUpdates);

                // 🆕 CREATE PRODUCT BATCH (FEFO Phase 3) - UUID migration
                const newBatchId = generateId();
                await db.product_batches.add({
                  id: newBatchId,
                  product_id: productId,
                  lot_number: deliveryItem.lotNumber || `LOT-${Date.now()}-${productId}`,
                  expiration_date: deliveryItem.expirationDate
                    ? new Date(deliveryItem.expirationDate)
                    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default: 1 year from now
                  quantity: deliveryItem.receivedQuantity,
                  initial_qty: deliveryItem.receivedQuantity,
                  unit_cost: deliveryItem.unitPrice,
                  supplier_order_id: order.id,
                  received_date: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  synced: false,
                });

                // Queue batch for sync
                await queueTransaction('PRODUCT_BATCH', 'CREATE', {
                  id: newBatchId,
                  product_id: productId,
                  lot_number: deliveryItem.lotNumber || `LOT-${Date.now()}-${productId}`,
                  expiration_date: deliveryItem.expirationDate
                    ? new Date(deliveryItem.expirationDate)
                    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                  quantity: deliveryItem.receivedQuantity,
                  initial_qty: deliveryItem.receivedQuantity,
                  unit_cost: deliveryItem.unitPrice,
                  supplier_order_id: order.id,
                  received_date: new Date(),
                });

                // Queue product update for sync
                await queueTransaction('PRODUCT', 'UPDATE', {
                  id: productId,
                  stock: newStock,
                  expirationDate: deliveryItem.expirationDate ? new Date(deliveryItem.expirationDate) : undefined,
                  lotNumber: deliveryItem.lotNumber,
                });

                // Update product-supplier link if exists
                const productSupplier = productSuppliers.find(
                  ps => ps.product_id === productId && ps.supplier_id === supplier.id!
                );

                if (productSupplier) {
                  await db.product_suppliers.update(productSupplier.id!, {
                    last_ordered_date: new Date(),
                    synced: false,
                  });
                } else {
                  // Create link if doesn't exist
                  const psId = generateId();
                  await db.product_suppliers.add({
                    id: psId,
                    product_id: productId,
                    supplier_id: supplier.id!,
                    default_price: deliveryItem.unitPrice,
                    is_primary: false,
                    last_ordered_date: new Date(),
                    synced: false,
                  });

                  await queueTransaction('PRODUCT_SUPPLIER', 'CREATE', {
                    id: psId,
                    product_id: productId,
                    supplier_id: supplier.id!,
                    default_price: deliveryItem.unitPrice,
                    is_primary: false,
                    last_ordered_date: new Date(),
                  });
                }
              }
            }

            // Create stock movement (only if we have a product ID)
            if (productId) {
              const movementId = generateId();
              const movement: StockMovement = {
                id: movementId,
                product_id: productId,
                type: 'RECEIPT',
                quantity_change: deliveryItem.receivedQuantity,
                reason: `Réception commande ${order.orderNumber || '#' + order.id?.slice(0, 8)} - ${supplier.name}`,
                created_at: new Date(),
                user_id: currentUser.id,
                supplier_order_id: order.id,
                synced: false,
              };

              await db.stock_movements.add(movement);

              // Queue stock movement for sync
              await queueTransaction('STOCK_MOVEMENT', 'CREATE', movement);
            }
          }

          // Update order items with received quantities (for existing products)
          for (const deliveryItem of deliveryItems) {
            if (deliveryItem.productId) {
              // Update existing order item with received quantity
              await db.supplier_order_items.update(deliveryItem.orderItemId, {
                quantityReceived: deliveryItem.receivedQuantity,
                subtotal: deliveryItem.receivedQuantity * deliveryItem.unitPrice,
                synced: false,
              });
            }
          }

          // Update order status to DELIVERED and recalculate total from received quantities
          await db.supplier_orders.update(order.id!, {
            status: 'DELIVERED',
            deliveryDate: new Date(),
            calculatedTotal: calculateNewTotal, // Update total based on received quantities
            totalAmount: calculateNewTotal, // Also update totalAmount for backward compatibility
            updatedAt: new Date(),
            synced: false,
          });

          // Queue order update for sync
          await queueTransaction('SUPPLIER_ORDER', 'UPDATE', {
            id: order.id,
            status: 'DELIVERED',
            deliveryDate: new Date(),
            calculatedTotal: calculateNewTotal,
            totalAmount: calculateNewTotal,
          });
        }
      );

      toast.success('Commande marquée comme livrée. Stock mis à jour.');
      setShowDeliveryDialog(false);
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error('Erreur lors de la confirmation de livraison');
    } finally {
      setIsProcessing(false);
    }
  };

  // Update delivery item
  const updateDeliveryItem = (index: number, updates: Partial<DeliveryItem>) => {
    setDeliveryItems(items => {
      const newItems = [...items];
      const item = newItems[index];

      // Validate received quantity doesn't exceed ordered quantity
      if (updates.receivedQuantity !== undefined) {
        if (updates.receivedQuantity > item.orderedQuantity) {
          toast.error(`Quantité reçue (${updates.receivedQuantity}) ne peut pas dépasser la quantité commandée (${item.orderedQuantity})`);
          return items; // Don't update if invalid
        }
      }

      newItems[index] = { ...newItems[index], ...updates };
      return newItems;
    });
  };

  // Handle cancellation
  const handleCancel = async () => {
    if (!order || !currentUser) return;

    setIsProcessing(true);

    try {
      await db.supplier_orders.update(order.id!, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        updatedAt: new Date(),
        synced: false,
      });

      await queueTransaction('SUPPLIER_ORDER', 'UPDATE', {
        id: order.id,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });

      toast.success('Commande annulée');
      setShowCancelDialog(false);
      router.back();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Erreur lors de l\'annulation');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get current delivery item
  const currentDeliveryItem = deliveryItems[currentDeliveryIndex];

  // Show skeleton while loading
  const isLoading = order === undefined || supplier === undefined;

  // Show nothing while checking auth or if not authenticated
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || (!isAuthenticated && !hasOAuthSession)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-8">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
          <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="h-6 w-32 bg-slate-700 rounded animate-pulse mb-1" />
              <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <main className="p-4 max-w-2xl mx-auto">
          <OrderDetailSkeleton />
        </main>
      </div>
    );
  }

  if (!order || !supplier) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-semibold">Commande introuvable</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-emerald-400 underline"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order);
  const StatusIcon = statusConfig.icon;
  const canEdit = order.status === 'PENDING' || order.status === 'ORDERED'; // Support both old and new status
  const canDeliver = order.status === 'PENDING' || order.status === 'ORDERED';
  const canCancel = (order.status === 'PENDING' || order.status === 'ORDERED') && order.type !== 'RETURN'; // Can't cancel returns after submission

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
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">Commande {order.orderNumber || `#${order.id?.slice(0, 8)}`}</h1>
            <p className="text-sm text-slate-400 truncate">{supplier.name}</p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Status Badge */}
        <div className={cn(
          'rounded-xl p-4 border flex items-center gap-3',
          statusConfig.bgColor,
          statusConfig.borderColor
        )}>
          <StatusIcon className={cn('w-6 h-6', statusConfig.color)} />
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', statusConfig.color)}>
              {statusConfig.label}
            </p>
            <p className="text-xs text-slate-500">
              {formatDate(order.orderDate)}
            </p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Fournisseur</p>
              <p className="text-base font-semibold text-white">{supplier.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Date de commande</p>
              <p className="text-base font-semibold text-white">{formatDate(order.orderDate)}</p>
            </div>
            {order.deliveryDate && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Date de livraison</p>
                <p className="text-base font-semibold text-white">{formatDate(order.deliveryDate)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">Échéance</p>
              <p className="text-base font-semibold text-white">{formatDate(order.dueDate)}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-300">Total</span>
              <span className="text-2xl font-bold text-emerald-400">
                {formatCurrency(orderTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        {balance > 0 && (
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Paiement</span>
              <span className="text-sm font-semibold text-slate-300">
                {formatCurrency(order.amountPaid)} / {formatCurrency(orderTotal)}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(order.amountPaid / orderTotal) * 100}%` }}
              />
            </div>
            <div className={cn(
              'text-sm font-semibold',
              paymentStatus === 'overdue' ? 'text-red-400' :
              paymentStatus === 'urgent' ? 'text-orange-400' :
              paymentStatus === 'upcoming' ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {balance > 0 ? `${formatCurrency(balance)} restant` : 'Entièrement payé'}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
            Produits ({orderItems.length})
          </h3>

          {orderItems.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Aucun produit dans cette commande</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orderItems.map((item) => {
                const product = item.product_id ? products.find(p => p.id === item.product_id) : null;
                const isNewProduct = !item.product_id;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base font-semibold text-white truncate">
                            {item.product_name}
                          </h4>
                          {isNewProduct && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded">
                              Nouveau
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-2">
                          {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.subtotal)}
                        </p>
                        {product && (
                          <p className="text-xs text-slate-500">
                            Stock actuel: {product.stock}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-slate-500 mt-1 italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <p className="text-sm font-semibold text-slate-300 mb-2">Notes</p>
            <p className="text-sm text-slate-400">{order.notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-slate-950 pt-4 pb-4 space-y-3">
          {canDeliver && (
            <Button
              onClick={initializeDeliveryItems}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-base active:scale-95"
            >
              <Truck className="w-5 h-5 mr-2" />
              Marquer comme livré
            </Button>
          )}
          {canCancel && (
            <Button
              onClick={() => setShowCancelDialog(true)}
              disabled={isProcessing}
              variant="outline"
              className="w-full h-14 bg-slate-800 border-slate-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 rounded-xl font-semibold text-base active:scale-95 disabled:opacity-50"
            >
              <X className="w-5 h-5 mr-2" />
              Annuler la commande
            </Button>
          )}
          {order.status !== 'CANCELLED' && (
            <Button
              onClick={() => router.push(`/fournisseurs/paiement?supplierId=${supplier.id}&orderId=${order.id}`)}
              disabled={balance === 0 || order.status === 'PENDING' || order.status === 'ORDERED'}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-base active:scale-95 disabled:opacity-50"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Enregistrer un paiement
            </Button>
          )}
        </div>
      </main>

      {/* Delivery Confirmation Dialog */}
      <MobileBottomSheet
        isOpen={showDeliveryDialog}
        onClose={() => !isProcessing && setShowDeliveryDialog(false)}
        title="Confirmer la livraison"
        fullScreen
        footer={
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {currentDeliveryIndex + 1} / {deliveryItems.length}
              </span>
              {currentDeliveryIndex < deliveryItems.length - 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentDeliveryIndex(prev => prev + 1)}
                  className="text-emerald-400 font-semibold"
                >
                  Suivant →
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeliveryDialog(false)}
                disabled={isProcessing}
                className="flex-1 h-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
              >
                Annuler
              </Button>
              {currentDeliveryIndex === deliveryItems.length - 1 ? (
                <Button
                  type="button"
                  onClick={handleConfirmDelivery}
                  disabled={isProcessing}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Traitement...
                    </span>
                  ) : (
                    'Confirmer la livraison'
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setCurrentDeliveryIndex(prev => prev + 1)}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Suivant
                </Button>
              )}
            </div>
          </div>
        }
      >
        {currentDeliveryItem && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-2">
                {currentDeliveryItem.productName}
              </h3>
              {currentDeliveryItem.isNewProduct && (
                <p className="text-sm text-blue-400 mb-2">Nouveau produit - sera créé dans l'inventaire</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Quantité commandée</span>
                <span className="text-white font-semibold">{currentDeliveryItem.orderedQuantity}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Quantité reçue *
              </label>
              <QuantitySelector
                value={currentDeliveryItem.receivedQuantity}
                onChange={(value) => updateDeliveryItem(currentDeliveryIndex, { receivedQuantity: value })}
                unitPrice={currentDeliveryItem.unitPrice}
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Date d'expiration (optionnel)
              </label>
              <Input
                type="date"
                value={currentDeliveryItem.expirationDate || ''}
                onChange={(e) => {
                  const newExpirationDate = e.target.value;
                  const autoLotNumber = generateLotNumber(currentDeliveryItem.productName, newExpirationDate);
                  updateDeliveryItem(currentDeliveryIndex, {
                    expirationDate: newExpirationDate,
                    lotNumber: autoLotNumber,
                  });
                }}
                className="h-14 bg-slate-800 border-slate-700 text-white rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Numéro de lot (optionnel)
              </label>
              <Input
                type="text"
                value={currentDeliveryItem.lotNumber || ''}
                onChange={(e) => updateDeliveryItem(currentDeliveryIndex, { lotNumber: e.target.value })}
                placeholder="Généré automatiquement depuis la date d'expiration"
                className="h-14 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
              />
              {currentDeliveryItem.expirationDate && currentDeliveryItem.lotNumber && (
                <p className="text-xs text-emerald-400 mt-2">
                  ✓ Numéro de lot généré automatiquement
                </p>
              )}
            </div>

            {currentDeliveryItem.receivedQuantity !== currentDeliveryItem.orderedQuantity && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">
                      Quantité différente
                    </p>
                    <p className="text-xs text-slate-400">
                      Quantité reçue ({currentDeliveryItem.receivedQuantity}) différente de la quantité commandée ({currentDeliveryItem.orderedQuantity})
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Total Summary Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Récapitulatif
              </h4>

              {/* Ordered Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Total commandé</span>
                <span className={cn(
                  "font-semibold text-base",
                  currentDeliveryItem.receivedQuantity !== currentDeliveryItem.orderedQuantity
                    ? "text-slate-500 line-through"
                    : "text-white"
                )}>
                  {formatCurrency(currentDeliveryItem.orderedQuantity * currentDeliveryItem.unitPrice)}
                </span>
              </div>

              {/* Received Total (if different) */}
              {currentDeliveryItem.receivedQuantity !== currentDeliveryItem.orderedQuantity && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                  <span className="text-sm font-semibold text-emerald-400">Total reçu</span>
                  <span className="font-bold text-lg text-emerald-400">
                    {formatCurrency(currentDeliveryItem.receivedQuantity * currentDeliveryItem.unitPrice)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </MobileBottomSheet>

      {/* Cancel Confirmation Dialog */}
      <MobileBottomSheet
        isOpen={showCancelDialog}
        onClose={() => !isProcessing && setShowCancelDialog(false)}
        title="Annuler la commande"
      >
        <div className="p-6 space-y-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1">
                Action irréversible
              </p>
              <p className="text-xs text-slate-300">
                Êtes-vous sûr de vouloir annuler cette commande ? Cette action ne peut pas être annulée.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setShowCancelDialog(false)}
              disabled={isProcessing}
              variant="outline"
              className="flex-1 h-14 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl font-semibold active:scale-95"
            >
              Retour
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex-1 h-14 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Annulation...
                </>
              ) : (
                <>
                  <X className="w-5 h-5 mr-2" />
                  Confirmer l&apos;annulation
                </>
              )}
            </Button>
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}

