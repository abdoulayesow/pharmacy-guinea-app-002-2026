# Current State: Stock & Supplier Management

## Overview

This document explains what currently exists in the stock and supplier management system, with visual diagrams showing data flows and relationships.

---

## 1. Data Model Relationships

```mermaid
erDiagram
    Supplier ||--o{ SupplierOrder : "has"
    SupplierOrder ||--o{ Expense : "generates"
    Product ||--o{ StockMovement : "tracks"
    Product ||--o{ SaleItem : "sold in"
    Sale ||--o{ SaleItem : "contains"
    User ||--o{ Sale : "creates"
    User ||--o{ StockMovement : "records"
    User ||--o{ Expense : "records"
    
    Supplier {
        number id
        string name
        string phone
        number paymentTermsDays
        date createdAt
    }
    
    SupplierOrder {
        number id
        number supplierId
        date orderDate
        date deliveryDate
        number totalAmount
        number amountPaid
        date dueDate
        string status
        string notes
    }
    
    Product {
        number id
        string name
        number price
        number stock
        number minStock
        date expirationDate
    }
    
    StockMovement {
        number id
        number product_id
        string type
        number quantity_change
        string reason
        date created_at
        string user_id
    }
    
    Sale {
        number id
        number total
        string payment_method
        date created_at
        string user_id
    }
    
    SaleItem {
        number id
        number sale_id
        number product_id
        number quantity
        number unit_price
    }
```

