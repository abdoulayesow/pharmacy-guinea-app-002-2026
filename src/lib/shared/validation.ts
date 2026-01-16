/**
 * Zod validation schemas for runtime type checking
 *
 * These schemas ensure data integrity at system boundaries:
 * - API request/response validation
 * - IndexedDB data validation before sync
 * - Form input validation
 */

import { z } from 'zod';

// ============================================================================
// Enum Schemas
// ============================================================================

export const PaymentMethodSchema = z.enum(['CASH', 'ORANGE_MONEY', 'CREDIT']);
export const PaymentStatusSchema = z.enum(['PAID', 'PENDING', 'PARTIAL']);
export const UserRoleSchema = z.enum(['OWNER', 'EMPLOYEE']);
export const StockMovementTypeSchema = z.enum([
  'SALE',
  'SALE_EDIT',
  'ADJUSTMENT',
  'INVENTORY',
  'DAMAGED',
  'EXPIRED',
]);
export const ExpenseCategorySchema = z.enum([
  'STOCK_PURCHASE',
  'RENT',
  'SALARY',
  'ELECTRICITY',
  'TRANSPORT',
  'OTHER',
]);
export const SyncStatusSchema = z.enum(['PENDING', 'SYNCING', 'SYNCED', 'FAILED']);
export const SyncActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'UPDATE_PIN']);
export const SyncTypeSchema = z.enum([
  'SALE',
  'EXPENSE',
  'STOCK_MOVEMENT',
  'PRODUCT',
  'USER',
  'SUPPLIER',
  'SUPPLIER_ORDER',
  'SUPPLIER_ORDER_ITEM',
  'SUPPLIER_RETURN',
  'PRODUCT_SUPPLIER',
  'CREDIT_PAYMENT',
]);
export const ReturnReasonSchema = z.enum([
  'EXPIRING',
  'DAMAGED',
  'WRONG_PRODUCT',
  'QUALITY_ISSUE',
  'OTHER',
]);
export const SupplierOrderStatusSchema = z.enum(['PENDING', 'DELIVERED', 'CANCELLED']);
export const SupplierOrderPaymentStatusSchema = z.enum(['PENDING', 'PAID', 'UNPAID', 'PARTIALLY_PAID']);

// ============================================================================
// Product Schema
// ============================================================================

export const ProductSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  name: z.string().min(1, 'Le nom du produit est requis').max(200),
  category: z.string().max(100).optional(),
  price: z.number().int().min(0, 'Le prix de vente doit être positif'),
  priceBuy: z.number().int().min(0, 'Le prix d\'achat doit être positif').optional(),
  stock: z.number().int().min(0, 'Le stock ne peut pas être négatif').default(0),
  minStock: z.number().int().min(0, 'Le stock minimum doit être positif').default(10),
  expirationDate: z.date().optional(),
  lotNumber: z.string().max(100).optional(),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export type ProductInput = z.input<typeof ProductSchema>;
export type ProductOutput = z.output<typeof ProductSchema>;

// ============================================================================
// Sale Schema
// ============================================================================

export const SaleItemSchema = z.object({
  id: z.number().optional(),
  sale_id: z.number().optional(),
  product_id: z.number().min(1, 'ID du produit requis'),
  quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  unit_price: z.number().int().min(0, 'Le prix unitaire doit être positif'),
  subtotal: z.number().int().min(0, 'Le sous-total doit être positif'),
});

export const SaleSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  total: z.number().int().min(0, 'Le total doit être positif'),
  payment_method: PaymentMethodSchema,
  payment_status: PaymentStatusSchema.default('PAID'),
  payment_ref: z.string().max(200).optional(),
  amount_paid: z.number().int().min(0).default(0),
  amount_due: z.number().int().min(0).default(0),
  due_date: z.date().optional(),
  customer_name: z.string().max(200).optional(),
  customer_phone: z.string().max(20).optional(),
  created_at: z.date().default(() => new Date()),
  user_id: z.string().min(1, 'ID utilisateur requis'),
  modified_at: z.date().optional(),
  modified_by: z.string().optional(),
  edit_count: z.number().int().min(0).default(0),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export type SaleItemInput = z.input<typeof SaleItemSchema>;
export type SaleInput = z.input<typeof SaleSchema>;

// ============================================================================
// Expense Schema
// ============================================================================

export const ExpenseSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  amount: z.number().int().min(0, 'Le montant doit être positif'),
  category: ExpenseCategorySchema,
  description: z.string().min(1, 'La description est requise').max(500),
  date: z.date().default(() => new Date()),
  created_at: z.date().default(() => new Date()),
  supplier_order_id: z.number().optional(),
  user_id: z.string().min(1, 'ID utilisateur requis'),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export type ExpenseInput = z.input<typeof ExpenseSchema>;

// ============================================================================
// Stock Movement Schema
// ============================================================================

export const StockMovementSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  product_id: z.number().min(1, 'ID du produit requis'),
  type: StockMovementTypeSchema,
  quantity_change: z.number().int(), // Can be negative
  reason: z.string().max(500).optional(),
  created_at: z.date().default(() => new Date()),
  supplier_order_id: z.number().optional(),
  user_id: z.string().min(1, 'ID utilisateur requis'),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export type StockMovementInput = z.input<typeof StockMovementSchema>;

