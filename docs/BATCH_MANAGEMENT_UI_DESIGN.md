# Batch Management UI Design - Phase 3 FEFO Implementation

**Date:** 2026-01-16
**Status:** ✅ COMPLETED
**Design Aesthetic:** Refined Medical-Industrial

---

## Overview

Implemented a production-grade batch management UI for pharmaceutical stock receipts with FEFO (First Expired First Out) tracking. The design follows a **refined medical-industrial aesthetic** - clean, professional, with pharmaceutical-grade clarity critical for medication tracking.

---

## Design Principles

### 1. **Pharmaceutical-Grade Clarity**
- Clear visual hierarchy
- Color-coded expiration alerts (red/amber/yellow/green)
- High contrast for critical information
- Monospace font for lot numbers (LOT-2024-001)

### 2. **Trust and Professionalism**
- Subtle depth with gradient backgrounds
- Consistent rounded corners (8-12px)
- Professional color palette (slate dark theme + purple accent for inventory)
- Smooth transitions (200ms duration)

### 3. **Touch-Friendly Mobile-First**
- Minimum 48x48dp touch targets
- Large, readable text (16-20px)
- Generous padding (12-16px)
- Bottom sheet modals for easy thumb access

### 4. **Visual Feedback**
- Hover states on interactive elements
- Expand/collapse animations
- Color-coded batch cards based on expiration urgency
- Icon-driven labels for quick scanning

---

## UI Components Implemented

### 1. **"Nouvelle Réception" Button**

**Location:** Below "Ajuster stock" button in product cards
**Color:** Purple-600 (inventory module color)
**Icon:** PackagePlus
**Behavior:** Opens batch receipt modal

```tsx
<Button
  onClick={() => handleOpenBatchReceipt(product.id!)}
  className="w-full h-10 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
>
  <PackagePlus className="w-4 h-4 mr-1.5" />
  Nouvelle réception
</Button>
```

**Design Notes:**
- Full-width for easy thumb access
- Purple color differentiates from stock adjustment (slate)
- Icon conveys "adding new batch"

---

### 2. **Batch Receipt Modal**

**Layout:** Bottom sheet modal (mobile-optimized)
**Background:** Gradient slate-900 to slate-950
**Height:** Max 90vh with scroll
**Animation:** Slide up from bottom

#### Form Fields:

