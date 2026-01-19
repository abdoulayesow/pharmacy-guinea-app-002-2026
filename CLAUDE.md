# CLAUDE.md - Seri Development Guide

> Development reference guide for Seri with Claude Code

## Project Overview

**Seri** is a mobile-first PWA for managing small independent pharmacies in Guinea, West Africa. The pilot client is "Pharmacie Thierno Mamadou" in Conakry.

### Key Context
- **Client**: Small pharmacy with 1 owner (Oumar, 52) + 2 employees (including Abdoulaye, 27)
- **Current system**: Excel + physical notebooks
- **Target devices**: Low-end Android smartphones (2GB RAM, Android 8+)
- **Language**: French only
- **Currency**: Guinean Franc (GNF) - format: `15 000 GNF`
- **Payments**: Cash + Orange Money

---

## Critical Technical Constraints

| Constraint | Reality | Technical Implication |
|------------|---------|----------------------|
| **Electricity** | < 12h/day, frequent outages | OFFLINE-FIRST mandatory |
| **Connectivity** | Intermittent 3G, expensive data | Bundle < 5MB, optimized sync |
| **Devices** | Low-end Android (2GB RAM) | Performance critical |
| **Budget** | Limited | Open-source preferred |

### Non-Functional Requirements

| Requirement | Target | Priority |
|-------------|--------|----------|
| Initial load time | < 3s on 3G | P0 |
| Product search | < 500ms | P0 |
| App size | < 5MB | P0 |
| Offline availability | 100% MVP features | P0 |
| Sync after reconnection | Automatic, < 30s | P0 |
| Data loss | 0% | P0 |

---

## Tech Stack

### Frontend
- **Framework**: React 18 + Next.js 14 (PWA with next-pwa)
- **State**: Zustand (lightweight, persists well)
- **Offline DB**: Dexie.js (IndexedDB wrapper)
- **Service Worker**: Workbox (via next-pwa)
- **UI**: Tailwind CSS (purged for minimal size)
- **Forms**: React Hook Form
- **Icons**: Lucide React (tree-shakable)

### Backend
- **Runtime**: Vercel Serverless Functions (Node.js 20)
- **Database**: Neon (Serverless PostgreSQL via Vercel integration)
- **ORM**: Prisma with `@prisma/adapter-neon`
- **Auth**: NextAuth v5 (Auth.js) with Google OAuth + JWT + PIN hash (bcrypt)
- **JWT Storage**: httpOnly cookies (secure, XSS-resistant)
- **CSRF Protection**: Origin header verification
- **Hosting**: Vercel (Frontend + API + Database)

---

## Project Structure

**Architecture:** Client/Server separation for future Android app compatibility

```
seri-app/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (frontend)/         # Frontend routes (grouped)
│   │   │   ├── login/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── ventes/
│   │   │   │   └── nouvelle/page.tsx
│   │   │   ├── stocks/page.tsx
│   │   │   ├── depenses/page.tsx
│   │   │   ├── parametres/page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   └── api/                # Backend API endpoints
│   │       ├── auth/
│   │       │   └── login/route.ts       # POST /api/auth/login
│   │       ├── products/
│   │       │   └── route.ts             # GET/POST/PUT/DELETE
│   │       ├── sales/
│   │       │   └── route.ts             # GET/POST
│   │       ├── expenses/
│   │       │   └── route.ts             # GET/POST/PUT/DELETE
│   │       └── sync/
│   │           ├── pull/route.ts        # GET /api/sync/pull
│   │           └── push/route.ts        # POST /api/sync/push
│   │
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   ├── features/            # Feature-specific components
│   │   ├── AuthGuard.tsx        # Authentication guard (redirects, session sync)
│   │   ├── AppLockGuard.tsx     # App lock overlay guard
│   │   └── LockScreen.tsx       # Lock screen with PIN/biometric unlock
│   │
│   ├── lib/
│   │   ├── client/              # CLIENT-SIDE ONLY (PWA)
│   │   │   ├── db.ts           # Dexie.js (IndexedDB)
│   │   │   ├── sync.ts         # Sync queue logic (push/pull)
│   │   │   ├── auth.ts         # PIN verification (client-side)
│   │   │   ├── biometric.ts   # WebAuthn fingerprint/face ID
│   │   │   └── utils.ts        # UI utilities (cn, debounce)
│   │   │
│   │   ├── server/              # SERVER-SIDE ONLY (API)
│   │   │   ├── prisma.ts       # Prisma client (future)
│   │   │   └── auth.ts         # JWT verification, PIN hashing
│   │   │
│   │   ├── shared/              # SHARED (client + server + future Android)
│   │   │   ├── types.ts        # TypeScript interfaces
│   │   │   └── utils.ts        # formatCurrency, formatDate, validation
│   │   │
│   │   ├── db.ts                # Re-exports @/lib/client/db (compatibility)
│   │   └── utils.ts             # Re-exports shared + client utils (compatibility)
│   │
│   ├── stores/
│   │   ├── auth.ts              # Zustand auth store
│   │   ├── cart.ts              # Zustand cart store
│   │   ├── lock.ts              # Zustand lock store (app locking)
│   │   └── sync.ts              # Zustand sync status store
│   │
│   └── types/
│       └── index.ts             # Re-exports @/lib/shared/types (compatibility)
│
├── tailwind.config.js
├── next.config.js
└── package.json
```

