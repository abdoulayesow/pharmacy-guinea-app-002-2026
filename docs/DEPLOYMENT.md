# Seri - Production Deployment Guide

> **Target**: Deploy to Vercel for pharmacy use in Guinea, West Africa

---

## Pre-Deployment Checklist

### Phase 1: Database & Backend Setup

#### 1.1 Neon PostgreSQL Setup
- [ ] Create Neon account at https://neon.tech
- [ ] Create new project: "seri-production"
- [ ] Copy connection string (will be used as `DATABASE_URL`)
- [ ] Note: Neon free tier includes:
  - 0.5 GB storage (sufficient for MVP)
  - Serverless driver (works with Vercel)
  - Auto-pause after inactivity

#### 1.2 Prisma Setup
- [ ] Install Prisma: `npm install -D prisma @prisma/client @prisma/adapter-neon`
- [ ] Install Neon serverless: `npm install @neondatabase/serverless`
- [ ] Create `prisma/schema.prisma` (see schema below)
- [ ] Create `src/lib/server/prisma.ts` client
- [ ] Run: `npx prisma generate`
- [ ] Run: `npx prisma migrate dev --name init`
- [ ] Seed initial data (owner + sample products)

**Prisma Schema** (`prisma/schema.prisma`):
```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  name      String
  pinHash   String   @map("pin_hash")
  role      String   // OWNER | EMPLOYEE
  avatar    String?
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  sales           Sale[]
  expenses        Expense[]
  stockMovements  StockMovement[]

  @@map("users")
}

model Product {
  id            Int       @id @default(autoincrement())
  name          String
  price         Int       // Stored in GNF
  priceBuy      Int?      @map("price_buy")
  stock         Int       @default(0)
  stockMin      Int       @default(10) @map("stock_min")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // Relations
  saleItems       SaleItem[]
  stockMovements  StockMovement[]

  @@map("products")
}

model Sale {
  id              Int       @id @default(autoincrement())
  total           Int
  paymentMethod   String    @map("payment_method") // CASH | ORANGE_MONEY | CREDIT
  paymentStatus   String    @default("PAID") @map("payment_status") // PAID | PENDING | PARTIAL
  paymentRef      String?   @map("payment_ref")
  amountPaid      Int       @default(0) @map("amount_paid")
  amountDue       Int       @default(0) @map("amount_due")
  dueDate         DateTime? @map("due_date")
  customerName    String?   @map("customer_name")
  customerPhone   String?   @map("customer_phone")
  createdAt       DateTime  @default(now()) @map("created_at")
  userId          String    @map("user_id")
  modifiedAt      DateTime? @map("modified_at")
  modifiedBy      String?   @map("modified_by")
  editCount       Int       @default(0) @map("edit_count")

  // Relations
  user            User             @relation(fields: [userId], references: [id])
  items           SaleItem[]
  creditPayments  CreditPayment[]

  @@map("sales")
}

model SaleItem {
  id        Int   @id @default(autoincrement())
  saleId    Int   @map("sale_id")
  productId Int   @map("product_id")
  quantity  Int
  unitPrice Int   @map("unit_price")
  subtotal  Int

  // Relations
  sale      Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])

  @@map("sale_items")
}

model CreditPayment {
  id          Int       @id @default(autoincrement())
  saleId      Int       @map("sale_id")
  amount      Int
  method      String    // CASH | ORANGE_MONEY
  reference   String?
  notes       String?
  createdAt   DateTime  @default(now()) @map("created_at")
  recordedBy  String    @map("recorded_by")

  // Relations
  sale        Sale      @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@map("credit_payments")
}

model Expense {
  id          Int       @id @default(autoincrement())
  amount      Int
  category    String    // STOCK_PURCHASE | RENT | SALARY | ELECTRICITY | TRANSPORT | OTHER
  description String
  date        DateTime  @default(now())
  createdAt   DateTime  @default(now()) @map("created_at")
  userId      String    @map("user_id")

  // Relations
  user        User      @relation(fields: [userId], references: [id])

  @@map("expenses")
}

model StockMovement {
  id             Int       @id @default(autoincrement())
  productId      Int       @map("product_id")
  type           String    // SALE | SALE_EDIT | ADJUSTMENT | INVENTORY | DAMAGED | EXPIRED
  quantityChange Int       @map("quantity_change") // Can be negative
  reason         String?
  createdAt      DateTime  @default(now()) @map("created_at")
  userId         String    @map("user_id")

  // Relations
  product        Product   @relation(fields: [productId], references: [id])
  user           User      @relation(fields: [userId], references: [id])

  @@map("stock_movements")
}
```

