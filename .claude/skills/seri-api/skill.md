# /seri-api - API Endpoint Generator

Generate Next.js API routes with Neon PostgreSQL and Prisma for Seri.

## Instructions

1. Create Next.js Route Handlers in `src/app/api/`
2. Use Prisma with Neon adapter for database operations
3. Add JWT authentication middleware
4. Handle sync payloads from offline queue
5. Return proper JSON responses

## API Route Template

```typescript
// src/app/api/{resource}/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await prisma.resource.findMany();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = await prisma.resource.create({ data: body });
  return NextResponse.json(result, { status: 201 });
}
```

## Auth Helper

```typescript
// src/lib/auth.ts
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function verifyAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
```

## Endpoints to Create

- `POST /api/auth/login` - Verify PIN, return JWT
- `POST /api/sync` - Handle sync queue items
- `GET/POST /api/products` - Product CRUD
- `GET/POST /api/sales` - Sales
- `GET/POST /api/expenses` - Expenses (OWNER only)
- `GET/POST /api/stock-movements` - Stock adjustments