### Architecture Benefits

1. **Clean Separation**: Client code (Dexie.js) never imported in server code (API routes)
2. **Future Android App**: Can consume `/api/*` endpoints and reuse `@/lib/shared/*`
3. **Type Safety**: Shared types ensure API contract between frontend/backend
4. **Easy Extraction**: API routes can be moved to standalone service later
5. **Vercel Deployment**: Single project deployment with clear boundaries

---

## Data Model

### Core Entities

```typescript
// Types
type PaymentMethod = 'CASH' | 'ORANGE_MONEY';
type UserRole = 'OWNER' | 'EMPLOYEE';
type StockMovementType = 'SALE' | 'ADJUSTMENT' | 'INVENTORY' | 'DAMAGED' | 'EXPIRED';
type ExpenseCategory = 'STOCK_PURCHASE' | 'RENT' | 'SALARY' | 'ELECTRICITY' | 'TRANSPORT' | 'OTHER';
type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

// Tables
Users: id, name, pin_hash, role, created_at
Products: id, name, price_sell, price_buy, stock_quantity, stock_min, created_at, updated_at, synced
ProductBatches: id, product_id, lot_number, expiration_date, quantity, initial_qty, unit_cost, supplier_order_id, received_date, synced
Sales: id, created_at, total, payment_method, payment_ref, user_id, synced
SaleItems: id, sale_id, product_id, product_batch_id, quantity, unit_price, subtotal
Expenses: id, amount, category, description, date, created_at, synced, user_id
StockMovements: id, product_id, type, quantity_change, reason, created_at, user_id, synced
Suppliers: id, name, phone, payment_terms_days, created_at, updated_at, synced
SupplierOrders: id, supplier_id, type, order_date, delivery_date, total_amount, status, payment_status, synced
SupplierOrderItems: id, order_id, product_id, product_name, quantity, unit_price, subtotal, synced
SupplierReturns: id, supplier_id, product_id, quantity, reason, credit_amount, applied, synced
ProductSuppliers: id, product_id, supplier_id, default_price, is_primary, synced
CreditPayments: id, sale_id, amount, payment_method, payment_date, synced
SyncQueue: id, type, payload, status, created_at, retry_count, last_error
```

---

## Offline-First Architecture

### Golden Rule
```
The app must work as if it were always offline.
Connection is a bonus.
```

### Data Flow
1. User creates transaction
2. **Immediate local save** (IndexedDB)
3. UI confirms success (even if offline)
4. Transaction added to sync queue
5. Background sync when connected
6. Conflict resolution: last-write-wins with logging