// ============================================================================
// Supplier Schemas
// ============================================================================

export const SupplierSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  name: z.string().min(1, 'Le nom du fournisseur est requis').max(200),
  phone: z.string().max(20).optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
  synced: z.boolean().default(false),
});

export const SupplierOrderSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  supplierId: z.number().min(1, 'ID du fournisseur requis'),
  type: z.enum(['ORDER', 'RETURN']).default('ORDER'),
  orderDate: z.date().default(() => new Date()),
  deliveryDate: z.date().optional(),
  totalAmount: z.number().int().min(0, 'Le montant total doit être positif'),
  calculatedTotal: z.number().int().min(0).optional(),
  amountPaid: z.number().int().min(0).default(0),
  dueDate: z.date(),
  status: SupplierOrderStatusSchema.default('PENDING'),
  paymentStatus: SupplierOrderPaymentStatusSchema.default('PENDING'),
  cancelledAt: z.date().optional(),
  notes: z.string().max(1000).optional(),
  returnReason: ReturnReasonSchema.optional(),
  returnProductId: z.number().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
  synced: z.boolean().default(false),
});

export const SupplierOrderItemSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  order_id: z.number().min(1, 'ID de commande requis'),
  product_id: z.number().optional(), // Null if new product not yet created
  product_name: z.string().min(1, 'Le nom du produit est requis').max(200),
  category: z.string().max(100).optional(),
  quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  quantity_received: z.number().int().min(0).optional(),
  unit_price: z.number().int().min(0, 'Le prix unitaire doit être positif'),
  subtotal: z.number().int().min(0, 'Le sous-total doit être positif'),
  notes: z.string().max(500).optional(),
  created_at: z.date().default(() => new Date()),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export const ProductSupplierSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  product_id: z.number().min(1, 'ID du produit requis'),
  supplier_id: z.number().min(1, 'ID du fournisseur requis'),
  supplier_product_code: z.string().max(100).optional(),
  supplier_product_name: z.string().max(200).optional(),
  default_price: z.number().int().min(0).optional(),
  is_primary: z.boolean().default(false),
  last_ordered_date: z.date().optional(),
  created_at: z.date().default(() => new Date()),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export const SupplierReturnSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  supplierId: z.number().min(1, 'ID du fournisseur requis'),
  supplierOrderId: z.number().optional(),
  productId: z.number().min(1, 'ID du produit requis'),
  quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  reason: ReturnReasonSchema,
  creditAmount: z.number().int().min(0, 'Le montant du crédit doit être positif'),
  returnDate: z.date().default(() => new Date()),
  applied: z.boolean().default(false),
  appliedToOrderId: z.number().optional(),
  createdAt: z.date().default(() => new Date()),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

// ============================================================================
// Credit Payment Schema
// ============================================================================

export const CreditPaymentSchema = z.object({
  id: z.number().optional(),
  serverId: z.number().optional(),
  sale_id: z.number().min(1, 'ID de vente requis'),
  amount: z.number().int().min(1, 'Le montant doit être positif'),
  method: z.enum(['CASH', 'ORANGE_MONEY']),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  payment_date: z.date().default(() => new Date()),
  recorded_by: z.string().min(1, 'ID utilisateur requis'),
  synced: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export type CreditPaymentInput = z.input<typeof CreditPaymentSchema>;

// ============================================================================
// Sync Queue Schema
// ============================================================================

export const SyncQueueItemSchema = z.object({
  id: z.number().optional(),
  type: SyncTypeSchema,
  action: SyncActionSchema,
  payload: z.any(), // Payload is entity-specific, validated by entity schema
  createdAt: z.date().default(() => new Date()),
  status: SyncStatusSchema.default('PENDING'),
  retryCount: z.number().int().min(0).default(0),
  lastError: z.string().max(1000).optional(),
});

export type SyncQueueItemInput = z.input<typeof SyncQueueItemSchema>;

// ============================================================================
// API Request/Response Schemas
// ============================================================================

export const SyncPushRequestSchema = z.object({
  sales: z.array(SaleSchema).optional(),
  saleItems: z.array(SaleItemSchema).optional(),
  expenses: z.array(ExpenseSchema).optional(),
  stockMovements: z.array(StockMovementSchema).optional(),
  products: z.array(ProductSchema).optional(),
  suppliers: z.array(SupplierSchema).optional(),
  supplierOrders: z.array(SupplierOrderSchema).optional(),
  supplierOrderItems: z.array(SupplierOrderItemSchema).optional(),
  supplierReturns: z.array(SupplierReturnSchema).optional(),
  productSuppliers: z.array(ProductSupplierSchema).optional(),
  creditPayments: z.array(CreditPaymentSchema).optional(),
});

export type SyncPushRequestInput = z.input<typeof SyncPushRequestSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate data against schema and return safe result
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    ),
  };
}

/**
 * Validate and throw on error (for API routes)
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
