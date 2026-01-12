/**
 * Shared TypeScript types for Seri
 *
 * These types are used by both:
 * - Frontend (PWA + Future Android app)
 * - Backend (API)
 */

// ============================================================================
// User Types
// ============================================================================

export type UserRole = 'OWNER' | 'EMPLOYEE';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pinHash: string;
  avatar?: string;
  createdAt: Date;
}

// ============================================================================
// Product Types
// ============================================================================

export interface Product {
  id?: number;
  serverId?: number;
  name: string;
  category: string;
  price: number;
  priceBuy?: number;
  stock: number;
  minStock: number;
  synced: boolean;
  updatedAt: Date;
}

// ============================================================================
// Cart Types (Client-only)
// ============================================================================

export interface CartItem {
  product: Product;
  quantity: number;
}

// ============================================================================
// Sale Types
// ============================================================================

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY';

export interface SaleItem {
  id?: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id?: number;
  serverId?: number;
  created_at: Date;
  total: number;
  payment_method: PaymentMethod;
  payment_ref?: string | null;
  user_id: string;
  synced: boolean;
}

// ============================================================================
// Expense Types
// ============================================================================

export type ExpenseCategory =
  | 'STOCK_PURCHASE'
  | 'RENT'
  | 'SALARY'
  | 'ELECTRICITY'
  | 'TRANSPORT'
  | 'OTHER';

export interface Expense {
  id?: number;
  serverId?: number;
  date: Date;
  description: string;
  amount: number;
  category: ExpenseCategory;
  user_id: string;
  synced: boolean;
}

// ============================================================================
// Stock Movement Types
// ============================================================================

export type StockMovementType =
  | 'SALE'
  | 'ADJUSTMENT'
  | 'INVENTORY'
  | 'RECEIPT'
  | 'DAMAGED'
  | 'EXPIRED';

export interface StockMovement {
  id?: number;
  serverId?: number;
  product_id: number;
  type: StockMovementType;
  quantity_change: number;
  reason: string;
  created_at: Date;
  user_id: string;
  synced: boolean;
}

// ============================================================================
// Sync Types
// ============================================================================

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type SyncType = 'SALE' | 'EXPENSE' | 'PRODUCT' | 'STOCK_MOVEMENT';
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id?: number;
  type: SyncType;
  action: SyncAction;
  payload: unknown;
  localId: number;
  createdAt: Date;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface LoginRequest {
  userId: string;
  pin: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: Omit<User, 'pinHash'>;
  error?: string;
}

export interface SyncPushRequest {
  sales?: Sale[];
  expenses?: Expense[];
  stockMovements?: StockMovement[];
  products?: Product[];
}

export interface SyncPushResponse {
  success: boolean;
  synced: {
    sales: number[];
    expenses: number[];
    stockMovements: number[];
    products: number[];
  };
  errors?: string[];
}

export interface SyncPullRequest {
  lastSyncAt?: Date;
}

export interface SyncPullResponse {
  success: boolean;
  data: {
    products: Product[];
    sales: Sale[];
    expenses: Expense[];
    stockMovements: StockMovement[];
  };
  serverTime: Date;
}