### Sync Queue Structure
```javascript
{
  id: "uuid-v4",
  type: "SALE" | "EXPENSE" | "PRODUCT" | "PRODUCT_BATCH" | "STOCK_MOVEMENT" | "SUPPLIER" | "SUPPLIER_ORDER" | "SUPPLIER_ORDER_ITEM" | "SUPPLIER_RETURN" | "PRODUCT_SUPPLIER" | "CREDIT_PAYMENT" | "USER",
  action: "CREATE" | "UPDATE" | "DELETE" | "UPDATE_PIN",
  payload: { /* transaction data */ },
  created_at: "2026-01-15T10:30:00Z",
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED",
  retry_count: 0,
  last_error: null,
  idempotencyKey: "uuid-v4" // Prevents duplicate transactions on retry
}
```

### Multi-User Sync (Phase 2 - Implemented)
- **Bidirectional Sync**: Push local changes to server, pull changes from other users
- **Push Sync**: `/api/sync/push` - Sends queued transactions to PostgreSQL
- **Pull Sync**: `/api/sync/pull` - Fetches changes since last sync timestamp
- **Conflict Resolution**: "Last Write Wins" strategy (most recent `updatedAt` wins)
- **Background Sync**: Automatic pull every 5 minutes when online
- **Initial Sync**: Full data pull on first login
- **Sync Status**: UI shows last push/pull times and pending count
- **Idempotency**: Uses UUID keys to prevent duplicate transactions on retry

### FEFO Batch Tracking (Phase 3 - In Progress)

**Status:** 🚧 90% infrastructure ready, missing 3 critical implementations

**Overview:**
- Track product batches with expiration dates (First Expired, First Out)
- Link batches to supplier orders for full traceability
- Auto-deduct from oldest batches during sales
- Alert users about expiring products

**Architecture:**

```
Supplier Order Delivery
    ↓
ProductBatch Created (lot, expiry, qty, supplier_order_id)
    ↓
FEFO Selection Algorithm (sort by expiry ASC)
    ↓
Batch Quantity Deducted on Sale
    ↓
SaleItem tracks product_batch_id
    ↓
Sync to PostgreSQL (bidirectional)
```

**Critical Missing Implementations:**

1. **❌ Batch Creation** (Priority P0)
   - Location: `src/app/fournisseurs/commande/[id]/page.tsx:240-447`
   - Issue: Delivery confirmation updates product stock but never creates ProductBatch records
   - Fix: Add `db.product_batches.add()` after product stock update

2. **❌ FEFO Sales Deduction** (Priority P0)
   - Location: All sale creation flows
   - Issue: Sales deduct from `product.stock` directly, not from batches
   - Fix: Call `selectBatchForSale()` (already exists) before creating sale

3. **❌ Sync Queue Completion** (Priority P0)
   - Location: `src/lib/client/sync.ts:214-304`
   - Issue: `prepareSyncPayload` doesn't handle SUPPLIER_ORDER_ITEM and other entities
   - Fix: Add missing entity types to switch statement

**Key Design Decisions:**

- **One Product, Many Batches**: Each delivery creates a new batch with unique lot number and expiration
- **Batch Quantity Tracking**: `quantity` (current) vs `initialQty` (original) for waste calculation
- **Optional Batch Tracking**: `sale_items.product_batch_id` is optional for backwards compatibility
- **ID Mapping**: Client uses local IDs (17+), server uses PostgreSQL IDs (1+), mapped via `serverId`

**Documentation:** See [docs/SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md](docs/SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md) for complete architecture.

---

## MVP Features

### 1. Authentication (Module: Connexion)
- PIN 4 digits with numeric keypad
- Visual feedback (dots) for each digit
- Profiles: OWNER (full access) / EMPLOYEE (limited)
- Session remembered 24h (configurable via `SESSION_MAX_AGE_DAYS`)
- Lock after 5 failed attempts (30 min)
- **Google OAuth**: First-time login via Google, then PIN-based authentication
- **Default PIN**: New users get default PIN ("1234") and must change it on first login
- **JWT Security**: JWT stored in httpOnly cookies (not localStorage) for XSS protection
- **CSRF Protection**: Origin header verification for API routes
- **App Locking**: Manual lock button + auto-lock after inactivity (5 min default)
- **Biometric Unlock**: Fingerprint/face ID support via WebAuthn API (if device supports)

