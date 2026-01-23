/**
 * POST /api/sync/push
 *
 * Push local changes to the server
 * Handles offline-first sync queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import type { SyncPushRequest, SyncPushResponse } from '@/lib/shared/types';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body with basic validation
    const body: SyncPushRequest = await request.json();
    const { sales, saleItems, expenses, stockMovements, products, productBatches, suppliers, supplierOrders, supplierOrderItems, supplierReturns, productSuppliers, creditPayments, stockoutReports, salePrescriptions } = body;

    // Basic validation: ensure arrays are actually arrays
    const validationErrors: string[] = [];
    if (sales && !Array.isArray(sales)) validationErrors.push('sales must be an array');
    if (saleItems && !Array.isArray(saleItems)) validationErrors.push('saleItems must be an array');
    if (expenses && !Array.isArray(expenses)) validationErrors.push('expenses must be an array');
    if (stockMovements && !Array.isArray(stockMovements)) validationErrors.push('stockMovements must be an array');
    if (products && !Array.isArray(products)) validationErrors.push('products must be an array');
    if (productBatches && !Array.isArray(productBatches)) validationErrors.push('productBatches must be an array');
    if (suppliers && !Array.isArray(suppliers)) validationErrors.push('suppliers must be an array');
    if (supplierOrders && !Array.isArray(supplierOrders)) validationErrors.push('supplierOrders must be an array');
    if (supplierOrderItems && !Array.isArray(supplierOrderItems)) validationErrors.push('supplierOrderItems must be an array');
    if (supplierReturns && !Array.isArray(supplierReturns)) validationErrors.push('supplierReturns must be an array');
    if (productSuppliers && !Array.isArray(productSuppliers)) validationErrors.push('productSuppliers must be an array');
    if (creditPayments && !Array.isArray(creditPayments)) validationErrors.push('creditPayments must be an array');
    if (stockoutReports && !Array.isArray(stockoutReports)) validationErrors.push('stockoutReports must be an array');
    if (salePrescriptions && !Array.isArray(salePrescriptions)) validationErrors.push('salePrescriptions must be an array');

    if (validationErrors.length > 0) {
      console.error('[API] Sync push validation errors:', validationErrors);
      return NextResponse.json<SyncPushResponse>(
        {
          success: false,
          errors: validationErrors,
          synced: {
            sales: [],
            saleItems: [],
            expenses: [],
            stockMovements: [],
            products: [],
            productBatches: [],
            suppliers: [],
            supplierOrders: [],
            supplierOrderItems: [],
            supplierReturns: [],
            productSuppliers: [],
            creditPayments: [],
            stockoutReports: [],
            salePrescriptions: [],
          },
        },
        { status: 400 }
      );
    }

    console.log('[API] Sync push request from:', user.userId);
    console.log('[API] Items to sync:', {
      sales: sales?.length || 0,
      saleItems: saleItems?.length || 0,
      expenses: expenses?.length || 0,
      stockMovements: stockMovements?.length || 0,
      products: products?.length || 0,
      suppliers: suppliers?.length || 0,
      supplierOrders: supplierOrders?.length || 0,
      supplierOrderItems: supplierOrderItems?.length || 0,
      supplierReturns: supplierReturns?.length || 0,
      productSuppliers: productSuppliers?.length || 0,
      creditPayments: creditPayments?.length || 0,
    });

    // Phase 2: Implement server-side sync
    // UUID migration: Track synced IDs (same ID on client and server)
    const syncedSales: string[] = [];
    const syncedSaleItems: string[] = [];
    const syncedExpenses: string[] = [];
    const syncedStockMovements: string[] = [];
    const syncedProducts: string[] = [];
    const syncedProductBatches: string[] = [];
    const syncedSuppliers: string[] = [];
    const syncedSupplierOrders: string[] = [];
    const syncedSupplierOrderItems: string[] = [];
    const syncedSupplierReturns: string[] = [];
    const syncedProductSuppliers: string[] = [];
    const syncedCreditPayments: string[] = [];
    const syncedStockoutReports: string[] = [];
    const syncedSalePrescriptions: string[] = [];
    const errors: string[] = [];

    // Sync Sales (with nested sale items)
    if (sales && sales.length > 0) {
      for (const sale of sales) {
        try {
          // 🆕 Check idempotency key first (prevent duplicates on retry)
          if (sale.idempotencyKey) {
            const existingKey = await prisma.syncIdempotencyKey.findUnique({
              where: { idempotencyKey: sale.idempotencyKey },
            });

            if (existingKey) {
              // Already processed - return existing ID
              syncedSales.push(sale.id);
              console.log(`[API] Sale ${sale.id} already synced (idempotency key: ${sale.idempotencyKey})`);
              continue; // Skip creation
            }
          }

          // UUID migration: Check if sale already exists by its ID
          // (same ID on client and server)
          let existingSale = await prisma.sale.findUnique({
            where: { id: sale.id },
          });

          if (existingSale) {
            // Conflict: check if server version is newer
            const serverUpdatedAt = existingSale.modifiedAt || existingSale.createdAt;
            const localUpdatedAt = sale.modified_at || sale.created_at;
            
            if (localUpdatedAt && serverUpdatedAt && new Date(localUpdatedAt) > serverUpdatedAt) {
              // Local is newer - update server
              const updatedSale = await prisma.sale.update({
                where: { id: existingSale.id },
                data: {
                  total: sale.total,
                  paymentMethod: sale.payment_method,
                  paymentStatus: sale.payment_status,
                  paymentRef: sale.payment_ref,
                  amountPaid: sale.amount_paid,
                  amountDue: sale.amount_due,
                  dueDate: sale.due_date ? new Date(sale.due_date) : null,
                  customerName: sale.customer_name,
                  customerPhone: sale.customer_phone,
                  modifiedAt: sale.modified_at ? new Date(sale.modified_at) : new Date(),
                  modifiedBy: sale.modified_by || user.userId,
                  editCount: sale.edit_count || 0,
                },
              });
              syncedSales.push(sale.id);
            } else {
              // Server wins - use existing ID
              syncedSales.push(sale.id);
            }
          } else {
            // New sale - create with client-generated UUID
            const newSale = await prisma.sale.create({
              data: {
                id: sale.id, // UUID migration: use client-generated ID
                total: sale.total,
                paymentMethod: sale.payment_method,
                paymentStatus: sale.payment_status,
                paymentRef: sale.payment_ref,
                amountPaid: sale.amount_paid,
                amountDue: sale.amount_due,
                dueDate: sale.due_date ? new Date(sale.due_date) : null,
                customerName: sale.customer_name,
                customerPhone: sale.customer_phone,
                createdAt: sale.created_at ? new Date(sale.created_at) : new Date(),
                userId: user.userId,
                modifiedAt: sale.modified_at ? new Date(sale.modified_at) : null,
                modifiedBy: sale.modified_by,
                editCount: sale.edit_count || 0,
                // Note: Sale items will be synced separately if provided
              },
            });
            syncedSales.push(sale.id);

            // 🆕 Store idempotency key (24h TTL)
            if (sale.idempotencyKey) {
              await prisma.syncIdempotencyKey.create({
                data: {
                  idempotencyKey: sale.idempotencyKey,
                  entityType: 'SALE',
                  entityId: newSale.id,
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              });
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync sale ${sale.id}: ${errorMsg}`);
          console.error('[API] Sale sync error:', error);
        }
      }
    }

    // Sync Sale Items
    if (saleItems && saleItems.length > 0) {
      for (const item of saleItems) {
        try {
          // Check if sale item already exists
          let existingItem = null;
          if (item.id) {
            existingItem = await prisma.saleItem.findUnique({
              where: { id: item.id },
            });
          }

          if (!existingItem) {
            // Verify the referenced product exists
            const productExists = await prisma.product.findUnique({
              where: { id: item.product_id },
              select: { id: true },
            });

            if (!productExists) {
              console.error(`[API] Product ${item.product_id} not found for sale item ${item.id}`);
              errors.push(`Product ${item.product_id} not found for sale item ${item.id}`);
              continue; // Skip this sale item
            }

            // UUID migration: sale_id is already the correct ID
            // Create new sale item with client-generated UUID
            const newItem = await prisma.saleItem.create({
              data: {
                id: item.id, // UUID migration: use client-generated ID
                saleId: item.sale_id,
                productId: item.product_id,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                subtotal: item.subtotal,
              },
            });
            syncedSaleItems.push(item.id);
          } else {
            // Item already exists
            syncedSaleItems.push(item.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync sale item ${item.id}: ${errorMsg}`);
          console.error('[API] Sale item sync error:', error);
        }
      }
    }

    // Sync Expenses
    if (expenses && expenses.length > 0) {
      for (const expense of expenses) {
        try {
          // 🆕 Check idempotency key first
          if (expense.idempotencyKey) {
            const existingKey = await prisma.syncIdempotencyKey.findUnique({
              where: { idempotencyKey: expense.idempotencyKey },
            });

            if (existingKey) {
              syncedExpenses.push(expense.id);
              console.log(`[API] Expense ${expense.id} already synced (idempotency key: ${expense.idempotencyKey})`);
              continue;
            }
          }

          // UUID migration: Check if expense already exists by its ID
          let existingExpense = await prisma.expense.findUnique({
            where: { id: expense.id },
          });

          if (existingExpense) {
            // Conflict resolution: last write wins
            const serverDate = existingExpense.date;
            const localDate = new Date(expense.date);

            if (localDate > serverDate) {
              await prisma.expense.update({
                where: { id: expense.id },
                data: {
                  amount: expense.amount,
                  category: expense.category,
                  description: expense.description,
                  date: localDate,
                },
              });
            }
            syncedExpenses.push(expense.id);
          } else {
            await prisma.expense.create({
              data: {
                id: expense.id, // UUID migration: use client-generated ID
                amount: expense.amount,
                category: expense.category,
                description: expense.description,
                date: expense.date ? new Date(expense.date) : new Date(),
                userId: user.userId,
              },
            });
            syncedExpenses.push(expense.id);

            // 🆕 Store idempotency key
            if (expense.idempotencyKey) {
              await prisma.syncIdempotencyKey.create({
                data: {
                  idempotencyKey: expense.idempotencyKey,
                  entityType: 'EXPENSE',
                  entityId: expense.id, // UUID migration: use client-generated ID
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              });
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync expense ${expense.id}: ${errorMsg}`);
          console.error('[API] Expense sync error:', error);
        }
      }
    }

    // 🆕 Sync Stock Movements with server-side stock validation
    if (stockMovements && stockMovements.length > 0) {
      for (const movement of stockMovements) {
        try {
          // 🆕 Check idempotency key first
          if (movement.idempotencyKey) {
            const existingKey = await prisma.syncIdempotencyKey.findUnique({
              where: { idempotencyKey: movement.idempotencyKey },
            });

            if (existingKey) {
              syncedStockMovements.push(movement.id);
              console.log(`[API] Stock movement ${movement.id} already synced (idempotency key: ${movement.idempotencyKey})`);
              continue;
            }
          }

          // UUID migration: Check if movement already exists by its ID
          let existingMovement = await prisma.stockMovement.findUnique({
            where: { id: movement.id },
          });

          if (!existingMovement) {
            // UUID migration: product_id is already the correct ID
            const productId = movement.product_id;

            // 🆕 CRITICAL: Validate stock before applying movement
            if (movement.type === 'SALE' && movement.quantity_change < 0) {
              const product = await prisma.product.findUnique({
                where: { id: productId },
              });

              if (!product) {
                errors.push(`Produit ${productId} introuvable`);
                continue;
              }

              const newStock = product.stock + movement.quantity_change;

              if (newStock < 0) {
                // REJECT - insufficient stock
                errors.push(
                  `Stock insuffisant pour ${product.name}: ` +
                  `${product.stock} disponible, ${-movement.quantity_change} demandé. ` +
                  `Vente refusée.`
                );
                console.error(`[API] Stock validation failed for product ${product.id}: ${product.stock} + ${movement.quantity_change} = ${newStock}`);
                continue; // Don't create movement, don't mark as synced
              }

              // Stock OK - update product stock atomically
              await prisma.product.update({
                where: { id: productId },
                data: { stock: newStock },
              });
            }

            // Create stock movement record with client-generated ID
            await prisma.stockMovement.create({
              data: {
                id: movement.id, // UUID migration: use client-generated ID
                productId: productId,
                type: movement.type,
                quantityChange: movement.quantity_change,
                reason: movement.reason || null,
                createdAt: movement.created_at ? new Date(movement.created_at) : new Date(),
                userId: user.userId,
              },
            });
            syncedStockMovements.push(movement.id);

            // 🆕 Store idempotency key
            if (movement.idempotencyKey) {
              await prisma.syncIdempotencyKey.create({
                data: {
                  idempotencyKey: movement.idempotencyKey,
                  entityType: 'STOCK_MOVEMENT',
                  entityId: movement.id,
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              });
            }
          } else {
            syncedStockMovements.push(movement.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync stock movement ${movement.id}: ${errorMsg}`);
          console.error('[API] Stock movement sync error:', error);
        }
      }
    }

    // Sync Products - UUID migration: use client-generated ID
    if (products && products.length > 0) {
      for (const product of products) {
        try {
          // UUID migration: Check if product exists by its ID
          let existingProduct = await prisma.product.findUnique({
            where: { id: product.id },
          });

          if (existingProduct) {
            // Conflict: check timestamps
            const serverUpdatedAt = existingProduct.updatedAt;
            const localUpdatedAt = product.updatedAt ? new Date(product.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              await prisma.product.update({
                where: { id: product.id },
                data: {
                  name: product.name,
                  price: product.price,
                  priceBuy: product.priceBuy || null,
                  stock: product.stock,
                  minStock: product.minStock || 10,
                  category: product.category || null,
                  expirationDate: product.expirationDate ? new Date(product.expirationDate) : null,
                  lotNumber: product.lotNumber || null,
                },
              });
            }
            syncedProducts.push(product.id);
          } else {
            // New product - use client-generated ID
            await prisma.product.create({
              data: {
                id: product.id, // UUID migration: use client-generated ID
                name: product.name,
                price: product.price,
                priceBuy: product.priceBuy || null,
                stock: product.stock,
                minStock: product.minStock || 10,
                category: product.category || null,
                expirationDate: product.expirationDate ? new Date(product.expirationDate) : null,
                lotNumber: product.lotNumber || null,
              },
            });
            syncedProducts.push(product.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync product ${product.id}: ${errorMsg}`);
          console.error('[API] Product sync error:', error);
        }
      }
    }

    // Sync ProductBatches (FEFO tracking - Phase 3) - UUID migration
    if (productBatches && productBatches.length > 0) {
      for (const batch of productBatches) {
        try {
          // UUID migration: Check if batch exists by its ID
          let existingBatch = await prisma.productBatch.findUnique({
            where: { id: batch.id },
          });

          if (existingBatch) {
            // Conflict: check timestamps (Last Write Wins)
            const serverUpdatedAt = existingBatch.updatedAt;
            const localUpdatedAt = batch.updatedAt ? new Date(batch.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              console.log(`[API] ProductBatch ${batch.id}: Local wins`);
              await prisma.productBatch.update({
                where: { id: batch.id },
                data: {
                  productId: batch.product_id, // UUID migration: product_id is correct
                  lotNumber: batch.lot_number,
                  expirationDate: batch.expiration_date ? new Date(batch.expiration_date) : existingBatch.expirationDate,
                  quantity: batch.quantity,
                  initialQty: batch.initial_qty,
                  unitCost: batch.unit_cost || null,
                  supplierOrderId: batch.supplier_order_id || null,
                  receivedDate: batch.received_date ? new Date(batch.received_date) : existingBatch.receivedDate,
                },
              });
            }
            syncedProductBatches.push(batch.id);
          } else {
            // Verify the referenced product exists
            const productExists = await prisma.product.findUnique({
              where: { id: batch.product_id },
              select: { id: true },
            });

            if (!productExists) {
              console.error(`[API] Product ${batch.product_id} not found for batch ${batch.id}`);
              errors.push(`Product ${batch.product_id} not found for batch ${batch.id}`);
              continue; // Skip this batch
            }

            // New batch - use client-generated ID
            await prisma.productBatch.create({
              data: {
                id: batch.id, // UUID migration: use client-generated ID
                productId: batch.product_id, // UUID migration: product_id is correct
                lotNumber: batch.lot_number,
                expirationDate: batch.expiration_date ? new Date(batch.expiration_date) : new Date(),
                quantity: batch.quantity,
                initialQty: batch.initial_qty,
                unitCost: batch.unit_cost || null,
                supplierOrderId: batch.supplier_order_id || null,
                receivedDate: batch.received_date ? new Date(batch.received_date) : new Date(),
              },
            });
            syncedProductBatches.push(batch.id);
            console.log(`[API] Created new ProductBatch: ${batch.id} (lot: ${batch.lot_number})`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync product batch ${batch.id}: ${errorMsg}`);
          console.error('[API] ProductBatch sync error:', error);
        }
      }
    }

    // Sync Suppliers - UUID migration
    if (suppliers && suppliers.length > 0) {
      for (const supplier of suppliers) {
        try {
          // UUID migration: Check if supplier exists by its ID
          let existingSupplier = await prisma.supplier.findUnique({
            where: { id: supplier.id },
          });

          if (existingSupplier) {
            // Conflict: check timestamps
            const serverUpdatedAt = existingSupplier.updatedAt;
            const localUpdatedAt = supplier.updatedAt ? new Date(supplier.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              await prisma.supplier.update({
                where: { id: supplier.id },
                data: {
                  name: supplier.name,
                  phone: supplier.phone || null,
                  paymentTermsDays: supplier.paymentTermsDays,
                },
              });
            }
            syncedSuppliers.push(supplier.id);
          } else {
            // New supplier - use client-generated ID
            await prisma.supplier.create({
              data: {
                id: supplier.id, // UUID migration: use client-generated ID
                name: supplier.name,
                phone: supplier.phone || null,
                paymentTermsDays: supplier.paymentTermsDays,
              },
            });
            syncedSuppliers.push(supplier.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier ${supplier.id}: ${errorMsg}`);
          console.error('[API] Supplier sync error:', error);
        }
      }
    }

    // Sync Supplier Orders - UUID migration
    if (supplierOrders && supplierOrders.length > 0) {
      for (const order of supplierOrders) {
        try {
          // UUID migration: Check if order exists by its ID
          let existingOrder = await prisma.supplierOrder.findUnique({
            where: { id: order.id },
          });

          if (existingOrder) {
            // Conflict: check timestamps
            const serverUpdatedAt = existingOrder.updatedAt;
            const localUpdatedAt = order.updatedAt ? new Date(order.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              await prisma.supplierOrder.update({
                where: { id: order.id },
                data: {
                  supplierId: order.supplierId, // UUID migration: supplierId is correct
                  orderDate: order.orderDate ? new Date(order.orderDate) : undefined,
                  deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : null,
                  totalAmount: order.totalAmount,
                  calculatedTotal: order.calculatedTotal || null,
                  amountPaid: order.amountPaid,
                  dueDate: order.dueDate ? new Date(order.dueDate) : undefined,
                  status: order.status,
                  notes: order.notes || null,
                },
              });
            }
            syncedSupplierOrders.push(order.id);
          } else {
            // New order - use client-generated ID
            await prisma.supplierOrder.create({
              data: {
                id: order.id, // UUID migration: use client-generated ID
                supplierId: order.supplierId, // UUID migration: supplierId is correct
                orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
                deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : null,
                totalAmount: order.totalAmount,
                calculatedTotal: order.calculatedTotal || null,
                amountPaid: order.amountPaid,
                dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
                status: order.status,
                notes: order.notes || null,
              },
            });
            syncedSupplierOrders.push(order.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier order ${order.id}: ${errorMsg}`);
          console.error('[API] Supplier order sync error:', error);
        }
      }
    }

    // Sync Supplier Order Items - UUID migration
    if (supplierOrderItems && supplierOrderItems.length > 0) {
      for (const item of supplierOrderItems) {
        try {
          // UUID migration: Check if item exists by its ID
          let existingItem = await prisma.supplierOrderItem.findUnique({
            where: { id: item.id },
          });

          if (!existingItem) {
            // New order item - use client-generated ID
            await prisma.supplierOrderItem.create({
              data: {
                id: item.id, // UUID migration: use client-generated ID
                orderId: item.order_id, // UUID migration: order_id is correct
                productId: item.product_id || null,
                productName: item.product_name,
                category: item.category || null,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                subtotal: item.subtotal,
                notes: item.notes || null,
              },
            });
            syncedSupplierOrderItems.push(item.id);
          } else {
            syncedSupplierOrderItems.push(item.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier order item ${item.id}: ${errorMsg}`);
          console.error('[API] Supplier order item sync error:', error);
        }
      }
    }

    // Sync Supplier Returns - UUID migration
    if (supplierReturns && supplierReturns.length > 0) {
      for (const returnItem of supplierReturns) {
        try {
          // UUID migration: Check if return exists by its ID
          let existingReturn = await prisma.supplierReturn.findUnique({
            where: { id: returnItem.id },
          });

          if (!existingReturn) {
            // New return - use client-generated ID
            await prisma.supplierReturn.create({
              data: {
                id: returnItem.id, // UUID migration: use client-generated ID
                supplierId: returnItem.supplierId, // UUID migration: supplierId is correct
                supplierOrderId: returnItem.supplierOrderId || null,
                productId: returnItem.productId,
                quantity: returnItem.quantity,
                reason: returnItem.reason,
                creditAmount: returnItem.creditAmount,
                returnDate: returnItem.returnDate ? new Date(returnItem.returnDate) : new Date(),
                applied: returnItem.applied,
                appliedToOrderId: returnItem.appliedToOrderId || null,
              },
            });
            syncedSupplierReturns.push(returnItem.id);
          } else {
            // Update existing if local is newer
            await prisma.supplierReturn.update({
              where: { id: returnItem.id },
              data: {
                applied: returnItem.applied,
                appliedToOrderId: returnItem.appliedToOrderId || null,
              },
            });
            syncedSupplierReturns.push(returnItem.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier return ${returnItem.id}: ${errorMsg}`);
          console.error('[API] Supplier return sync error:', error);
        }
      }
    }

    // Sync Product-Supplier Links - UUID migration
    if (productSuppliers && productSuppliers.length > 0) {
      for (const link of productSuppliers) {
        try {
          // UUID migration: Check if link exists by its ID
          let existingLink = await prisma.productSupplier.findUnique({
            where: { id: link.id },
          });

          // Also check by unique constraint (productId + supplierId)
          if (!existingLink) {
            existingLink = await prisma.productSupplier.findUnique({
              where: {
                productId_supplierId: {
                  productId: link.product_id, // UUID migration: product_id is correct
                  supplierId: link.supplier_id, // UUID migration: supplier_id is correct
                },
              },
            });
          }

          if (!existingLink) {
            // New link - use client-generated ID
            await prisma.productSupplier.create({
              data: {
                id: link.id, // UUID migration: use client-generated ID
                productId: link.product_id, // UUID migration: product_id is correct
                supplierId: link.supplier_id, // UUID migration: supplier_id is correct
                supplierProductCode: link.supplier_product_code || null,
                supplierProductName: link.supplier_product_name || null,
                defaultPrice: link.default_price || null,
                isPrimary: link.is_primary,
                lastOrderedDate: link.last_ordered_date ? new Date(link.last_ordered_date) : null,
              },
            });
            syncedProductSuppliers.push(link.id);
          } else {
            // Update existing
            await prisma.productSupplier.update({
              where: { id: existingLink.id },
              data: {
                supplierProductCode: link.supplier_product_code || null,
                supplierProductName: link.supplier_product_name || null,
                defaultPrice: link.default_price || null,
                isPrimary: link.is_primary,
                lastOrderedDate: link.last_ordered_date ? new Date(link.last_ordered_date) : null,
              },
            });
            syncedProductSuppliers.push(link.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync product-supplier link ${link.id}: ${errorMsg}`);
          console.error('[API] Product-supplier sync error:', error);
        }
      }
    }

    // Sync Credit Payments - UUID migration
    if (creditPayments && creditPayments.length > 0) {
      for (const payment of creditPayments) {
        try {
          // UUID migration: Check if payment exists by its ID
          let existingPayment = await prisma.creditPayment.findUnique({
            where: { id: payment.id },
          });

          if (!existingPayment) {
            // New payment - use client-generated ID
            await prisma.creditPayment.create({
              data: {
                id: payment.id, // UUID migration: use client-generated ID
                saleId: payment.sale_id, // UUID migration: sale_id is correct
                amount: payment.amount,
                method: payment.payment_method,
                reference: payment.payment_ref || null,
                notes: payment.notes || null,
                createdAt: payment.payment_date ? new Date(payment.payment_date) : new Date(),
                recordedBy: user.userId,
              },
            });
            syncedCreditPayments.push(payment.id);
          } else {
            syncedCreditPayments.push(payment.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync credit payment ${payment.id}: ${errorMsg}`);
          console.error('[API] Credit payment sync error:', error);
        }
      }
    }

    // Sync Stockout Reports - Phase 4
    if (stockoutReports && stockoutReports.length > 0) {
      for (const report of stockoutReports) {
        try {
          // Check if report exists by its ID
          const existingReport = await prisma.stockoutReport.findUnique({
            where: { id: report.id },
          });

          if (!existingReport) {
            // New report - use client-generated ID
            await prisma.stockoutReport.create({
              data: {
                id: report.id,
                productName: report.product_name,
                productId: report.product_id || null,
                requestedQty: report.requested_qty,
                customerName: report.customer_name || null,
                customerPhone: report.customer_phone || null,
                notes: report.notes || null,
                reportedBy: report.reported_by || user.userId,
                createdAt: report.created_at ? new Date(report.created_at) : new Date(),
              },
            });
            syncedStockoutReports.push(report.id);
          } else {
            // Already exists
            syncedStockoutReports.push(report.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync stockout report ${report.id}: ${errorMsg}`);
          console.error('[API] Stockout report sync error:', error);
        }
      }
    }

    // Sync Sale Prescriptions - Phase 4
    if (salePrescriptions && salePrescriptions.length > 0) {
      for (const prescription of salePrescriptions) {
        try {
          // Check if prescription exists by its ID
          const existingPrescription = await prisma.salePrescription.findUnique({
            where: { id: prescription.id },
          });

          if (!existingPrescription) {
            // New prescription - use client-generated ID
            await prisma.salePrescription.create({
              data: {
                id: prescription.id,
                saleId: prescription.sale_id,
                imageData: prescription.image_data,
                imageType: prescription.image_type,
                capturedAt: prescription.captured_at ? new Date(prescription.captured_at) : new Date(),
                notes: prescription.notes || null,
              },
            });
            syncedSalePrescriptions.push(prescription.id);
          } else {
            // Already exists
            syncedSalePrescriptions.push(prescription.id);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync sale prescription ${prescription.id}: ${errorMsg}`);
          console.error('[API] Sale prescription sync error:', error);
        }
      }
    }

    return NextResponse.json<SyncPushResponse>({
      success: true,
      synced: {
        sales: syncedSales,
        saleItems: syncedSaleItems,
        expenses: syncedExpenses,
        stockMovements: syncedStockMovements,
        products: syncedProducts,
        productBatches: syncedProductBatches,
        suppliers: syncedSuppliers,
        supplierOrders: syncedSupplierOrders,
        supplierOrderItems: syncedSupplierOrderItems,
        supplierReturns: syncedSupplierReturns,
        productSuppliers: syncedProductSuppliers,
        creditPayments: syncedCreditPayments,
        stockoutReports: syncedStockoutReports,
        salePrescriptions: syncedSalePrescriptions,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
    /*
    const syncedSales: number[] = [];
    const syncedExpenses: number[] = [];
    const syncedStockMovements: number[] = [];
    const syncedProducts: number[] = [];
    const syncedSuppliers: number[] = [];
    const syncedSupplierOrders: number[] = [];
    const syncedSupplierReturns: number[] = [];
    const errors: string[] = [];

    // Sync sales
    if (sales && sales.length > 0) {
      for (const sale of sales) {
        try {
          const result = await prisma.sale.create({
            data: {
              total: sale.total,
              paymentMethod: sale.payment_method,
              paymentRef: sale.payment_ref,
              userId: user.userId,
              createdAt: sale.created_at,
            },
          });
          syncedSales.push(sale.id!);
        } catch (error) {
          errors.push(`Failed to sync sale ${sale.id}: ${error.message}`);
        }
      }
    }

    // Sync expenses (similar pattern)
    // Sync stock movements (similar pattern)
    // Sync products (similar pattern)

    // Sync suppliers
    if (suppliers && suppliers.length > 0) {
      for (const supplier of suppliers) {
        try {
          const result = await prisma.supplier.create({
            data: {
              name: supplier.name,
              phone: supplier.phone,
              paymentTermsDays: supplier.paymentTermsDays,
              createdAt: supplier.createdAt,
              updatedAt: supplier.updatedAt,
            },
          });
          syncedSuppliers.push(supplier.id!);
        } catch (error) {
          errors.push(`Failed to sync supplier ${supplier.id}: ${error.message}`);
        }
      }
    }

    // Sync supplier orders
    if (supplierOrders && supplierOrders.length > 0) {
      for (const order of supplierOrders) {
        try {
          const result = await prisma.supplierOrder.create({
            data: {
              supplierId: order.supplierId,
              orderDate: order.orderDate,
              deliveryDate: order.deliveryDate,
              totalAmount: order.totalAmount,
              amountPaid: order.amountPaid,
              dueDate: order.dueDate,
              status: order.status,
              notes: order.notes,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
            },
          });
          syncedSupplierOrders.push(order.id!);
        } catch (error) {
          errors.push(`Failed to sync supplier order ${order.id}: ${error.message}`);
        }
      }
    }

    // Sync supplier returns
    if (supplierReturns && supplierReturns.length > 0) {
      for (const returnItem of supplierReturns) {
        try {
          const result = await prisma.supplierReturn.create({
            data: {
              supplierId: returnItem.supplierId,
              productId: returnItem.productId,
              quantity: returnItem.quantity,
              reason: returnItem.reason,
              creditAmount: returnItem.creditAmount,
              returnDate: returnItem.returnDate,
              applied: returnItem.applied,
              appliedToOrderId: returnItem.appliedToOrderId,
              createdAt: returnItem.createdAt,
            },
          });
          syncedSupplierReturns.push(returnItem.id!);
        } catch (error) {
          errors.push(`Failed to sync supplier return ${returnItem.id}: ${error.message}`);
        }
      }
    }

    return NextResponse.json<SyncPushResponse>({
      success: true,
      synced: {
        sales: syncedSales,
        expenses: syncedExpenses,
        stockMovements: syncedStockMovements,
        products: syncedProducts,
        suppliers: syncedSuppliers,
        supplierOrders: syncedSupplierOrders,
        supplierReturns: syncedSupplierReturns,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
    */
  } catch (error) {
    console.error('[API] Sync push error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SyncPushResponse>(
        {
          success: false,
          synced: {
            sales: [],
            saleItems: [],
            expenses: [],
            stockMovements: [],
            products: [],
            productBatches: [],
            suppliers: [],
            supplierOrders: [],
            supplierOrderItems: [],
            supplierReturns: [],
            productSuppliers: [],
            creditPayments: [],
            stockoutReports: [],
            salePrescriptions: [],
          },
          errors: ['Non autorisé'],
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SyncPushResponse>(
      {
        success: false,
        synced: {
          sales: [],
          saleItems: [],
          expenses: [],
          stockMovements: [],
          products: [],
          productBatches: [],
          suppliers: [],
          supplierOrders: [],
          supplierOrderItems: [],
          supplierReturns: [],
          productSuppliers: [],
          creditPayments: [],
          stockoutReports: [],
          salePrescriptions: [],
        },
        errors: ['Erreur serveur'],
      },
      { status: 500 }
    );
  }
}
