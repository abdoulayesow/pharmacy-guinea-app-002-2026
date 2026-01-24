/**
 * Shared TypeScript types for Seri
 *
 * These types are used by both:
 * - Frontend (PWA + Future Android app)
 * - Backend (API)
 *
 * UUID MIGRATION (2026-01): All entity IDs are now strings (CUIDs)
 * - Client generates UUID on creation
 * - Same ID used on client (IndexedDB) and server (PostgreSQL)
 * - No more serverId field needed
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
  id: string; // CUID generated client-side
  name: string;
  category: string;
  price: number;
  priceBuy?: number;
  stock: number;
  minStock: number;
  expirationDate?: Date; // Expiration tracking (MVP feature from user research)
  lotNumber?: string; // Batch/lot tracking
  synced: boolean;
  updatedAt: Date;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// Product Batch - FEFO tracking (Phase 3)
export interface ProductBatch {
  id: string; // CUID generated client-side
  product_id: string; // FK to Product.id (UUID)
  lot_number: string; // e.g., "LOT-2024-001"
  expiration_date: Date;
  quantity: number; // Current quantity in this batch
  initial_qty: number; // Original quantity received
  unit_cost?: number; // Cost per unit (optional)
  supplier_order_id?: string; // FK to SupplierOrder.id (UUID)
  received_date: Date;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
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

export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'CREDIT'; // Added CREDIT for pay-later sales
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE'; // Payment tracking

export interface SaleItem {
  id: string; // CUID generated client-side
  sale_id: string; // FK to Sale.id (UUID)
  product_id: string; // FK to Product.id (UUID)
  product_batch_id?: string; // FK to ProductBatch.id (UUID) - Track which batch was sold (FEFO)
  quantity: number;
  unit_price: number;
  subtotal: number;
  synced?: boolean;
}

export interface Sale {
  id: string; // CUID generated client-side
  created_at: Date;
  total: number;
  payment_method: PaymentMethod;
  payment_ref?: string | null;
  user_id: string; // FK to User.id
  synced: boolean;
  // Customer information (optional)
  customer_name?: string;
  customer_phone?: string;
  // Payment tracking for credit sales
  payment_status: PaymentStatus; // Default: 'PAID' for CASH/ORANGE_MONEY, 'PENDING' for CREDIT
  due_date?: Date; // Required for CREDIT payment method
  amount_paid: number; // Amount paid so far (= total for CASH/ORANGE_MONEY, can be partial for CREDIT)
  amount_due: number; // Remaining amount to be paid (= 0 for CASH/ORANGE_MONEY)
  // Sale editing tracking (Phase 3)
  modified_at?: Date; // Last modification timestamp
  modified_by?: string; // User ID who last modified
  edit_count?: number; // Number of times this sale was edited
  updatedAt?: Date; // For conflict resolution
  // Sync deduplication
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// Credit payment tracking - records partial payments on credit sales
export interface CreditPayment {
  id: string; // CUID generated client-side
  sale_id: string; // FK to Sale.id (UUID)
  amount: number;
  payment_method: 'CASH' | 'ORANGE_MONEY'; // Payment method for this installment
  payment_ref?: string; // Orange Money reference if applicable
  payment_date: Date;
  notes?: string;
  user_id: string; // FK to User.id
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// ============================================================================
// Expense Types
// ============================================================================

export type ExpenseCategory =
  | 'STOCK_PURCHASE'
  | 'SUPPLIER_PAYMENT' // Payment to supplier (linked to orders)
  | 'RENT'
  | 'SALARY'
  | 'ELECTRICITY'
  | 'TRANSPORT'
  | 'OTHER';

export interface Expense {
  id: string; // CUID generated client-side
  date: Date;
  description: string;
  amount: number;
  category: ExpenseCategory;
  supplier_order_id?: string; // FK to SupplierOrder.id (UUID) - Optional link to supplier order payment
  user_id: string; // FK to User.id
  synced: boolean;
  updatedAt?: Date; // For conflict resolution
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// ============================================================================
// Stock Movement Types
// ============================================================================

export type StockMovementType =
  | 'SALE'
  | 'SALE_EDIT' // Phase 3: Sale correction/editing (audit trail)
  | 'ADJUSTMENT'
  | 'INVENTORY'
  | 'RECEIPT'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'SUPPLIER_RETURN'; // Phase 2: Return to supplier

export interface StockMovement {
  id: string; // CUID generated client-side
  product_id: string; // FK to Product.id (UUID)
  type: StockMovementType;
  quantity_change: number;
  reason: string;
  created_at: Date;
  user_id: string; // FK to User.id
  supplier_order_id?: string; // FK to SupplierOrder.id (UUID) - Optional link to supplier order (for RECEIPT type)
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// ============================================================================
// Sync Types
// ============================================================================

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type SyncType =
  | 'SALE'
  | 'SALE_ITEM' // Sale line items
  | 'EXPENSE'
  | 'PRODUCT'
  | 'PRODUCT_BATCH' // Batch tracking for FEFO (Phase 3)
  | 'STOCK_MOVEMENT'
  | 'SUPPLIER'
  | 'SUPPLIER_ORDER'
  | 'SUPPLIER_ORDER_ITEM' // Order line items
  | 'SUPPLIER_RETURN'
  | 'PRODUCT_SUPPLIER' // Product-supplier links
  | 'CREDIT_PAYMENT' // Partial payment tracking
  | 'USER' // User PIN updates
  | 'STOCKOUT_REPORT' // Phase 4: Missed sales tracking
  | 'SALE_PRESCRIPTION' // Phase 4: Prescription images
  | 'PRODUCT_SUBSTITUTE'; // Phase 4: Product substitutes
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'UPDATE_PIN';

export interface SyncQueueItem {
  id?: number; // Auto-increment for queue management only
  type: SyncType;
  action: SyncAction;
  payload: unknown;
  entityId: string; // UUID of the entity being synced
  createdAt: Date;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

// ============================================================================
// Supplier Types (from user research 2026-01)
// ============================================================================

export type SupplierOrderStatus = 'PENDING' | 'ORDERED' | 'DELIVERED' | 'CANCELLED';
export type SupplierTransactionType = 'ORDER' | 'RETURN';
export type SupplierPaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';
export type ReturnReason = 'EXPIRING' | 'DAMAGED' | 'OTHER';

export interface Supplier {
  id: string; // CUID generated client-side
  name: string;
  phone?: string;
  paymentTermsDays: number; // Default: 30 days credit
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

export interface SupplierOrder {
  id: string; // CUID generated client-side
  supplierId: string; // FK to Supplier.id (UUID)
  type: SupplierTransactionType; // 'ORDER' or 'RETURN'
  orderDate: Date; // For returns, this is the return submission date
  deliveryDate?: Date; // Date when order/return was delivered
  totalAmount: number; // Total order/return amount in GNF (kept for backward compatibility)
  calculatedTotal?: number; // Calculated from order items (preferred)
  amountPaid: number; // Amount paid so far in GNF (for orders) or refunded (for returns)
  dueDate: Date; // Calculated from orderDate + paymentTermsDays (for orders only)
  status: SupplierOrderStatus; // 'PENDING' | 'ORDERED' | 'DELIVERED' | 'CANCELLED'
  paymentStatus: SupplierPaymentStatus; // 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' - for returns, tracks refund status
  cancelledAt?: Date; // Timestamp when cancelled
  notes?: string;
  // Return-specific fields (only used when type === 'RETURN')
  returnReason?: ReturnReason; // Reason for return
  returnProductId?: string; // FK to Product.id (UUID) - Product being returned (for single-product returns)
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// Supplier Order Item - links products to orders/returns
export interface SupplierOrderItem {
  id: string; // CUID generated client-side
  order_id: string; // FK to SupplierOrder.id (UUID)
  product_id?: string; // FK to Product.id (UUID) - null if new product not yet created
  product_name: string; // Name from supplier (may differ from catalog)
  category?: string; // Category for new products (stored for creation during delivery)
  quantity: number; // Ordered quantity
  quantityReceived?: number; // Received quantity (for delivery confirmation)
  unit_price: number; // Price from supplier
  subtotal: number;
  notes?: string; // Product-specific notes
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// Product-Supplier Relationship
export interface ProductSupplier {
  id: string; // CUID generated client-side
  product_id: string; // FK to Product.id (UUID)
  supplier_id: string; // FK to Supplier.id (UUID)
  supplier_product_code?: string; // Supplier's product code/SKU
  supplier_product_name?: string; // How supplier names it
  default_price?: number; // Default price from this supplier
  is_primary: boolean; // Primary supplier for this product
  last_ordered_date?: Date;
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

/**
 * @deprecated Use SupplierOrder with type='RETURN' instead
 * This interface is kept for backward compatibility during migration
 */