### 2. Sales (Module: Ventes)
- Product search with autocomplete (< 500ms)
- Results show: name, price (GNF), available stock
- Color indicator for low stock
- Cart management (+/- quantity, remove)
- Payment: Cash (with change calculation) or Orange Money
- Digital receipt with WhatsApp sharing option
- **100% offline capable**

### 3. Inventory (Module: Stocks)
- Product list with quantities and min threshold
- Traffic light indicators (green/yellow/red)
- Filters: All, Alerts, OK
- Search and sort (name, quantity)
- Stock adjustments: Inventory, Receipt, Damage, Expired, Other
- Mandatory reason for adjustments
- Add new product

### 4. Expenses (Module: Depenses) - OWNER only
- Chronological list (recent first)
- Filter by period (Today, Week, Month)
- Filter by category
- Categories: Stock Purchase, Rent, Salary, Electricity, Transport, Other
- Add/Edit/Delete with confirmation

### 5. Dashboard
- Daily sales total (GNF formatted)
- Stock alerts counter with color coding
- Cash vs Orange Money distribution
- Prominent "New Sale" button
- Sync status indicator

---

## UX Guidelines

### Design Principles
- Interface inspired by paper registers (familiarity)
- Touch-friendly: minimum 48x48dp buttons
- Visual + audio feedback on each action
- Traffic light indicators (green/yellow/red) for status
- Maximum 5 main screens
- Sale flow in 3 steps max

### Localization
- **Language**: French 100%
- **Currency**: GNF with space thousands (`15 000 GNF`)
- **Date format**: DD/MM/YYYY
- **Time format**: 24h
- **Text expansion**: Plan for +30% vs English
- **No custom fonts**: Use `system-ui` only
- **No emojis** in UI (except status indicators)

### Code Formatting Helpers
```javascript
// Currency formatting
const formatGNF = (amount) => {
  return new Intl.NumberFormat('fr-GN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' GNF';
};
// Result: "15 000 GNF"

// Date formatting
const formatDate = (date) => {
  return new Intl.DateTimeFormat('fr-GN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};
// Result: "15/01/2026"
```

---

## Personas

### Oumar (Owner, 52 years)
- **Tech level**: Low (WhatsApp + basic Excel)
- **Wants**: Simplicity and visible ROI
- **Uses**: Dashboard, Expenses, Settings
- **Training tolerance**: < 1 hour
- **Quote**: "I need something simple, like my notebook but better"

### Abdoulaye (Employee, 27 years)
- **Tech level**: Medium (smartphone, apps, social media)
- **Wants**: Speed and reliability
- **Uses**: Sales, Stock (view only)
- **Training tolerance**: < 15 minutes
- **Quote**: "When the system is slow, customers think I'm slow"

---

## Performance Budget

| Component | Budget | Technique |
|-----------|--------|-----------|
| JavaScript | < 200KB gzipped | Code splitting, tree shaking |
| CSS | < 30KB gzipped | Tailwind purge |
| Images | < 50KB total | SVG, compression |
| Fonts | 0 (system fonts) | `font-family: system-ui` |
| **Total** | **< 300KB** | |

### Target Metrics
| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Largest Contentful Paint | < 2.5s |
| Lighthouse Score | > 90 |

---

## Code Conventions

### Naming
```javascript
// French for business data
const produit = { nom: "Paracetamol", prix_vente: 15000 };

// English for technical code
const [isLoading, setIsLoading] = useState(false);
```

### Commit Checklist
- [ ] Works offline
- [ ] No TypeScript errors
- [ ] Responsive UI (tested at 360px width)
- [ ] French text
- [ ] Amounts formatted in GNF

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify-pin` | Verify PIN, return JWT |
| POST | `/api/auth/refresh` | Refresh token |

### Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/push` | Send local transactions |
| GET | `/api/sync/pull` | Get server changes |
| GET | `/api/sync/status` | Sync status |

### Resources (Standard CRUD)
- Products: GET/POST/PUT/DELETE `/api/products`
- Sales: GET/POST `/api/sales`
- Expenses: GET/POST/PUT/DELETE `/api/expenses`
- Stock Movements: GET/POST `/api/stock-movements`

---

## Security

