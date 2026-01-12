'use client';

import { create } from 'zustand';
import type { Product, CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addToCart: (product) =>
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        // Don't exceed available stock
        if (existing.quantity >= product.stock) {
          return state;
        }
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      // Don't add if out of stock
      if (product.stock === 0) {
        return state;
      }
      return { items: [...state.items, { product, quantity: 1 }] };
    }),

  removeFromCart: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.product.id !== productId),
    })),

  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter((i) => i.product.id !== productId),
        };
      }
      return {
        items: state.items.map((i) => {
          if (i.product.id === productId) {
            // Don't exceed available stock
            const maxQuantity = Math.min(quantity, i.product.stock);
            return { ...i, quantity: maxQuantity };
          }
          return i;
        }),
      };
    }),

  clearCart: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