export interface SupplierReturn {
  id: string; // CUID generated client-side
  supplierId: string; // FK to Supplier.id (UUID)
  supplierOrderId?: string; // FK to SupplierOrder.id (UUID) - Optional link to order for deduction
  productId: string; // FK to Product.id (UUID)
  quantity: number;
  reason: ReturnReason;
  creditAmount: number; // Credit value in GNF
  returnDate: Date;
  applied: boolean; // True if credit applied to payment
  appliedToOrderId?: string; // FK to SupplierOrder.id (UUID) - Which order was this credit applied to
  createdAt: Date;
  synced: boolean;
  idempotencyKey?: string; // @deprecated - id itself is the idempotency key with UUIDs
}

// ============================================================================
// Stockout & Prescription Types (Phase 4 - Pharmacy Workflow)
// ============================================================================

/**
 * Stockout Report - Track products requested but unavailable (missed sales)
 * Helps pharmacy owner understand demand for out-of-stock items
 */
export interface StockoutReport {
  id: string;                    // CUID
  product_name: string;          // What was requested (may not exist in DB)
  product_id?: string;           // FK to products (if known product)
  requested_qty: number;         // How many were needed
  customer_name?: string;        // Optional: client info for follow-up
  customer_phone?: string;       // Optional: for callback when stock arrives
  notes?: string;                // Additional context
  reported_by: string;           // User ID who reported
  created_at: Date;
  synced: boolean;
}