- PIN hashed with bcrypt + salt
- 5 failed attempts = 30 min lockout
- HTTPS mandatory in production
- JWT stored in httpOnly cookies (prevents XSS attacks)
- CSRF protection via Origin header verification
- Session duration configurable (default: 7 days)
- Inactivity timeout configurable (default: 5 minutes)
- App locking: Manual lock + auto-lock on inactivity
- Biometric authentication via WebAuthn (fingerprint/face ID)
- Sensitive data encryption at rest (V2)

---

## Success Metrics (90 days)

| Category | Metric | Target |
|----------|--------|--------|
| Adoption | Onboarding complete | > 80% |
| Engagement | Sales/day | > 15 |
| Retention | Active after 90 days | > 60% |
| Performance | Avg sale time | < 30 sec |
| Satisfaction | NPS | > 40 |
| Business | Positive ROI | Demonstrated |
| Quality | Critical bugs | 0 |

---

## Risks to Monitor

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss offline | Critical | Exhaustive sync tests, redundant local backup |
| Employee rejection | High | Involve Fatoumata in design, hands-on training |
| Poor 3G performance | High | Bundle optimization, aggressive caching |
| Cost overrun | High | Strict MVP, no feature creep |

---

## Development Phases

### Phase 1: MVP (Completed)
1. ✅ Project setup (Next.js, Tailwind, PWA config)
2. ✅ Dexie.js data model (IndexedDB schema)
3. ✅ Offline-first architecture with sync queue
4. ✅ Login screen (Google OAuth + PIN authentication)
5. ✅ Dashboard
6. ✅ Sales module
7. ✅ Stock module
8. ✅ Expenses module
9. ✅ Settings
10. ✅ Performance optimization & deployment

### Phase 2: Multi-User Sync & Security (Completed)
1. ✅ Bidirectional sync (push/pull)
2. ✅ Conflict resolution (last write wins)
3. ✅ Background sync (periodic pull every 5 min)
4. ✅ JWT security (httpOnly cookies)
5. ✅ CSRF protection
6. ✅ App locking (manual + auto-lock)
7. ✅ Biometric unlock (WebAuthn)

### Phase 3: Consolidation (Post-MVP)
- Expiration alerts (FEFO)
- Advanced reports
- 10 pharmacies

### Phase 3: Expansion
- Wholesaler integration
- Predictive analytics
- West Africa expansion
- 100+ pharmacies

---

## Figma Design Reference

The `figma-design/` folder contains a complete React/Vite implementation of the UI design. Use this as the source of truth for UI implementation.

### Key Design Files
- [figma-design/src/components/LoginScreen.tsx](figma-design/src/components/LoginScreen.tsx) - PIN login with profile selection
- [figma-design/src/components/Dashboard.tsx](figma-design/src/components/Dashboard.tsx) - Main dashboard layout
- [figma-design/src/components/NewSale.tsx](figma-design/src/components/NewSale.tsx) - Complete sale flow (search → cart → payment → receipt)
- [figma-design/src/components/ProductList.tsx](figma-design/src/components/ProductList.tsx) - Inventory management
- [figma-design/src/components/ExpenseList.tsx](figma-design/src/components/ExpenseList.tsx) - Expense tracking
- [figma-design/src/components/Navigation.tsx](figma-design/src/components/Navigation.tsx) - Bottom navigation
- [figma-design/src/lib/types.ts](figma-design/src/lib/types.ts) - TypeScript interfaces
- [figma-design/src/lib/utils.ts](figma-design/src/lib/utils.ts) - Formatting helpers (GNF, dates)

### UI Component Library
The design uses shadcn/ui components in `figma-design/src/components/ui/`:
- Button, Card, Input, Badge, Dialog, Sheet, Tabs, etc.
- All components support dark mode

### Design System
- **Primary color**: Emerald (`emerald-600`)
- **Module colors**: Blue (sales), Purple (inventory), Orange (expenses)
- **Border radius**: `rounded-lg` (8px) / `rounded-xl` (12px) / `rounded-2xl` (16px)
- **Spacing**: 4px base unit (p-4, p-5, p-6)
- **Icons**: Lucide React
- **Dark mode**: Full support via Tailwind `dark:` variants

