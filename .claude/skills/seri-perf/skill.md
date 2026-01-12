# /seri-perf - Performance Optimizer

Analyze and optimize the Seri pharmacy app to meet strict performance budgets for low-end Android devices on 3G networks.

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Bundle size (gzipped) | < 300KB | < 500KB |
| JavaScript | < 200KB | < 300KB |
| CSS | < 30KB | < 50KB |
| First Contentful Paint | < 1.5s | < 2s |
| Time to Interactive | < 3s | < 4s |
| Largest Contentful Paint | < 2.5s | < 3s |
| Product search latency | < 500ms | < 1s |
| Lighthouse score | > 90 | > 80 |

## Instructions

When the user asks to optimize performance, check bundle size, or improve speed:

1. **Analyze current state** using the commands below
2. **Identify issues** against targets
3. **Apply optimizations** in priority order
4. **Verify improvements** with measurements

## Bundle Analysis

### Analyze Bundle Size

```bash
# Build and analyze
npm run build

# Use @next/bundle-analyzer
ANALYZE=true npm run build

# Or use source-map-explorer
npx source-map-explorer .next/static/chunks/*.js
```

### Next.js Config for Analysis

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression
  compress: true,

  // Optimize images
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Production optimizations
  productionBrowserSourceMaps: false,

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'dexie-react-hooks'],
  },
};

module.exports = withBundleAnalyzer(nextConfig);
```

## Code Splitting Strategies

### Route-Based Splitting (Automatic)

Next.js App Router automatically code-splits by route. Ensure each route is a separate file:

```
src/app/
├── page.tsx           # Landing/redirect
├── login/page.tsx     # Login chunk
├── dashboard/page.tsx # Dashboard chunk
├── ventes/page.tsx    # Sales chunk
├── stocks/page.tsx    # Inventory chunk
└── depenses/page.tsx  # Expenses chunk
```

### Dynamic Imports for Heavy Components

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const ProductSearch = dynamic(() => import('@/components/ProductSearch'), {
  loading: () => <div className="h-12 bg-gray-100 animate-pulse rounded" />,
  ssr: false, // Client-only for IndexedDB access
});

const Receipt = dynamic(() => import('@/components/Receipt'), {
  loading: () => <div>Chargement...</div>,
});
```

### Lazy Load Icons

```typescript
// Instead of importing all icons
// BAD: import { ShoppingCart, Package, Wallet } from 'lucide-react';

// GOOD: Import individually
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Package from 'lucide-react/dist/esm/icons/package';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
```

## Tailwind CSS Optimization

### Purge Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    // DO NOT include node_modules or large directories
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### Remove Unused CSS

```bash
# Check CSS size after build
ls -la .next/static/css/

# Target: < 30KB gzipped
```

## IndexedDB Performance

### Efficient Queries

```typescript
// BAD: Load all products then filter
const products = await db.products.toArray();
const filtered = products.filter(p => p.name.includes(search));

// GOOD: Use indexed query
const filtered = await db.products
  .where('name')
  .startsWithIgnoreCase(search)
  .limit(20) // Limit results
  .toArray();
```

### Add Indexes for Search

```typescript
// src/lib/db.ts
class SeriDatabase extends Dexie {
  constructor() {
    super('seri-db');
    this.version(1).stores({
      products: '++id, serverId, *name, category, synced', // *name for full-text
      sales: '++id, serverId, date, userId, synced',
      // ...
    });
  }
}
```

### Batch Operations

```typescript
// BAD: Individual updates
for (const item of items) {
  await db.products.update(item.id, { stock: item.newStock });
}

// GOOD: Batch update
await db.transaction('rw', db.products, async () => {
  for (const item of items) {
    await db.products.update(item.id, { stock: item.newStock });
  }
});
```

## Search Performance (< 500ms)

```typescript
// src/hooks/useProductSearch.ts
import { useState, useMemo, useTransition } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function useProductSearch() {
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  // Debounced search
  const debouncedSearch = useDebouncedValue(search, 150);

  const products = useLiveQuery(
    async () => {
      if (!debouncedSearch) {
        return db.products.limit(50).toArray();
      }

      const searchLower = debouncedSearch.toLowerCase();
      return db.products
        .filter(p => p.name.toLowerCase().includes(searchLower))
        .limit(20)
        .toArray();
    },
    [debouncedSearch]
  ) ?? [];

  const handleSearch = (value: string) => {
    startTransition(() => {
      setSearch(value);
    });
  };

  return { products, search, setSearch: handleSearch, isPending };
}

// Debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## PWA Optimization

### Service Worker Caching

```javascript
// next.config.js with next-pwa
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
      },
    },
    {
      urlPattern: /\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api',
        networkTimeoutSeconds: 10,
      },
    },
  ],
  disable: process.env.NODE_ENV === 'development',
});
```

### Preload Critical Assets

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://api.example.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Lighthouse Audit

### Run Audit

```bash
# Using Lighthouse CLI
npx lighthouse http://localhost:3000 --view

# Or in Chrome DevTools
# 1. Open DevTools (F12)
# 2. Go to Lighthouse tab
# 3. Select "Mobile" and run audit
```

### Key Metrics to Check

1. **Performance** (target: > 90)
   - FCP, LCP, TTI, TBT, CLS

2. **PWA** (target: all green)
   - Installable
   - Works offline
   - HTTPS

3. **Best Practices** (target: > 90)
   - No console errors
   - Secure connections

## Performance Monitoring Script

```typescript
// src/lib/perf.ts
export function measurePerformance() {
  if (typeof window === 'undefined') return;

  // Core Web Vitals
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(console.log);
    onFCP(console.log);
    onLCP(console.log);
    onTTFB(console.log);
    onINP(console.log);
  });
}

// Measure search performance
export function measureSearchLatency(searchFn: () => Promise<any>) {
  return async (query: string) => {
    const start = performance.now();
    const result = await searchFn();
    const duration = performance.now() - start;

    if (duration > 500) {
      console.warn(`Search took ${duration}ms (target: <500ms)`);
    }

    return result;
  };
}
```

## Quick Wins Checklist

- [ ] Enable Next.js compression
- [ ] Use dynamic imports for heavy components
- [ ] Import icons individually from lucide-react
- [ ] Add `loading` states to all dynamic imports
- [ ] Limit IndexedDB query results
- [ ] Use indexes for frequently searched fields
- [ ] Debounce search input (150-200ms)
- [ ] Enable Tailwind purge
- [ ] Use system fonts only (`font-family: system-ui`)
- [ ] Compress images with WebP format
- [ ] Cache static assets aggressively
- [ ] Run Lighthouse audit and fix red items