/**
 * Sale Prescription - Attach prescription photos to sales
 * Important for compliance and record-keeping in pharmacies
 */
export interface SalePrescription {
  id: string;                    // CUID
  sale_id: string;               // FK to sales
  image_data: string;            // Base64 encoded image (compressed)
  image_type: 'image/jpeg' | 'image/png';
  captured_at: Date;
  notes?: string;                // Pharmacist notes about prescription
  synced: boolean;
}

/**
 * Product Substitute - Define equivalent products for recommendations
 * Helps suggest alternatives when requested product is out of stock
 */
export type SubstituteEquivalenceType = 'DCI' | 'THERAPEUTIC_CLASS' | 'MANUAL';

export interface ProductSubstitute {
  id: string;                    // CUID
  product_id: string;            // Primary product (FK to Product.id)
  substitute_id: string;         // Alternative product (FK to Product.id)
  equivalence_type: SubstituteEquivalenceType;
  notes?: string;                // e.g., "Même principe actif - paracétamol"
  priority: number;              // Lower = better match (1 = best)
  created_at: Date;
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
  saleItems?: SaleItem[]; // Sale line items
  expenses?: Expense[];
  stockMovements?: StockMovement[];
  products?: Product[];
  productBatches?: ProductBatch[]; // FEFO batch tracking
  suppliers?: Supplier[];
  supplierOrders?: SupplierOrder[];
  supplierOrderItems?: SupplierOrderItem[]; // Order line items
  supplierReturns?: SupplierReturn[];
  productSuppliers?: ProductSupplier[]; // Product-supplier links
  creditPayments?: CreditPayment[]; // Partial payment tracking
  stockoutReports?: StockoutReport[]; // Phase 4: Missed sales
  salePrescriptions?: SalePrescription[]; // Phase 4: Prescription images
  productSubstitutes?: ProductSubstitute[]; // Phase 4: Product substitutes
}

export interface SyncPushResponse {
  success: boolean;
  synced: {
    // UUID migration: just return arrays of synced IDs (same ID on client and server)
    sales: string[];
    saleItems: string[];
    expenses: string[];
    stockMovements: string[];
    products: string[];
    productBatches: string[];
    suppliers: string[];
    supplierOrders: string[];
    supplierOrderItems: string[];
    supplierReturns: string[];
    productSuppliers: string[];
    creditPayments: string[];
    stockoutReports: string[];
    salePrescriptions: string[];
    productSubstitutes: string[];
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
    saleItems: SaleItem[];
    expenses: Expense[];
    stockMovements: StockMovement[];
    suppliers: Supplier[];
    supplierOrders: SupplierOrder[];
    supplierOrderItems: SupplierOrderItem[];
    supplierReturns: SupplierReturn[];
    productSuppliers: ProductSupplier[];
    productBatches: ProductBatch[];
    creditPayments: CreditPayment[];
    stockoutReports: StockoutReport[];
    salePrescriptions: SalePrescription[];
    productSubstitutes: ProductSubstitute[];
  };
  serverTime: Date;
}
