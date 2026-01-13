/**
 * useSaleEdit Hook - Sale Editing Logic (Phase 3)
 *
 * Encapsulates all editing logic, validation, and database operations for sale editing.
 *
 * Features:
 * - Edit mode state management
 * - Validation rules (24h window, no partial payments)
 * - Stock reversal and reapply logic
 * - Save/cancel operations
 * - Sync queue integration
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/client/db';
import type { Sale, SaleItem, Product } from '@/lib/shared/types';

// Edit item structure (includes product reference for UI)
export interface EditItem {
  id?: number; // sale_item id (undefined for new items)
  product: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface UseSaleEditOptions {
  sale: Sale;
  saleItems: (SaleItem & { product: Product })[];
  onEditComplete?: () => void;
}

export function useSaleEdit({ sale, saleItems, onEditComplete }: UseSaleEditOptions) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate if this sale can be edited
  const canEdit = useMemo(() => {
    // Return not allowed if sale is not loaded yet
    if (!sale) {
      return { allowed: false, reason: 'Chargement...' };
    }

    // Cannot edit sales older than 24 hours
    const hoursSinceCreation = (Date.now() - new Date(sale.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      return { allowed: false, reason: 'Cette vente a plus de 24 heures' };
    }

    // Cannot edit credit sales with partial payments
    if (sale.payment_method === 'CREDIT' && sale.payment_status !== 'PENDING') {
      return { allowed: false, reason: 'Cette vente a déjà des paiements partiels' };
    }

    return { allowed: true, reason: '' };
  }, [sale]);

  // Calculate edit total
  const editTotal = useMemo(() => {
    return editItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [editItems]);

  // Calculate if there are significant changes
  const hasSignificantChanges = useMemo(() => {
    // Return false if sale is not loaded yet
    if (!sale) return false;

    const originalTotal = sale.total;
    const percentChange = Math.abs((editTotal - originalTotal) / originalTotal) * 100;

    // Check if total changed by more than 20%
    if (percentChange > 20) return true;

    // Check if items were removed
    if (editItems.length < saleItems.length) return true;

    return false;
  }, [sale, editTotal, editItems.length, saleItems.length]);

  // Enter edit mode
  const enterEditMode = useCallback(() => {
    if (!canEdit.allowed) {
      toast.error(canEdit.reason);
      return;
    }

    // Initialize edit items from current sale items
    const initialEditItems: EditItem[] = saleItems.map((item) => ({
      id: item.id,
      product: item.product,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }));

    setEditItems(initialEditItems);
    setIsEditMode(true);
    toast.info('Mode modification activé');
  }, [canEdit, saleItems]);

  // Cancel edit mode
  const cancelEdit = useCallback(() => {
    setIsEditMode(false);
    setEditItems([]);
    toast.info('Modifications annulées');
  }, []);

  // Update item quantity
  const updateQuantity = useCallback(async (itemIndex: number, newQuantity: number) => {
    if (newQuantity < 1) {
      toast.error('La quantité doit être au moins 1');
      return;
    }

    const item = editItems[itemIndex];

    // Check stock availability (add back original quantity, check against new quantity)
    const originalItem = saleItems.find((si) => si.product_id === item.product.id);
    const originalQuantity = originalItem?.quantity || 0;
    const availableStock = item.product.stock + originalQuantity;

    if (newQuantity > availableStock) {
      toast.error(`Stock insuffisant (disponible: ${availableStock})`);
      return;
    }

    // Update the item
    const updated = [...editItems];
    updated[itemIndex] = {
      ...item,
      quantity: newQuantity,
      subtotal: item.unit_price * newQuantity,
    };
    setEditItems(updated);
  }, [editItems, saleItems]);

  // Remove item
  const removeItem = useCallback((itemIndex: number) => {
    if (editItems.length <= 1) {
      toast.error('Une vente doit contenir au moins un article');
      return;
    }

    const updated = editItems.filter((_, index) => index !== itemIndex);
    setEditItems(updated);
    toast.success('Article retiré');
  }, [editItems]);

  // Add new item
  const addItem = useCallback((product: Product, quantity: number) => {
    // Check if product already in edit items
    const existingIndex = editItems.findIndex((item) => item.product.id === product.id);

    if (existingIndex >= 0) {
      // Update existing item quantity
      const newQuantity = editItems[existingIndex].quantity + quantity;
      updateQuantity(existingIndex, newQuantity);
      return;
    }

    // Check stock availability
    const originalItem = saleItems.find((si) => si.product_id === product.id);
    const originalQuantity = originalItem?.quantity || 0;
    const availableStock = product.stock + originalQuantity;

    if (quantity > availableStock) {
      toast.error(`Stock insuffisant (disponible: ${availableStock})`);
      return;
    }

    // Add as new item
    const newItem: EditItem = {
      product,
      quantity,
      unit_price: product.price,
      subtotal: product.price * quantity,
    };

    setEditItems([...editItems, newItem]);
    toast.success('Article ajouté');
  }, [editItems, saleItems, updateQuantity]);

  // Save edited sale
  const saveSale = useCallback(async (userId: string) => {
    // Validation
    if (editItems.length === 0) {
      toast.error('La vente doit contenir au moins un article');
      return false;
    }

    if (editTotal <= 0) {
      toast.error('Le total doit être supérieur à 0');
      return false;
    }

    // Confirm if significant changes
    if (hasSignificantChanges) {
      const confirmed = window.confirm(
        'Le total a changé significativement ou des articles ont été retirés. Voulez-vous continuer?'
      );
      if (!confirmed) return false;
    }

    setIsSaving(true);

    try {
      // Step 1: Reverse original stock movements (add quantities back)
      for (const originalItem of saleItems) {
        const product = await db.products.get(originalItem.product_id);
        if (!product) continue;

        await db.products.update(originalItem.product_id, {
          stock: product.stock + originalItem.quantity,
          synced: false,
        });

        await db.stock_movements.add({
          product_id: originalItem.product_id,
          type: 'SALE_EDIT',
          quantity_change: originalItem.quantity, // positive = adding back
          reason: `Correction vente #${sale.id}`,
          created_at: new Date(),
          user_id: userId,
          synced: false,
        });
      }

      // Step 2: Delete old sale items
      await db.sale_items.where('sale_id').equals(sale.id!).delete();

      // Step 3: Create new sale items and apply stock movements
      for (const item of editItems) {
        await db.sale_items.add({
          sale_id: sale.id!,
          product_id: item.product.id!,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        });

        const product = await db.products.get(item.product.id!);
        if (!product) continue;

        await db.products.update(item.product.id!, {
          stock: product.stock - item.quantity,
          synced: false,
        });

        await db.stock_movements.add({
          product_id: item.product.id!,
          type: 'SALE_EDIT',
          quantity_change: -item.quantity, // negative = removing
          reason: `Correction vente #${sale.id}`,
          created_at: new Date(),
          user_id: userId,
          synced: false,
        });
      }

      // Step 4: Update sale record
      const currentEditCount = sale.edit_count || 0;
      await db.sales.update(sale.id!, {
        total: editTotal,
        amount_paid: sale.payment_method === 'CREDIT' ? sale.amount_paid : editTotal,
        amount_due: sale.payment_method === 'CREDIT' ? editTotal - sale.amount_paid : 0,
        modified_at: new Date(),
        modified_by: userId,
        edit_count: currentEditCount + 1,
        synced: false,
      });

      // Step 5: Add to sync queue
      await db.sync_queue.add({
        type: 'SALE',
        action: 'UPDATE',
        payload: { id: sale.id },
        localId: sale.id!,
        createdAt: new Date(),
        status: 'PENDING',
        retryCount: 0,
      });

      toast.success('Vente modifiée avec succès');
      setIsEditMode(false);
      setEditItems([]);

      // Trigger parent component refresh
      if (onEditComplete) {
        onEditComplete();
      }

      return true;
    } catch (error) {
      console.error('Failed to save sale edit:', error);
      toast.error('Erreur lors de la sauvegarde');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [sale, saleItems, editItems, editTotal, hasSignificantChanges, onEditComplete]);

  return {
    // State
    isEditMode,
    canEdit,
    editItems,
    editTotal,
    isSaving,
    hasSignificantChanges,

    // Actions
    enterEditMode,
    cancelEdit,
    updateQuantity,
    removeItem,
    addItem,
    saveSale,
  };
}
