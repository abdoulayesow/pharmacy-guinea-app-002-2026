# /seri-test - Test Generator

Generate tests for the Seri pharmacy app, focusing on offline scenarios, GNF formatting, and sync behavior.

## Instructions

When the user asks to test a component, feature, or the offline system:

1. **Identify what to test**:
   - Unit tests for utility functions (formatting, calculations)
   - Component tests with mock IndexedDB
   - Integration tests for sync queue
   - E2E tests for critical flows (login, sale)

2. **Set up test environment**:
   - Use Vitest for unit/component tests
   - Use fake-indexeddb for Dexie.js mocking
   - Use MSW for API mocking
   - Use Playwright for E2E

3. **Follow test patterns below**

## Unit Tests - Formatting Functions

```typescript
// src/lib/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatTime } from '../utils';

describe('formatCurrency', () => {
  it('formats GNF with space thousands separator', () => {
    expect(formatCurrency(15000)).toBe('15 000.00 GNF');
    expect(formatCurrency(1500000)).toBe('1 500 000.00 GNF');
    expect(formatCurrency(500)).toBe('500.00 GNF');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('0.00 GNF');
  });

  it('handles decimals', () => {
    expect(formatCurrency(15000.5)).toBe('15 000.50 GNF');
  });
});

describe('formatDate', () => {
  it('formats date as DD/MM/YYYY', () => {
    const date = new Date('2026-01-15');
    expect(formatDate(date)).toBe('15/01/2026');
  });
});

describe('formatTime', () => {
  it('formats time as HH:MM', () => {
    const date = new Date('2026-01-15T14:30:00');
    expect(formatTime(date)).toMatch(/14:30|14h30/);
  });
});
```

## Component Tests with Mock IndexedDB

```typescript
// src/components/__tests__/ProductList.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db';
import ProductList from '../ProductList';

describe('ProductList', () => {
  beforeEach(async () => {
    // Seed test data
    await db.products.bulkAdd([
      { name: 'Paracetamol 500mg', category: 'Antidouleur', price: 15000, stock: 50, minStock: 10, synced: true, updatedAt: new Date() },
      { name: 'Amoxicilline 250mg', category: 'Antibiotique', price: 25000, stock: 5, minStock: 10, synced: true, updatedAt: new Date() },
      { name: 'Ibuprofène 400mg', category: 'Antidouleur', price: 18000, stock: 0, minStock: 5, synced: true, updatedAt: new Date() },
    ]);
  });

  afterEach(async () => {
    await db.products.clear();
  });

  it('displays products from IndexedDB', async () => {
    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
      expect(screen.getByText('Amoxicilline 250mg')).toBeInTheDocument();
    });
  });

  it('shows low stock warning', async () => {
    render(<ProductList />);

    await waitFor(() => {
      // Amoxicilline has stock (5) below minStock (10)
      const amoxRow = screen.getByText('Amoxicilline 250mg').closest('div');
      expect(amoxRow).toHaveClass('bg-yellow-50');
    });
  });

  it('shows out of stock alert', async () => {
    render(<ProductList />);

    await waitFor(() => {
      // Ibuprofène has 0 stock
      const ibuRow = screen.getByText('Ibuprofène 400mg').closest('div');
      expect(ibuRow).toHaveClass('bg-red-50');
    });
  });

  it('filters products by search', async () => {
    render(<ProductList />);
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText(/rechercher/i);
    await user.type(searchInput, 'para');

    await waitFor(() => {
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
      expect(screen.queryByText('Amoxicilline 250mg')).not.toBeInTheDocument();
    });
  });
});
```

## Sync Queue Tests