**Key Observations:**
- ✅ `SupplierOrder` exists but has NO relationship to `Product` or `StockMovement`
- ✅ `StockMovement` tracks stock changes but has NO link to `SupplierOrder`
- ❌ **Missing**: `SupplierOrderItem` table (orders don't have product breakdown)

---

## 2. Stock Management Flow (Current)

### 2.1 Stock Decreases (Sales)

```mermaid
sequenceDiagram
    participant User
    participant SalesPage
    participant IndexedDB
    participant StockMovement
    
    User->>SalesPage: Complete Sale
    SalesPage->>IndexedDB: Create Sale record
    SalesPage->>IndexedDB: Create SaleItems
    
    loop For each product in sale
        SalesPage->>IndexedDB: Get Product
        SalesPage->>IndexedDB: Update Product.stock (decrease)
        SalesPage->>StockMovement: Create StockMovement
        Note over StockMovement: type: 'SALE'<br/>quantity_change: -X<br/>reason: 'Vente #123'
    end
    
    SalesPage->>IndexedDB: Queue for sync
    SalesPage->>User: Show success toast
```

**What happens:**
1. User completes a sale
2. For each product sold:
   - Product stock is decreased
   - StockMovement record created with type `SALE`
3. Changes queued for server sync

### 2.2 Stock Adjustments (Manual)

```mermaid
sequenceDiagram
    participant User
    participant StocksPage
    participant IndexedDB
    participant StockMovement
    
    User->>StocksPage: Open adjustment modal
    User->>StocksPage: Select product, quantity, type, reason
    User->>StocksPage: Submit adjustment
    
    StocksPage->>IndexedDB: Get Product
    StocksPage->>IndexedDB: Update Product.stock
    StocksPage->>StockMovement: Create StockMovement
    
    Note over StockMovement: type: 'ADJUSTMENT' |<br/>'DAMAGED' | 'EXPIRED' |<br/>'INVENTORY' | 'RECEIPT'<br/>quantity_change: +X or -X
    
    StocksPage->>IndexedDB: Queue for sync
    StocksPage->>User: Show success
```

**Available adjustment types:**
- `ADJUSTMENT` - General correction
- `INVENTORY` - Physical count
- `RECEIPT` - Received from supplier (manual)
- `DAMAGED` - Product damaged
- `EXPIRED` - Product expired

**Current limitation:** When using `RECEIPT`, there's NO automatic link to a `SupplierOrder`.

---

## 3. Supplier Order Flow (Current)

### 3.1 Order Creation

```mermaid
sequenceDiagram
    participant User
    participant NewOrderPage
    participant IndexedDB
    participant Supplier
    
    User->>NewOrderPage: Fill order form
    Note over NewOrderPage: - Supplier selection<br/>- Order date<br/>- Delivery date (optional)<br/>- Total amount (single number)<br/>- Notes
    
    User->>NewOrderPage: Submit order
    NewOrderPage->>IndexedDB: Get Supplier
    NewOrderPage->>IndexedDB: Calculate dueDate<br/>(orderDate + paymentTermsDays)
    
    NewOrderPage->>IndexedDB: Create SupplierOrder
    Note over IndexedDB: status: 'ORDERED' or 'DELIVERED'<br/>(if deliveryDate provided)
    
    NewOrderPage->>User: Navigate to supplier page
```

**Current limitations:**
- ❌ No product selection - only total amount
- ❌ No line items - can't specify which products were ordered
- ❌ No automatic stock update when `deliveryDate` is set

### 3.2 Order Payment

```mermaid
sequenceDiagram
    participant User
    participant PaymentPage
    participant IndexedDB
    participant Expense
    
    User->>PaymentPage: Select orders to pay
    User->>PaymentPage: Enter payment amount
    User->>PaymentPage: Submit payment
    
    loop For each selected order
        PaymentPage->>IndexedDB: Update SupplierOrder
        Note over IndexedDB: amountPaid += payment<br/>status: 'PARTIALLY_PAID' or 'PAID'
    end
    
    PaymentPage->>Expense: Create Expense record
    Note over Expense: category: 'SUPPLIER_PAYMENT'<br/>amount: paymentAmount<br/>supplier_order_id: linked
    
    PaymentPage->>IndexedDB: Queue for sync
    PaymentPage->>User: Navigate back
```

**What works:**
- ✅ Multiple orders can be paid in one transaction
- ✅ Payment distributed oldest-first
- ✅ Expense automatically created
- ✅ Order status updated correctly

---

## 4. The Disconnect: Orders ↔ Stock

### Current Problem

```mermaid
graph TD
    A[User creates SupplierOrder] --> B[Order stored with totalAmount only]
    B --> C{Order marked as DELIVERED?}
    C -->|Yes| D[Status changes to DELIVERED]
    C -->|No| E[Status stays ORDERED]
    D --> F[❌ Stock NOT updated]
    E --> F
    
    G[User manually adjusts stock] --> H[Uses RECEIPT type]
    H --> I[Stock increased]
    I --> J[❌ No link to SupplierOrder]
    
    style F fill:#ff6b6b
    style J fill:#ff6b6b
```

**The Gap:**
1. **Orders don't specify products** - Only a total amount, no line items
2. **Delivery doesn't update stock** - Even if `deliveryDate` is set, stock remains unchanged
3. **Manual stock increases aren't linked** - When using `RECEIPT` adjustment, there's no way to link it to the order

---

## 5. Complete Current Flow Diagram

```mermaid
flowchart TB
    subgraph "Stock Management"
        A[Sales Page] -->|Complete Sale| B[Decrease Stock]
        B --> C[Create StockMovement: SALE]
        
        D[Stocks Page] -->|Manual Adjustment| E{Adjustment Type}
        E -->|Add Stock| F[Increase Stock]
        E -->|Remove Stock| G[Decrease Stock]
        F --> H[Create StockMovement: RECEIPT/ADJUSTMENT]
        G --> I[Create StockMovement: DAMAGED/EXPIRED/ADJUSTMENT]
    end
    
    subgraph "Supplier Management"
        J[New Order Page] -->|Create Order| K[SupplierOrder created]
        K -->|Only totalAmount| L[No product details]
        
        M[Payment Page] -->|Record Payment| N[Update SupplierOrder.amountPaid]
        N --> O[Create Expense: SUPPLIER_PAYMENT]
    end
    
    subgraph "Missing Connections"
        K -.->|❌ No link| B
        K -.->|❌ No link| F
        L -.->|❌ No products| H
    end
    
    style K fill:#ffd93d
    style L fill:#ffd93d
    style B fill:#6bcf7f
    style F fill:#6bcf7f
```

---

## 6. Current Pages & Features

### 6.1 Stock Management Pages

| Page | Location | Features |
|------|----------|----------|
| **Stocks List** | `/stocks` | View products, search, filter by category/alerts, adjust stock manually |
| **Stock Adjustment** | Modal in `/stocks` | Add/remove stock with reason, supports: ADJUSTMENT, INVENTORY, RECEIPT, DAMAGED, EXPIRED |

### 6.2 Supplier Management Pages

| Page | Location | Features |
|------|----------|----------|
| **Suppliers List** | `/fournisseurs` | View all suppliers, filter by payment status, see balances |
| **Supplier Detail** | `/fournisseurs/[id]` | View supplier info, orders list, quick actions (new order, payment, return) |
| **New Supplier** | `/fournisseurs/nouveau` | Create supplier with name, phone, payment terms |
| **New Order** | `/fournisseurs/commande/nouvelle` | Create order (supplier, dates, total amount, notes) |
| **Payment** | `/fournisseurs/paiement` | Record payment for one or multiple orders |

### 6.3 Missing Pages

- ❌ **Order Detail/Edit** - No page to view/edit order details
- ❌ **Order Items** - No way to see what products are in an order

---

## 7. Database Schema (Current)

### IndexedDB Tables

```typescript
// ✅ EXISTS
suppliers: {
  id, serverId, name, phone, paymentTermsDays, 
  createdAt, updatedAt, synced
}

supplier_orders: {
  id, serverId, supplierId, orderDate, deliveryDate,
  totalAmount, amountPaid, dueDate, status, notes,
  createdAt, updatedAt, synced
}

products: {
  id, serverId, name, category, price, priceBuy,
  stock, minStock, expirationDate, lotNumber,
  synced, updatedAt
}

stock_movements: {
  id, serverId, product_id, type, quantity_change,
  reason, created_at, user_id, synced
}

// ❌ MISSING
supplier_order_items: {
  // This table doesn't exist!
  // Should have: id, order_id, product_id, quantity, unit_price
}
```

---

## 8. Summary: What Works vs What's Missing

### ✅ What Works

1. **Stock Decreases from Sales**
   - Automatic stock reduction when sales complete
   - StockMovement audit trail

2. **Manual Stock Adjustments**
   - Add/remove stock with reasons
   - Multiple movement types (DAMAGED, EXPIRED, etc.)

3. **Supplier & Order Management**
   - Create suppliers with payment terms
   - Create orders with dates and amounts
   - Track payments (partial and full)
   - Payment reminders and due date tracking

4. **Offline-First Architecture**
   - All data stored in IndexedDB
   - Sync queue for server updates

### ❌ What's Missing

1. **Order → Stock Connection**
   - Orders don't specify which products were ordered
   - Delivery doesn't automatically increase stock
   - No way to link stock increases to orders

2. **Order Management**
   - Can't edit orders after creation
   - No order detail page
   - No product breakdown in orders

3. **UX Consistency**
   - Supplier pages use different visual style than sales/dashboard
   - Missing some design system elements

---

## Next Steps

The plan will address:
1. Adding `SupplierOrderItem` table for product breakdown
2. Creating order detail/edit page
3. Implementing delivery confirmation that updates stock
4. Improving UX consistency across all pages

