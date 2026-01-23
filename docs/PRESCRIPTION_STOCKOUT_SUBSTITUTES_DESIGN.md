# Prescription, Stockout & Substitutes Feature Design

> Design document for pharmacy-specific sale enhancements

## Overview

Three interconnected features to improve the pharmacy workflow:

1. **Ruptures de Stock** - Track products requested but unavailable (missed sales)
2. **Ordonnances** - Attach prescription photos to sales
3. **Substituts** - Show equivalent products when one is out of stock

---

## Data Model

### New Tables

```typescript
// 1. Stockout Reports (Ruptures de stock)
interface StockoutReport {
  id: string;                    // CUID
  product_name: string;          // What was requested (may not exist in DB)
  product_id?: string;           // FK to products (if known)
  requested_qty: number;         // How many were needed
  customer_name?: string;        // Optional client info
  customer_phone?: string;       // For follow-up when stock arrives
  notes?: string;                // Additional context
  reported_by: string;           // User ID who reported
  created_at: Date;
  synced: boolean;
}

// 2. Sale Prescriptions (Ordonnances)
interface SalePrescription {
  id: string;                    // CUID
  sale_id: string;               // FK to sales
  image_data: string;            // Base64 encoded image (or blob URL)
  image_type: string;            // 'image/jpeg' | 'image/png'
  captured_at: Date;
  notes?: string;                // Pharmacist notes about prescription
  synced: boolean;
}

// 3. Product Substitutes (Alternatives)
interface ProductSubstitute {
  id: string;                    // CUID
  product_id: string;            // Primary product
  substitute_id: string;         // Alternative product
  equivalence_type: 'DCI' | 'THERAPEUTIC_CLASS' | 'MANUAL';
  notes?: string;                // e.g., "Même principe actif - paracétamol"
  created_at: Date;
  synced: boolean;
}
```

### Sales Table Enhancement

```typescript
// Add to existing Sale interface
interface Sale {
  // ... existing fields
  has_prescription?: boolean;    // Quick flag for filtering
  stockout_reported?: boolean;   // If a stockout was logged during this sale
}
```

---

## UX Flow

### 1. Enhanced Product Search

```
[Search: "doliprane"]
    │
    ├─► Product Found (in stock)
    │   └─► Normal add to cart flow
    │
    ├─► Product Found (OUT OF STOCK) ⚠️
    │   ├─► Show "Rupture" badge
    │   ├─► Button: "Signaler rupture" → Opens StockoutModal
    │   └─► Button: "Voir alternatives" → Opens SubstitutesPanel
    │
    └─► Product NOT Found
        └─► Show "Produit introuvable"
        └─► Button: "Signaler demande" → Opens StockoutModal (manual entry)
```

### 2. Prescription Capture (Cart Step)

```
[Cart Header]
    │
    └─► Camera Icon Button
        └─► Opens camera/file picker
        └─► Shows thumbnail preview
        └─► Stored with sale record
```

### 3. Substitutes Suggestion

When product is out of stock:
```
┌─────────────────────────────────────┐
│ ⚠️ Doliprane 1000mg - Rupture       │
├─────────────────────────────────────┤
│ 🔄 ALTERNATIVES DISPONIBLES         │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Paracetamol 500mg             │   │
│ │ Stock: 45 | 15 000 GNF        │   │
│ │ [Même principe actif]         │   │
│ │              [+ Ajouter]      │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Efferalgan 1000mg             │   │
│ │ Stock: 12 | 22 000 GNF        │   │
│ │ [Même principe actif]         │   │
│ └───────────────────────────────┘   │
│                                     │
│ [Signaler rupture de stock]         │
└─────────────────────────────────────┘
```

---

## Component Specifications

### StockoutReportModal

**Trigger**: Click "Signaler rupture" on out-of-stock product OR "Produit introuvable"

**Fields**:
- Product name (pre-filled if known, editable if manual)
- Quantity needed (default: 1)
- Customer name (optional)
- Customer phone (optional, for callback)
- Notes (optional)

**Design**:
- Bottom sheet on mobile
- Orange/amber accent (warning color)
- Quick submit with minimal friction

### PrescriptionCapture

**Trigger**: Camera icon in cart header

**Behavior**:
- Opens device camera (prefer rear camera)
- Fallback to file picker if camera unavailable
- Compresses image to max 500KB for storage
- Shows thumbnail in cart
- Multiple prescriptions allowed per sale

**Design**:
- Blue accent (documentation color)
- Thumbnail shows in cart with delete option

### SubstitutesPanel

**Trigger**: Auto-shown when clicking out-of-stock product

**Data Source**:
1. Pre-configured substitutes (ProductSubstitute table)
2. Same category fallback if no configured substitutes

**Design**:
- Emerald accent (positive/available)
- Shows stock level and price
- One-tap add to cart
- Link to report stockout at bottom

---

## Implementation Priority

### Phase 1 (MVP)
1. ✅ StockoutReport table + UI
2. ✅ Basic substitutes (same category)
3. ✅ Prescription capture (single image)

### Phase 2 (Enhancement)
1. ProductSubstitute table with admin UI
2. DCI-based automatic matching
3. Multiple prescription images
4. Stockout analytics dashboard

---

## Offline Considerations

All features work 100% offline:
- Images stored as base64 in IndexedDB
- Stockout reports queued for sync
- Substitutes cached locally
- Prescription images synced to cloud storage when online

---

## File Structure

```
src/
├── components/
│   └── features/
│       ├── StockoutReportModal.tsx
│       ├── PrescriptionCapture.tsx
│       └── ProductSubstitutes.tsx
├── lib/
│   └── shared/
│       └── types.ts  (+ new interfaces)
└── app/
    └── ventes/
        └── nouvelle/
            └── page.tsx  (integrate components)
```