**A. Lot Number Field**
- Icon: Hash (#)
- Input: Monospace font for better readability
- Placeholder: "Ex: LOT-2024-001"
- Validation: Required, trimmed
- Help text: "Le numéro de lot permettra de tracer ce lot spécifique"

**B. Expiration Date Field**
- Icon: Calendar
- Input: Native date picker
- Validation: Required, must be future date
- Min attribute: Today's date
- Help text: "La date d'expiration doit être dans le futur"

**C. Quantity & Unit Cost Grid**
- Layout: 2-column grid (50/50)
- Left: Quantity (required, min=1)
- Right: Unit cost (optional, for cost tracking)
- Both use number inputs with large 48px height

**D. FEFO Info Box**
- Background: Purple-500/10 with purple-500/30 border
- Icon: PackagePlus in purple circle
- Title: "Gestion automatique FEFO"
- Description: Explains that batches with closest expiration dates will be sold first
- Purpose: Educates users about FEFO logic

**E. Action Buttons**
- Cancel: Outline style, slate border
- Save: Solid purple-600 background with PackagePlus icon
- Layout: 50/50 grid, equal width

---

### 3. **Batch List Expansion**

**Toggle Button:**
- Full-width expandable button
- Shows: "Lots en stock (N)" with Package icon
- Icon: ChevronDown/ChevronUp
- Background: Slate-950/50 with slate-700 border
- Hover: Darker background

**Expanded Batch Cards:**
- Animation: slide-in-from-top-2 (200ms)
- Spacing: 8px vertical gap between cards
- Only shows batches with quantity > 0
- Sorted by expiration date (FEFO order)

---

### 4. **Batch Detail Cards**

**Color-Coded by Expiration Alert Level:**

| Alert Level | Border Color | Background | Text Color | Threshold |
|-------------|-------------|------------|------------|-----------|
| **Critical** | red-500/50 | red-500/20 | red-300 | < 7 days or expired |
| **Warning** | amber-500/50 | amber-500/20 | amber-300 | < 30 days |
| **Notice** | yellow-500/50 | yellow-500/20 | yellow-300 | < 90 days |
| **OK** | emerald-500/50 | emerald-500/20 | emerald-300 | > 90 days |

**Card Layout:**

```
┌──────────────────────────────────────┐
│ # LOT-2024-001          [30 unités]  │
│ 📅 Exp: 28/02/2026                   │
│ Coût unitaire: 10 000 GNF            │
└──────────────────────────────────────┘
```

**Card Structure:**
- Top row: Lot number (left) + Quantity badge (right)
- Bottom row: Expiration date with calendar icon
- Optional: Unit cost in small text
- Border: 2px solid with alert color
- Background: Semi-transparent alert color (20% opacity)

**Visual Hierarchy:**
- Lot number: Bold, white text, small hash icon
- Expiration: Colored text matching alert level
- Quantity: Badge with colored background

---

## Color System

### Base Colors (Dark Theme)
- Background: slate-950
- Card background: Gradient slate-900 → slate-950
- Border: slate-700
- Text primary: white
- Text secondary: slate-400

### Accent Colors
- Primary: emerald-500 (general actions)
- Inventory module: purple-600/700
- Stock alerts: yellow-500, red-500
- Expiration alerts: red/amber/yellow/emerald (see table above)

### Opacity Levels
- Backgrounds: 10-20% opacity for subtle tint
- Borders: 30-50% opacity for definition
- Hover states: 80% for dim effect

---

## Typography

| Element | Font Size | Weight | Color |
|---------|-----------|--------|-------|
| Modal title | 20px (xl) | Bold | white |
| Section headers | 14px (sm) | Semibold | white |
| Form labels | 14px (sm) | Semibold | white |
| Input text | 16px (base) | Normal | white |
| Help text | 12px (xs) | Normal | slate-400 |
| Lot numbers | 14px (sm) | Bold | white (mono) |
| Batch expiration | 12px (xs) | Semibold | alert color |

---

## Spacing & Sizing

| Element | Height | Padding | Border Radius |
|---------|--------|---------|---------------|
| Buttons | 40-48px | 12-16px | 8px (lg) |
| Input fields | 48px | 14px | 8px (lg) |
| Modal | max-90vh | 24px | 16px top |
| Cards | auto | 12px | 12px (xl) |
| Form spacing | - | 16px gap | - |

**Minimum Touch Targets:** 44-48px (iOS/Android guidelines)

---

## Interactive States

### Button States
```css
default: bg-purple-600
hover: bg-purple-700
active: scale-95 (CSS transform)
disabled: opacity-50
```

### Expansion Animation
```css
transition: all 200ms ease
animation: slide-in-from-top-2
```

### Color Transitions
```css
transition-all duration-200
```

---

## Data Flow

### Batch Receipt Submission Flow:

1. **User fills form** (lot number, expiration, quantity, optional cost)
2. **Validation:**
   - All required fields filled
   - Quantity > 0
   - Expiration date in future
3. **Create ProductBatch record** in IndexedDB
4. **Create StockMovement record** (type: RECEIPT)
5. **Update Product stock** (+quantity)
6. **Queue 3 transactions for sync:**
   - PRODUCT_BATCH CREATE
   - STOCK_MOVEMENT CREATE
   - PRODUCT UPDATE
7. **Close modal** and refresh UI
8. **Expand batch list** to show new batch

### Batch Display Flow:

1. **Load all batches** from IndexedDB on page load
2. **Filter by product ID** for each product card
3. **Filter quantity > 0** (hide sold-out batches)
4. **Sort by expiration date** (earliest first - FEFO order)
5. **Calculate alert level** for each batch
6. **Apply color coding** based on alert level
7. **Render cards** in expandable section

---

## Accessibility Features

- Semantic HTML (button, form, label)
- Required field indicators (*)
- Clear error messages (French)
- High contrast text (WCAG AA compliant)
- Keyboard navigation support
- ARIA labels on interactive elements
- Focus states on inputs

---

## Performance Optimizations

- **Lazy rendering:** Batches only render when expanded
- **useLiveQuery:** Real-time updates from IndexedDB
- **Set-based expansion:** O(1) toggle performance
- **CSS animations:** Hardware-accelerated transforms
- **Filtered queries:** Only load batches with quantity > 0

---

## Mobile Optimization

- **Bottom sheet modals:** Easy thumb access
- **Large touch targets:** 48x48dp minimum
- **Scroll overflow:** Max 90vh with vertical scroll
- **Native date picker:** Platform-optimized input
- **Haptic feedback:** (future: vibration on submit)

---

## User Experience Flows

### Primary Flow: Receiving New Stock

1. User taps product card → sees "Nouvelle réception" button
2. Taps button → bottom sheet modal slides up
3. Fills in lot number, expiration date, quantity
4. Optionally enters unit cost for tracking
5. Reads FEFO info box (education)
6. Taps "Enregistrer" → modal closes
7. Product stock increases immediately
8. New batch appears in "Lots en stock" section
9. Batch card color-coded by expiration urgency

### Secondary Flow: Viewing Existing Batches

1. User sees product card with batches
2. Notices "Lots en stock (3)" button
3. Taps to expand → smooth slide-down animation
4. Sees 3 batch cards sorted by expiration (FEFO order)
5. Each card shows:
   - Lot number with hash icon
   - Expiration date with calendar icon
   - Quantity badge
   - Optional unit cost
   - Color coding (red = urgent, green = OK)
6. User can quickly identify which batches expire soon
7. Taps chevron to collapse

---

## French Localization

| English | French |
|---------|--------|
| New Receipt | Nouvelle réception |
| Lot Number | Numéro de lot |
| Expiration Date | Date d'expiration |
| Quantity Received | Quantité reçue |
| Unit Cost | Coût unitaire |
| Batches in Stock | Lots en stock |
| Save | Enregistrer |
| Cancel | Annuler |
| Automatic FEFO Management | Gestion automatique FEFO |

---

## Technical Implementation

### Files Modified:
1. **src/app/stocks/page.tsx** - Main UI implementation
2. **src/lib/client/sync.ts** - Added 'PRODUCT_BATCH' to sync types
3. **src/lib/shared/types.ts** - Added 'PRODUCT_BATCH' to SyncType enum

### New State Variables:
```tsx
const [showBatchModal, setShowBatchModal] = useState(false);
const [batchProductId, setBatchProductId] = useState<number | null>(null);
const [batchLotNumber, setBatchLotNumber] = useState('');
const [batchExpirationDate, setBatchExpirationDate] = useState('');
const [batchQuantity, setBatchQuantity] = useState('');
const [batchUnitCost, setBatchUnitCost] = useState('');
const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
```

### Key Functions:
- `handleOpenBatchReceipt()` - Opens modal for product
- `handleSubmitBatch()` - Creates batch + stock movement + updates product
- `toggleBatchExpansion()` - Expands/collapses batch list
- `getBatchesForProduct()` - Filters and sorts batches by product

### Dependencies Used:
- **Dexie.js:** IndexedDB for batch storage
- **useLiveQuery:** Real-time reactive queries
- **lucide-react:** Icons (PackagePlus, Calendar, Hash, ChevronDown/Up)
- **Tailwind CSS:** Utility-first styling
- **cn():** Class name merging utility

---

## Future Enhancements (Post-Phase 3)

1. **Batch editing:** Allow editing lot number or expiration
2. **Batch deletion:** Mark batches as damaged/returned
3. **Barcode scanning:** Auto-fill lot number from barcode
4. **Photo upload:** Attach photos of batch labels
5. **Batch history:** Show sold-out batches with "depleted" badge
6. **Export batches:** CSV export for audit trails
7. **Batch alerts:** Push notifications for expiring batches
8. **Multi-batch receipt:** Add multiple batches in one flow

---

## Testing Checklist

- [x] Form validation (required fields, future date)
- [x] Batch creation (IndexedDB insert)
- [x] Stock movement creation
- [x] Product stock update
- [x] Sync queue (3 transactions)
- [x] Batch list filtering (quantity > 0)
- [x] Batch sorting (expiration date ASC)
- [x] Alert level calculation (critical/warning/notice/ok)
- [x] Color coding (red/amber/yellow/green)
- [x] Expansion toggle (smooth animation)
- [x] Modal open/close
- [x] TypeScript compilation
- [ ] E2E testing (Playwright)
- [ ] Mobile device testing (Android/iOS)
- [ ] Accessibility testing (screen reader)

---

## Design Inspiration

This design takes inspiration from:
- **Medical packaging:** Color-coded expiration warnings
- **Warehouse management systems:** Lot number + expiration tracking
- **Industrial UI:** Clean, functional, no-nonsense
- **Mobile banking apps:** Bottom sheet modals, large touch targets

**Key Differentiators:**
- NOT generic AI slop (no purple gradients on white)
- NOT playful or consumer-facing (professional pharmacy context)
- NOT cluttered (generous negative space, clear hierarchy)
- YES trust-building (pharmaceutical-grade clarity)
- YES context-appropriate (medical-industrial aesthetic)

---

*Design completed by Claude Code with frontend-design skill - 2026-01-16*