```typescript
// src/lib/__tests__/sync.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db';
import { queueSync, processSyncQueue } from '../sync';

describe('Sync Queue', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    await db.sales.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds item to sync queue', async () => {
    const salePayload = {
      date: new Date(),
      total: 45000,
      items: [{ productId: 1, quantity: 3, unitPrice: 15000, subtotal: 45000 }],
      paymentMethod: 'CASH',
      userId: 'user1'
    };

    await queueSync('SALE', 'CREATE', salePayload, 1);

    const queueItems = await db.syncQueue.toArray();
    expect(queueItems).toHaveLength(1);
    expect(queueItems[0].type).toBe('SALE');
    expect(queueItems[0].status).toBe('PENDING');
  });

  it('processes queue when online', async () => {
    // Mock navigator.onLine
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ serverId: 100 })
    });

    // Add item to queue
    await db.syncQueue.add({
      type: 'SALE',
      action: 'CREATE',
      payload: { total: 15000 },
      localId: 1,
      createdAt: new Date(),
      status: 'PENDING',
      retryCount: 0
    });

    await processSyncQueue();

    const queueItems = await db.syncQueue.toArray();
    expect(queueItems[0].status).toBe('SYNCED');
  });

  it('retries failed sync up to 3 times', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await db.syncQueue.add({
      type: 'SALE',
      action: 'CREATE',
      payload: { total: 15000 },
      localId: 1,
      createdAt: new Date(),
      status: 'PENDING',
      retryCount: 0
    });

    // Process 3 times
    await processSyncQueue();
    await processSyncQueue();
    await processSyncQueue();

    const queueItems = await db.syncQueue.toArray();
    expect(queueItems[0].retryCount).toBe(3);
    expect(queueItems[0].status).toBe('FAILED');
  });

  it('does not process when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await db.syncQueue.add({
      type: 'SALE',
      action: 'CREATE',
      payload: { total: 15000 },
      localId: 1,
      createdAt: new Date(),
      status: 'PENDING',
      retryCount: 0
    });

    await processSyncQueue();

    const queueItems = await db.syncQueue.toArray();
    expect(queueItems[0].status).toBe('PENDING');
  });
});
```

## PIN Authentication Tests

```typescript
// src/lib/__tests__/auth.test.ts
import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

describe('PIN Authentication', () => {
  it('verifies correct PIN', async () => {
    const pin = '1234';
    const hash = await bcrypt.hash(pin, 10);

    const isValid = await bcrypt.compare('1234', hash);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect PIN', async () => {
    const pin = '1234';
    const hash = await bcrypt.hash(pin, 10);

    const isValid = await bcrypt.compare('9999', hash);
    expect(isValid).toBe(false);
  });

  it('handles 4-digit PINs only', () => {
    const isValidFormat = (pin: string) => /^\d{4}$/.test(pin);

    expect(isValidFormat('1234')).toBe(true);
    expect(isValidFormat('123')).toBe(false);
    expect(isValidFormat('12345')).toBe(false);
    expect(isValidFormat('abcd')).toBe(false);
  });
});
```

## E2E Tests with Playwright

```typescript
// e2e/sale-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sale Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.click('[data-testid="profile-fatoumata"]');
    await page.click('[data-testid="pin-1"]');
    await page.click('[data-testid="pin-2"]');
    await page.click('[data-testid="pin-3"]');
    await page.click('[data-testid="pin-4"]');
    await page.waitForURL('/dashboard');
  });

  test('completes a cash sale', async ({ page }) => {
    // Start new sale
    await page.click('[data-testid="new-sale-btn"]');

    // Search for product
    await page.fill('[data-testid="product-search"]', 'paracetamol');
    await page.click('[data-testid="product-paracetamol"]');

    // Adjust quantity
    await page.click('[data-testid="qty-increase"]');
    await page.click('[data-testid="qty-increase"]');

    // Proceed to payment
    await page.click('[data-testid="proceed-payment"]');

    // Select cash payment
    await page.click('[data-testid="payment-cash"]');
    await page.fill('[data-testid="amount-received"]', '50000');

    // Complete sale
    await page.click('[data-testid="complete-sale"]');

    // Verify receipt
    await expect(page.locator('[data-testid="receipt"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-amount"]')).toContainText('5 000 GNF');
  });

  test('works offline', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);

    // Should still work
    await page.click('[data-testid="new-sale-btn"]');
    await page.fill('[data-testid="product-search"]', 'paracetamol');
    await page.click('[data-testid="product-paracetamol"]');
    await page.click('[data-testid="proceed-payment"]');
    await page.click('[data-testid="payment-cash"]');
    await page.fill('[data-testid="amount-received"]', '20000');
    await page.click('[data-testid="complete-sale"]');

    // Should show pending sync indicator
    await expect(page.locator('[data-testid="sync-pending"]')).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Should sync automatically
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 10000 });
  });
});
```

## Test Setup Files

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Reset IndexedDB between tests
beforeEach(async () => {
  const { db } = await import('@/lib/db');
  await db.delete();
  await db.open();
});
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## Dependencies to Install

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb msw @playwright/test @vitejs/plugin-react jsdom
```