---

## Recommended Custom Skills

To accelerate development with precision, create these custom Claude Code skills:

### 1. `/seri-component` - UI Component Builder
**Purpose**: Generate Next.js components matching the Figma design exactly
```
Trigger: "create component", "build UI for", "implement screen"
What it does:
- Reads the corresponding Figma design file
- Adapts it for Next.js App Router (server/client components)
- Integrates with Dexie.js for offline data
- Adds Zustand state management
- Ensures French localization
- Applies GNF formatting
```

### 2. `/seri-offline` - Offline-First Implementation
**Purpose**: Implement offline-first patterns correctly
```
Trigger: "make offline", "add sync", "implement offline"
What it does:
- Creates Dexie.js table schemas
- Implements sync queue operations
- Adds optimistic UI updates
- Handles conflict resolution
- Adds sync status indicators
- Tests offline scenarios
```

### 3. `/seri-api` - API Endpoint Generator (UPDATED)
**Purpose**: Generate Next.js API Route Handlers with proper client/server separation
```
Trigger: "create API", "add endpoint", "implement backend"
What it does:
- Creates Route Handlers in src/app/api/
- Uses server-only imports from src/lib/server/
- Uses shared types from src/lib/shared/types
- Implements JWT authentication with src/lib/server/auth
- Validates requests with Zod or manual validation
- Handles sync payloads with proper error handling
- Returns proper JSON responses
- Adds Prisma database operations (future)
```

### 4. `/seri-test` - Test Generator
**Purpose**: Create tests for offline scenarios and GNF formatting
```
Trigger: "test component", "add tests", "verify offline"
What it does:
- Generates unit tests for formatting (GNF, dates)
- Creates component tests with mock IndexedDB
- Tests offline/online state transitions
- Validates sync queue behavior
- Tests PIN authentication flow
```

### 5. `/seri-perf` - Performance Optimizer
**Purpose**: Ensure bundle size and performance targets are met
```
Trigger: "optimize", "check performance", "reduce bundle"
What it does:
- Analyzes bundle size
- Suggests code splitting opportunities
- Checks Tailwind purging
- Validates lazy loading
- Runs Lighthouse audit
- Measures search performance (<500ms)
```

### 6. `/seri-migrate` - Figma to Next.js Migrator
**Purpose**: Convert Figma design components to Next.js
```
Trigger: "migrate from figma", "convert component"
What it does:
- Reads figma-design/src/components/{Component}.tsx
- Converts to Next.js App Router patterns
- Replaces context with Zustand stores
- Adapts Vite imports to Next.js
- Adds 'use client' directive where needed
- Integrates with Dexie.js from @/lib/client/db
```

### 7. `/seri-android-prep` - Android App Preparation (NEW)
**Purpose**: Prepare codebase for future Android app development
```
Trigger: "prepare for android", "android app", "extract shared code"
What it does:
- Documents all /api/* endpoints with request/response types
- Creates API client template for React Native
- Maps IndexedDB schema to SQLite schema
- Extracts shared types to standalone documentation
- Suggests npm package structure for @seri/shared-types
- Plans offline-first architecture for mobile
- Generates OpenAPI/Swagger spec from API routes
```

---

## Skill Implementation Guidelines

When using the `frontend-design` skill, provide this context:
```
Reference the Figma design in figma-design/src/components/
- Match colors: emerald-600 (primary), blue-600 (sales), purple-600 (inventory), orange-600 (expenses)
- Use the exact same component structure and Tailwind classes
- Keep all French text labels
- Import utilities from @/lib/shared/utils (formatCurrency, formatDate)
- Import UI utilities from @/lib/client/utils (cn for className merging)
- Include dark mode support with dark: variants
- Ensure touch-friendly sizing (min 48x48dp for buttons)
```

### Converting Figma Components to Next.js

1. **Add 'use client'** directive for interactive components
2. **Replace useApp context** with Zustand store
3. **Add Dexie.js integration** for data persistence
4. **Keep styling identical** - copy Tailwind classes exactly
5. **Preserve animations** - shake, scale, transitions
6. **Add offline indicators** where needed

