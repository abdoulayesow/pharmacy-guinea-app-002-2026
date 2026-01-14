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
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  pinHash?: string | null; // Optional: set after OAuth login
  mustChangePin?: boolean; // Force PIN change on first login
  avatar?: string | null;
  image?: string | null; // Google profile picture URL
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
  expirationDate?: Date; // 🆕 Expiration tracking (MVP feature from user research)
  lotNumber?: string; // 🆕 Batch/lot tracking
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

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'CREDIT'; // 🆕 Added CREDIT for pay-later sales
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE'; // 🆕 Payment tracking

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
  // 🆕 Customer information (optional)
  customer_name?: string;
  customer_phone?: string;
  // 🆕 Payment tracking for credit sales
  payment_status: PaymentStatus; // Default: 'PAID' for CASH/ORANGE_MONEY, 'PENDING' for CREDIT
  due_date?: Date; // Required for CREDIT payment method
  amount_paid: number; // Amount paid so far (= total for CASH/ORANGE_MONEY, can be partial for CREDIT)
  amount_due: number; // Remaining amount to be paid (= 0 for CASH/ORANGE_MONEY)
  // 🆕 Sale editing tracking (Phase 3)
  modified_at?: Date; // Last modification timestamp
  modified_by?: string; // User ID who last modified
  edit_count?: number; // Number of times this sale was edited
}

// 🆕 Credit payment tracking - records partial payments on credit sales
export interface CreditPayment {
  id?: number;
  serverId?: number;
  sale_id: number;
  amount: number;
  payment_method: 'CASH' | 'ORANGE_MONEY'; // Payment method for this installment
  payment_ref?: string; // Orange Money reference if applicable
  payment_date: Date;
  notes?: string;
  user_id: string;
  synced: boolean;
}

// ============================================================================
// Expense Types
// ============================================================================

export type ExpenseCategory =
  | 'STOCK_PURCHASE'
  | 'SUPPLIER_PAYMENT' // 🆕 Payment to supplier (linked to orders)
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
  supplier_order_id?: number; // 🆕 Optional link to supplier order payment
  user_id: string;
  synced: boolean;
}

// ============================================================================
// Stock Movement Types
// ============================================================================

export type StockMovementType =
  | 'SALE'
  | 'SALE_EDIT' // 🆕 Phase 3: Sale correction/editing (audit trail)
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
export type SyncType =
  | 'SALE'
  | 'EXPENSE'
  | 'PRODUCT'
  | 'STOCK_MOVEMENT'
  | 'SUPPLIER' // 🆕
  | 'SUPPLIER_ORDER' // 🆕
  | 'SUPPLIER_RETURN' // 🆕
  | 'CREDIT_PAYMENT' // 🆕 Partial payment tracking
  | 'USER'; // 🆕 User PIN updates
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'UPDATE_PIN';

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
// Supplier Types (NEW - from user research 2026-01)
// ============================================================================

export type SupplierOrderStatus = 'ORDERED' | 'DELIVERED' | 'PARTIALLY_PAID' | 'PAID';
export type ReturnReason = 'EXPIRING' | 'DAMAGED' | 'OTHER';

export interface Supplier {
  id?: number;
  serverId?: number;
  name: string;
  phone?: string;
  paymentTermsDays: number; // Default: 30 days credit
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
}

export interface SupplierOrder {
  id?: number;
  serverId?: number;
  supplierId: number;
  orderDate: Date;
  deliveryDate?: Date;
  totalAmount: number; // Total order amount in GNF
  amountPaid: number; // Amount paid so far in GNF
  dueDate: Date; // Calculated from orderDate + paymentTermsDays
  status: SupplierOrderStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
}

export interface SupplierReturn {
  id?: number;
  serverId?: number;
  supplierId: number;
  supplierOrderId?: number; // Optional link to order for deduction
  productId: number;
  quantity: number;
  reason: ReturnReason;
  creditAmount: number; // Credit value in GNF
  returnDate: Date;
  applied: boolean; // True if credit applied to payment
  appliedToOrderId?: number; // Which order was this credit applied to
  createdAt: Date;
  synced: boolean;
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
  suppliers?: Supplier[]; // 🆕
  supplierOrders?: SupplierOrder[]; // 🆕
  supplierReturns?: SupplierReturn[]; // 🆕
  creditPayments?: CreditPayment[]; // 🆕 Partial payment tracking
}

export interface SyncPushResponse {
  success: boolean;
  synced: {
    sales: Record<string, number>; // Map localId -> serverId
    expenses: Record<string, number>;
    stockMovements: Record<string, number>;
    products: Record<string, number>;
    suppliers: Record<string, number>; // 🆕
    supplierOrders: Record<string, number>; // 🆕
    supplierReturns: Record<string, number>; // 🆕
    creditPayments: Record<string, number>; // 🆕 Partial payment tracking
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
    suppliers: Supplier[]; // 🆕
    supplierOrders: SupplierOrder[]; // 🆕
    supplierReturns: SupplierReturn[]; // 🆕
    creditPayments: CreditPayment[]; // 🆕 Partial payment tracking
  };
  serverTime: Date;
}