#### 1.3 Environment Variables
Create `.env.local` for development:
```env
# Database
DATABASE_URL="postgresql://user:password@region.neon.tech/seri?sslmode=require"

# Auth
JWT_SECRET="generate-strong-random-string-min-32-chars"

# App
NEXT_PUBLIC_APP_URL="http://localhost:8888"

# Rate Limiting (optional)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### Phase 2: Authentication Implementation

#### 2.1 Complete Auth API
- [x] Server-side auth utilities exist (`src/lib/server/auth.ts`)
- [ ] Implement login route (`src/app/api/auth/login/route.ts`)
- [ ] Remove stub 501 response
- [ ] Connect to Prisma to query users
- [ ] Test PIN verification with bcrypt
- [ ] Return JWT token on success

#### 2.2 API Route Protection
- [ ] Create auth middleware for protected routes
- [ ] Add `requireAuth()` to all API routes
- [ ] Add `requireOwner()` to owner-only routes (expenses, settings)
- [ ] Test with invalid/missing tokens

#### 2.3 Client-Side Auth Flow
- [ ] Update login page to call `/api/auth/login`
- [ ] Store JWT token in Zustand auth store
- [ ] Add token to API request headers (`Authorization: Bearer <token>`)
- [ ] Handle 401 responses (redirect to login)
- [ ] Add token refresh logic (optional for MVP)

#### 2.4 Rate Limiting (Recommended)
- [ ] Install: `npm install @upstash/ratelimit @upstash/redis`
- [ ] Create Upstash Redis account (free tier)
- [ ] Add rate limiting to login endpoint (5 attempts/15min)
- [ ] Add general API rate limiting (100 req/15min per IP)

**Example Rate Limiter** (`src/lib/server/ratelimit.ts`):
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const loginRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
});

export const apiRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '15 m'),
  analytics: true,
});
```

---

### Phase 3: Sync Implementation

#### 3.1 Sync Push (Client → Server)
- [ ] Implement `/api/sync/push` endpoint
- [ ] Accept array of pending operations from sync queue
- [ ] Process each operation (CREATE, UPDATE, DELETE)
- [ ] Update Prisma database
- [ ] Return success/failure for each operation
- [ ] Handle conflicts (last-write-wins)

#### 3.2 Sync Pull (Server → Client)
- [ ] Implement `/api/sync/pull` endpoint
- [ ] Accept `lastSyncTime` parameter
- [ ] Return all changes since last sync
- [ ] Include products, sales, expenses
- [ ] Client merges changes into IndexedDB

#### 3.3 Client Sync Logic
- [ ] Trigger sync on network reconnect
- [ ] Background sync every 5 minutes
- [ ] Show sync status indicator in UI
- [ ] Handle sync errors gracefully
- [ ] Retry failed operations with exponential backoff

---

### Phase 4: Vercel Deployment

#### 4.1 Vercel Project Setup
1. [ ] Sign up at https://vercel.com
2. [ ] Connect GitHub repository
3. [ ] Import project: "seri-app"
4. [ ] Configure build settings:
   - Framework: Next.js
   - Build command: `npm run build`
   - Output directory: `.next`
   - Install command: `npm ci`

#### 4.2 Environment Variables (Vercel Dashboard)
Add these in Vercel project settings:
- [ ] `DATABASE_URL` (from Neon)
- [ ] `JWT_SECRET` (generated random string)
- [ ] `NEXT_PUBLIC_APP_URL` (your vercel domain)
- [ ] `UPSTASH_REDIS_REST_URL` (if using rate limiting)
- [ ] `UPSTASH_REDIS_REST_TOKEN` (if using rate limiting)

#### 4.3 Domain Configuration
- [ ] Use default: `seri-app.vercel.app`
- [ ] OR add custom domain (recommended for production)
- [ ] Ensure HTTPS is enabled (automatic with Vercel)