Example conversion pattern:
```typescript
// Figma (Vite)
import { useApp } from '../lib/context';
import { formatCurrency } from '../lib/utils';
const { products } = useApp();

// Next.js (App Router) - UPDATED
'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';          // Client-only
import { formatCurrency } from '@/lib/shared/utils';  // Shared
import { cn } from '@/lib/client/utils';       // Client UI utilities

const products = useLiveQuery(() => db.products.toArray()) ?? [];
```

---

## Documentation References

- [Empathy Maps](docs/product-discovery/01-empathy-maps.md)
- [Personas](docs/product-discovery/02-personas.md)
- [Product Vision](docs/product-discovery/03-product-vision.md)
- [Story Map](docs/product-discovery/04-story-map.md)
- [User Journeys](docs/product-discovery/05-user-journeys.md)
- [Success Metrics](docs/product-discovery/06-success-metrics.md)
- [Assumptions & Risks](docs/product-discovery/07-assumptions-risks.md)
- [Technical Architecture](docs/product-discovery/08-technical-architecture.md)
- [Research Log](docs/product-discovery/09-research-log.md)
- [Offline-First Sync Flow](docs/OFFLINE_FIRST_SYNC_FLOW.md)

---

## Recent Updates (2026-01)

### Authentication Enhancements
- **Google OAuth Integration**: First-time login via Google, then PIN-based authentication
- **Default PIN Flow**: New users get default PIN ("1234") and must change it immediately
- **JWT Security**: Migrated from localStorage to httpOnly cookies for XSS protection
- **CSRF Protection**: Origin header verification for all API routes
- **Session Management**: Configurable session duration (`SESSION_MAX_AGE_DAYS`) and inactivity timeout (`INACTIVITY_TIMEOUT_MINUTES`)
- **Session Sync**: Zustand store syncs with NextAuth session for consistency

### Multi-User Sync (Phase 2 - Completed)
- **Bidirectional Sync**: Implemented push and pull sync for multi-user collaboration
- **Push Sync**: `/api/sync/push` - Sends queued transactions to PostgreSQL
- **Pull Sync**: `/api/sync/pull` - Fetches changes since last sync timestamp
- **Conflict Resolution**: "Last Write Wins" strategy based on `updatedAt` timestamp
- **Background Sync**: Automatic pull every 5 minutes when online
- **Initial Sync**: Full data pull on first login
- **Sync Status UI**: Shows last push/pull times and pending sync count in Settings page

### App Locking Feature (Completed)
- **Manual Lock**: Lock button in header (between notification badge and avatar)
- **Auto-Lock**: Automatically locks after 5 minutes of inactivity (configurable via `LOCK_TIMEOUT_MINUTES`)
- **PIN Unlock**: 4-digit PIN verification to unlock
- **Biometric Unlock**: WebAuthn fingerprint/face ID support (if device supports)
- **Lock Screen**: Full-screen overlay (z-index 9999) blocking all app interaction
- **Session Persistence**: Lock state persists during session (sessionStorage), clears on refresh
- **Activity Tracking**: Updates activity on lock screen interaction to prevent immediate re-lock

### Key Files Added/Modified

#### New Files
- `src/stores/lock.ts` - Lock state management (Zustand)
- `src/components/LockScreen.tsx` - Lock screen UI with PIN/biometric unlock
- `src/components/AppLockGuard.tsx` - Lock overlay guard component
- `src/lib/client/biometric.ts` - WebAuthn biometric authentication
- `src/lib/shared/config.ts` - Centralized auth configuration

#### Modified Files
- `src/hooks/useActivityMonitor.ts` - Updated for auto-lock integration
- `src/app/api/sync/push/route.ts` - Server-side push sync implementation
- `src/app/api/sync/pull/route.ts` - Server-side pull sync implementation
- `src/lib/client/sync.ts` - Enhanced with pull sync logic and background sync
- `src/components/Header.tsx` - Added lock button
- `src/app/layout.tsx` - Added AppLockGuard wrapper
- `src/components/AuthGuard.tsx` - Added lock state awareness
- `src/app/parametres/page.tsx` - Added sync status UI

---

*Seri - Empowering independent pharmacies in West Africa*
