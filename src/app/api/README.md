# Seri API Documentation

This directory contains Next.js API Route Handlers for the Seri backend.

## Architecture

- **Current (MVP)**: Offline-first with IndexedDB, API endpoints return 501 (Not Implemented)
- **Phase 2**: Full server sync with Neon PostgreSQL via Prisma
- **Phase 3**: Multi-tenant support, advanced analytics

## Authentication

All endpoints (except `/api/auth/login`) require JWT authentication.

**Header format:**
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Authentication

#### POST /api/auth/login
Authenticate user with PIN and receive JWT token.

**Request:**
```typescript
{
  userId: string;
  pin: string;  // 4 digits
}
```

**Response (Phase 2):**
```typescript
{
  success: true;
  token: string;
  user: {
    id: string;
    name: string;
    role: 'OWNER' | 'EMPLOYEE';
    avatar?: string;
    createdAt: Date;
  };
}
```

**Current (MVP):** Returns 501 (authentication handled client-side)

---

### Sync

#### POST /api/sync/push
Push local changes to server.

**Request:**
```typescript
{
  sales?: Sale[];
  expenses?: Expense[];
  stockMovements?: StockMovement[];
  products?: Product[];
}
```

**Response (Phase 2):**
```typescript
{
  success: true;
  synced: {
    sales: number[];        // Local IDs that were synced
    expenses: number[];
    stockMovements: number[];
    products: number[];
  };
  errors?: string[];
}
```

**Current (MVP):** Returns 501 (sync handled client-side)

---

#### GET /api/sync/pull
Pull server changes to local database.

**Query Params:**
- `lastSyncAt` (optional): ISO 8601 timestamp

**Response (Phase 2):**
```typescript
{
  success: true;
  data: {
    products: Product[];
    sales: Sale[];
    expenses: Expense[];
    stockMovements: StockMovement[];
  };
  serverTime: Date;
}
```

**Current (MVP):** Returns 501 (sync handled client-side)

---

### Products (Phase 2)

#### GET /api/products
List all products.

#### POST /api/products
Create a new product (OWNER only).

#### PUT /api/products/:id
Update a product (OWNER only).

#### DELETE /api/products/:id
Delete a product (OWNER only).

---

### Sales (Phase 2)

#### GET /api/sales
List all sales.

#### POST /api/sales
Create a new sale.

---

### Expenses (Phase 2)

#### GET /api/expenses
List all expenses (OWNER only).

#### POST /api/expenses
Create a new expense (OWNER only).

#### PUT /api/expenses/:id
Update an expense (OWNER only).

#### DELETE /api/expenses/:id
Delete an expense (OWNER only).

---

## Error Responses

All endpoints return consistent error format:

```typescript
{
  success: false;
  error: string;
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
- `501` - Not Implemented (MVP endpoints)

---

## Development Roadmap

### MVP (Current)
- ✅ API structure created
- ✅ Type definitions in `@/lib/shared/types`
- ✅ Auth utilities in `@/lib/server/auth`
- ⏳ Endpoints return 501 (offline-first via IndexedDB)

### Phase 2 (Server Sync)
- [ ] Prisma schema for Neon PostgreSQL
- [ ] Implement all API endpoints
- [ ] JWT authentication
- [ ] Conflict resolution (last-write-wins)
- [ ] Rate limiting
- [ ] Request validation (Zod)

### Phase 3 (Scale)
- [ ] Multi-tenant support
- [ ] Advanced analytics endpoints
- [ ] Webhook notifications
- [ ] OpenAPI/Swagger documentation

---

## Future Android App Integration

The API is designed to be consumed by:
1. **Current PWA**: Next.js frontend calling `/api/*`
2. **Future Android App**: React Native or native Android calling `https://seri.vercel.app/api/*`

All types in `@/lib/shared/types` can be exported as an npm package (`@seri/shared-types`) for the mobile app.

---

## Testing

```bash
# Test auth endpoint (currently returns 501)
curl -X POST http://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-owner-mamadou", "pin": "1234"}'

# Test sync endpoints (require auth token)
curl -X GET http://localhost:8888/api/sync/pull \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:8888/api/sync/push \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sales": []}'
```

---

*Last updated: 2026-01-11*