#### 4.4 PWA Configuration
Update `public/manifest.json`:
```json
{
  "name": "Seri - Pharmacie Thierno Mamadou",
  "short_name": "Seri",
  "start_url": "https://your-domain.vercel.app",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#059669",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 4.5 First Deployment
1. [ ] Push to main branch → triggers auto-deploy
2. [ ] Monitor build logs in Vercel dashboard
3. [ ] Run Prisma migrations in production:
   ```bash
   npx prisma migrate deploy
   ```
4. [ ] Seed initial data (owner account)
5. [ ] Test login on production URL

---

### Phase 5: Post-Deployment

#### 5.1 Testing
- [ ] Test login flow on production
- [ ] Test offline functionality (airplane mode)
- [ ] Test sync push/pull
- [ ] Test on actual device (OnePlus 12 in Guinea)
- [ ] Test on low-end Android device if possible
- [ ] Test network reconnection behavior
- [ ] Verify PWA install prompt appears

#### 5.2 Monitoring
- [ ] Enable Vercel Analytics
- [ ] Monitor API error rates
- [ ] Check database connection pool usage (Neon dashboard)
- [ ] Set up error logging (optional: Sentry)
- [ ] Monitor bundle size (should stay < 5MB)

#### 5.3 Security Hardening
- [ ] Review CORS settings (allow only your domain)
- [ ] Enable Vercel DDoS protection
- [ ] Review API rate limits
- [ ] Audit dependencies: `npm audit fix`
- [ ] Enable Content Security Policy headers (optional)
- [ ] Test for common vulnerabilities (OWASP top 10)

#### 5.4 Documentation
- [ ] Document deployment process for team
- [ ] Create runbook for common issues
- [ ] Document database backup procedure
- [ ] Create user training materials (French)
- [ ] Prepare rollback plan

---

## Critical Security Checklist

### Must-Have Before Going Live
- [ ] JWT secret is strong random string (min 32 chars)
- [ ] Database credentials are secret (not in git)
- [ ] PIN verification uses bcrypt (already implemented)
- [ ] All API routes require authentication
- [ ] Rate limiting on login endpoint
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Environment variables in Vercel, not in code

### Recommended Security Enhancements
- [ ] Add request validation with Zod
- [ ] Implement CSRF protection
- [ ] Add security headers (helmet.js or Vercel config)
- [ ] Log suspicious activity
- [ ] Add account lockout after failed attempts (already in client)
- [ ] Regular security audits

---

## Performance Requirements Validation

Before declaring production-ready:
- [ ] Initial load < 3s on 3G
- [ ] Product search < 500ms
- [ ] Bundle size < 5MB
- [ ] Lighthouse score > 90
- [ ] Works 100% offline
- [ ] Sync completes < 30s

---

## Rollback Plan

If deployment fails:
1. Revert to previous Vercel deployment (one-click in dashboard)
2. Roll back database migration: `npx prisma migrate resolve --rolled-back`
3. Notify users via WhatsApp (Mamadou's number)
4. Continue using current system while debugging

---

## Support Plan

### Emergency Contacts
- Developer: [Your contact info]
- Vercel Support: support@vercel.com
- Neon Support: https://neon.tech/docs

### Common Issues & Solutions
**Issue**: App won't load
**Fix**: Check Vercel status, verify DNS, clear browser cache

**Issue**: Sync failing
**Fix**: Check database connection, verify JWT token, check network

**Issue**: Can't login
**Fix**: Verify user exists in database, check PIN hash, check rate limit

---

## Cost Estimate

### Free Tier (Good for 1 pharmacy)
- Vercel: Free (100GB bandwidth, 100 builds/month)
- Neon: Free (0.5GB storage, auto-pause)
- Upstash Redis: Free (10K requests/day)

### Paid Tier (Needed for 10+ pharmacies)
- Vercel Pro: $20/month (improved performance)
- Neon Pro: $19/month (always-on, more storage)
- Upstash: $10/month (100K requests/day)

**Total MVP**: $0/month
**Total Scale**: ~$50/month

---

## Next Steps

1. ✅ Set up GitHub Actions CI (done)
2. ⏳ Set up Neon database
3. ⏳ Implement Prisma schema & migrations
4. ⏳ Complete authentication API
5. ⏳ Implement sync endpoints
6. ⏳ Deploy to Vercel
7. ⏳ Test in Guinea

---

*Last updated: 2026-01-13*
