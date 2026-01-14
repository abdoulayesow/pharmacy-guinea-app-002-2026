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

    // Parse request body
    const body: SyncPushRequest = await request.json();
    const { sales, expenses, stockMovements, products, suppliers, supplierOrders, supplierOrderItems, supplierReturns, productSuppliers, creditPayments } = body;

    console.log('[API] Sync push request from:', user.userId);
    console.log('[API] Items to sync:', {
      sales: sales?.length || 0,
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
    const syncedSales: Record<string, number> = {}; // Map localId -> serverId
    const syncedExpenses: Record<string, number> = {};
    const syncedStockMovements: Record<string, number> = {};
    const syncedProducts: Record<string, number> = {};
    const syncedSuppliers: Record<string, number> = {};
    const syncedSupplierOrders: Record<string, number> = {};
    const syncedSupplierOrderItems: Record<string, number> = {};
    const syncedSupplierReturns: Record<string, number> = {};
    const syncedProductSuppliers: Record<string, number> = {};
    const syncedCreditPayments: Record<string, number> = {};
    const errors: string[] = [];

    // Sync Sales (with nested sale items)
    if (sales && sales.length > 0) {
      for (const sale of sales) {
        try {
          // Check if sale already exists (by serverId if provided)
          let existingSale = null;
          if (sale.serverId) {
            existingSale = await prisma.sale.findUnique({
              where: { id: sale.serverId },
            });
          }

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
              syncedSales[sale.id?.toString() || ''] = updatedSale.id;
            } else {
              // Server wins - use existing ID
              syncedSales[sale.id?.toString() || ''] = existingSale.id;
            }
          } else {
            // New sale - create with nested items
            const newSale = await prisma.sale.create({
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
                createdAt: sale.created_at ? new Date(sale.created_at) : new Date(),
                userId: user.userId,
                modifiedAt: sale.modified_at ? new Date(sale.modified_at) : null,
                modifiedBy: sale.modified_by,
                editCount: sale.edit_count || 0,
                // Note: Sale items will be synced separately if provided
              },
            });
            syncedSales[sale.id?.toString() || ''] = newSale.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync sale ${sale.id}: ${errorMsg}`);
          console.error('[API] Sale sync error:', error);
        }
      }
    }

    // Sync Expenses
    if (expenses && expenses.length > 0) {
      for (const expense of expenses) {
        try {
          let existingExpense = null;
          if (expense.serverId) {
            existingExpense = await prisma.expense.findUnique({
              where: { id: expense.serverId },
            });
          }

          if (existingExpense) {
            // Conflict resolution: last write wins
            const serverDate = existingExpense.date;
            const localDate = new Date(expense.date);
            
            if (localDate > serverDate) {
              const updated = await prisma.expense.update({
                where: { id: existingExpense.id },
                data: {
                  amount: expense.amount,
                  category: expense.category,
                  description: expense.description,
                  date: localDate,
                },
              });
              syncedExpenses[expense.id?.toString() || ''] = updated.id;
            } else {
              syncedExpenses[expense.id?.toString() || ''] = existingExpense.id;
            }
          } else {
            const newExpense = await prisma.expense.create({
              data: {
                amount: expense.amount,
                category: expense.category,
                description: expense.description,
                date: expense.date ? new Date(expense.date) : new Date(),
                userId: user.userId,
              },
            });
            syncedExpenses[expense.id?.toString() || ''] = newExpense.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync expense ${expense.id}: ${errorMsg}`);
          console.error('[API] Expense sync error:', error);
        }
      }
    }

    // Sync Stock Movements
    if (stockMovements && stockMovements.length > 0) {
      for (const movement of stockMovements) {
        try {
          let existingMovement = null;
          if (movement.serverId) {
            existingMovement = await prisma.stockMovement.findUnique({
              where: { id: movement.serverId },
            });
          }

          if (!existingMovement) {
            const newMovement = await prisma.stockMovement.create({
              data: {
                productId: movement.product_id,
                type: movement.type,
                quantityChange: movement.quantity_change,
                reason: movement.reason || null,
                createdAt: movement.created_at ? new Date(movement.created_at) : new Date(),
                userId: user.userId,
              },
            });
            syncedStockMovements[movement.id?.toString() || ''] = newMovement.id;
          } else {
            syncedStockMovements[movement.id?.toString() || ''] = existingMovement.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync stock movement ${movement.id}: ${errorMsg}`);
          console.error('[API] Stock movement sync error:', error);
        }
      }
    }

    // Sync Products (upsert by name or serverId)
    if (products && products.length > 0) {
      for (const product of products) {
        try {
          let existingProduct = null;
          
          // Try to find by serverId first
          if (product.serverId) {
            existingProduct = await prisma.product.findUnique({
              where: { id: product.serverId },
            });
          }
          
          // If not found, try to find by name
          if (!existingProduct && product.name) {
            const productsByName = await prisma.product.findMany({
              where: { name: product.name },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            });
            existingProduct = productsByName[0] || null;
          }

          if (existingProduct) {
            // Conflict: check timestamps
            const serverUpdatedAt = existingProduct.updatedAt;
            const localUpdatedAt = product.updatedAt ? new Date(product.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              const updated = await prisma.product.update({
                where: { id: existingProduct.id },
                data: {
                  name: product.name,
                  price: product.price,
                  priceBuy: product.priceBuy || null,
                  stock: product.stock,
                  stockMin: product.minStock || 10,
                  category: product.category || null,
                },
              });
              syncedProducts[product.id?.toString() || ''] = updated.id;
            } else {
              syncedProducts[product.id?.toString() || ''] = existingProduct.id;
            }
          } else {
            // New product
            const newProduct = await prisma.product.create({
              data: {
                name: product.name,
                price: product.price,
                priceBuy: product.priceBuy || null,
                stock: product.stock,
                stockMin: product.minStock || 10,
                category: product.category || null,
              },
            });
            syncedProducts[product.id?.toString() || ''] = newProduct.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync product ${product.id}: ${errorMsg}`);
          console.error('[API] Product sync error:', error);
        }
      }
    }

    // Sync Suppliers
    if (suppliers && suppliers.length > 0) {
      for (const supplier of suppliers) {
        try {
          let existingSupplier = null;

          // Try to find by serverId first
          if (supplier.serverId) {
            existingSupplier = await prisma.supplier.findUnique({
              where: { id: supplier.serverId },
            });
          }

          // If not found, try to find by name
          if (!existingSupplier && supplier.name) {
            const suppliersByName = await prisma.supplier.findMany({
              where: { name: supplier.name },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            });
            existingSupplier = suppliersByName[0] || null;
          }

          if (existingSupplier) {
            // Conflict: check timestamps
            const serverUpdatedAt = existingSupplier.updatedAt;
            const localUpdatedAt = supplier.updatedAt ? new Date(supplier.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              const updated = await prisma.supplier.update({
                where: { id: existingSupplier.id },
                data: {
                  name: supplier.name,
                  phone: supplier.phone || null,
                  paymentTermsDays: supplier.paymentTermsDays,
                },
              });
              syncedSuppliers[supplier.id?.toString() || ''] = updated.id;
            } else {
              syncedSuppliers[supplier.id?.toString() || ''] = existingSupplier.id;
            }
          } else {
            // New supplier
            const newSupplier = await prisma.supplier.create({
              data: {
                name: supplier.name,
                phone: supplier.phone || null,
                paymentTermsDays: supplier.paymentTermsDays,
              },
            });
            syncedSuppliers[supplier.id?.toString() || ''] = newSupplier.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier ${supplier.id}: ${errorMsg}`);
          console.error('[API] Supplier sync error:', error);
        }
      }
    }

    // Sync Supplier Orders
    if (supplierOrders && supplierOrders.length > 0) {
      for (const order of supplierOrders) {
        try {
          // Find the supplier serverId (should already be synced)
          const supplierServerId = syncedSuppliers[order.supplierId?.toString() || ''] || order.supplierId;

          let existingOrder = null;
          if (order.serverId) {
            existingOrder = await prisma.supplierOrder.findUnique({
              where: { id: order.serverId },
            });
          }

          if (existingOrder) {
            // Conflict: check timestamps
            const serverUpdatedAt = existingOrder.updatedAt;
            const localUpdatedAt = order.updatedAt ? new Date(order.updatedAt) : null;

            if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
              // Local is newer - update
              const updated = await prisma.supplierOrder.update({
                where: { id: existingOrder.id },
                data: {
                  supplierId: supplierServerId,
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
              syncedSupplierOrders[order.id?.toString() || ''] = updated.id;
            } else {
              syncedSupplierOrders[order.id?.toString() || ''] = existingOrder.id;
            }
          } else {
            // New order
            const newOrder = await prisma.supplierOrder.create({
              data: {
                supplierId: supplierServerId,
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
            syncedSupplierOrders[order.id?.toString() || ''] = newOrder.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier order ${order.id}: ${errorMsg}`);
          console.error('[API] Supplier order sync error:', error);
        }
      }
    }

    // Sync Supplier Order Items
    if (supplierOrderItems && supplierOrderItems.length > 0) {
      for (const item of supplierOrderItems) {
        try {
          // Find the order serverId (should already be synced)
          const orderServerId = syncedSupplierOrders[item.order_id?.toString() || ''] || item.order_id;

          let existingItem = null;
          if (item.serverId) {
            existingItem = await prisma.supplierOrderItem.findUnique({
              where: { id: item.serverId },
            });
          }

          if (!existingItem) {
            // New order item
            const newItem = await prisma.supplierOrderItem.create({
              data: {
                orderId: orderServerId,
                productId: item.product_id || null,
                productName: item.product_name,
                category: item.category || null,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                subtotal: item.subtotal,
                notes: item.notes || null,
              },
            });
            syncedSupplierOrderItems[item.id?.toString() || ''] = newItem.id;
          } else {
            syncedSupplierOrderItems[item.id?.toString() || ''] = existingItem.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier order item ${item.id}: ${errorMsg}`);
          console.error('[API] Supplier order item sync error:', error);
        }
      }
    }

    // Sync Supplier Returns
    if (supplierReturns && supplierReturns.length > 0) {
      for (const returnItem of supplierReturns) {
        try {
          // Find the supplier serverId
          const supplierServerId = syncedSuppliers[returnItem.supplierId?.toString() || ''] || returnItem.supplierId;
          const appliedToOrderServerId = returnItem.appliedToOrderId
            ? (syncedSupplierOrders[returnItem.appliedToOrderId.toString()] || returnItem.appliedToOrderId)
            : null;

          let existingReturn = null;
          if (returnItem.serverId) {
            existingReturn = await prisma.supplierReturn.findUnique({
              where: { id: returnItem.serverId },
            });
          }

          if (!existingReturn) {
            // New return
            const newReturn = await prisma.supplierReturn.create({
              data: {
                supplierId: supplierServerId,
                supplierOrderId: returnItem.supplierOrderId || null,
                productId: returnItem.productId,
                quantity: returnItem.quantity,
                reason: returnItem.reason,
                creditAmount: returnItem.creditAmount,
                returnDate: returnItem.returnDate ? new Date(returnItem.returnDate) : new Date(),
                applied: returnItem.applied,
                appliedToOrderId: appliedToOrderServerId,
              },
            });
            syncedSupplierReturns[returnItem.id?.toString() || ''] = newReturn.id;
          } else {
            // Update existing if local is newer
            const updated = await prisma.supplierReturn.update({
              where: { id: existingReturn.id },
              data: {
                applied: returnItem.applied,
                appliedToOrderId: appliedToOrderServerId,
              },
            });
            syncedSupplierReturns[returnItem.id?.toString() || ''] = updated.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync supplier return ${returnItem.id}: ${errorMsg}`);
          console.error('[API] Supplier return sync error:', error);
        }
      }
    }

    // Sync Product-Supplier Links
    if (productSuppliers && productSuppliers.length > 0) {
      for (const link of productSuppliers) {
        try {
          // Find the product and supplier serverIds
          const productServerId = syncedProducts[link.product_id?.toString() || ''] || link.product_id;
          const supplierServerId = syncedSuppliers[link.supplier_id?.toString() || ''] || link.supplier_id;

          let existingLink = null;
          if (link.serverId) {
            existingLink = await prisma.productSupplier.findUnique({
              where: { id: link.serverId },
            });
          }

          // Also check by unique constraint (productId + supplierId)
          if (!existingLink) {
            existingLink = await prisma.productSupplier.findUnique({
              where: {
                productId_supplierId: {
                  productId: productServerId,
                  supplierId: supplierServerId,
                },
              },
            });
          }

          if (!existingLink) {
            // New link
            const newLink = await prisma.productSupplier.create({
              data: {
                productId: productServerId,
                supplierId: supplierServerId,
                supplierProductCode: link.supplier_product_code || null,
                supplierProductName: link.supplier_product_name || null,
                defaultPrice: link.default_price || null,
                isPrimary: link.is_primary,
                lastOrderedDate: link.last_ordered_date ? new Date(link.last_ordered_date) : null,
              },
            });
            syncedProductSuppliers[link.id?.toString() || ''] = newLink.id;
          } else {
            // Update existing
            const updated = await prisma.productSupplier.update({
              where: { id: existingLink.id },
              data: {
                supplierProductCode: link.supplier_product_code || null,
                supplierProductName: link.supplier_product_name || null,
                defaultPrice: link.default_price || null,
                isPrimary: link.is_primary,
                lastOrderedDate: link.last_ordered_date ? new Date(link.last_ordered_date) : null,
              },
            });
            syncedProductSuppliers[link.id?.toString() || ''] = updated.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync product-supplier link ${link.id}: ${errorMsg}`);
          console.error('[API] Product-supplier sync error:', error);
        }
      }
    }

    // Sync Credit Payments
    if (creditPayments && creditPayments.length > 0) {
      for (const payment of creditPayments) {
        try {
          // Find sale by serverId (should already be synced)
          const saleServerId = syncedSales[payment.sale_id?.toString() || ''];
          if (!saleServerId) {
            errors.push(`Credit payment ${payment.id} references unsynced sale ${payment.sale_id}`);
            continue;
          }

          let existingPayment = null;
          if (payment.serverId) {
            existingPayment = await prisma.creditPayment.findUnique({
              where: { id: payment.serverId },
            });
          }

          if (!existingPayment) {
            const newPayment = await prisma.creditPayment.create({
              data: {
                saleId: saleServerId,
                amount: payment.amount,
                method: payment.payment_method,
                reference: payment.payment_ref || null,
                notes: payment.notes || null,
                createdAt: payment.payment_date ? new Date(payment.payment_date) : new Date(),
                recordedBy: user.userId,
              },
            });
            syncedCreditPayments[payment.id?.toString() || ''] = newPayment.id;
          } else {
            syncedCreditPayments[payment.id?.toString() || ''] = existingPayment.id;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to sync credit payment ${payment.id}: ${errorMsg}`);
          console.error('[API] Credit payment sync error:', error);
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
        supplierOrderItems: syncedSupplierOrderItems,
        supplierReturns: syncedSupplierReturns,
        productSuppliers: syncedProductSuppliers,
        creditPayments: syncedCreditPayments,
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
            sales: {},
            expenses: {},
            stockMovements: {},
            products: {},
            suppliers: {},
            supplierOrders: {},
            supplierOrderItems: {},
            supplierReturns: {},
            productSuppliers: {},
            creditPayments: {},
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
          sales: {},
          expenses: {},
          stockMovements: {},
          products: {},
          suppliers: {},
          supplierOrders: {},
          supplierOrderItems: {},
          supplierReturns: {},
          productSuppliers: {},
          creditPayments: {},
        },
        errors: ['Erreur serveur'],
      },
      { status: 500 }
    );
  }
}
