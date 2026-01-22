/**
 * Database Seed Script
 *
 * Creates initial data for Seri pharmacy app:
 * - Owner account (Mamadou)
 * - Sample products for testing
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { hash } from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';

// Configure Neon WebSocket for Node.js environment
// Use dynamic import to handle ESM/CJS interop with Node.js v24
async function setupWebSocket() {
  const ws = await import('ws');
  neonConfig.webSocketConstructor = ws.default;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Setup WebSocket for Neon
  await setupWebSocket();

  // Verify DATABASE_URL is set
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create Prisma Client with Neon adapter
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Create owner accounts
    console.log('👤 Creating owner accounts...');

    const ownerPIN = '1234'; // Default PIN - CHANGE IN PRODUCTION
    const pinHash = await hash(ownerPIN, 10);

    const owners = [
      {
        id: 'owner-oumar-sow',
        name: 'Oumar Sow',
        email: 'marsow07@gmail.com',
        phone: '+224 623 45 50 66',
      },
      {
        id: 'owner-abdoulaye-sow',
        name: 'Abdoulaye Sow',
        email: 'abdoulaye.sow.1989@gmail.com',
        phone: '+336 77 47 31 63',
      },
      {
        id: 'owner-binta-bah',
        name: 'Binta Bah',
        email: 'bintabah708@yahoo.fr',
        phone: '+224 664 61 63 72',
      },
    ];

    for (const ownerData of owners) {
      const owner = await prisma.user.upsert({
        where: { id: ownerData.id },
        update: {},
        create: {
          id: ownerData.id,
          name: ownerData.name,
          email: ownerData.email,
          phone: ownerData.phone,
          pinHash,
          role: 'OWNER',
          avatar: null,
        },
      });
      console.log('✅ Owner created:', owner.name, `(${owner.email}, ${owner.phone}, PIN: 1234)`);
    }

    // Create or update sample products (upsert to prevent duplicates)
    console.log('📦 Creating/updating sample products...');

    const products = [
      {
        name: 'Paracétamol 500mg',
        price: 1000,
        priceBuy: 600,
        stock: 100,
        minStock: 20,
      },
      {
        name: 'Ibuprofène 400mg',
        price: 1500,
        priceBuy: 900,
        stock: 80,
        minStock: 15,
      },
      {
        name: 'Amoxicilline 500mg',
        price: 3000,
        priceBuy: 2000,
        stock: 50,
        minStock: 10,
      },
      {
        name: 'Vitamine C 1000mg',
        price: 2000,
        priceBuy: 1200,
        stock: 60,
        minStock: 15,
      },
      {
        name: 'Sirop contre la toux',
        price: 4000,
        priceBuy: 2500,
        stock: 30,
        minStock: 10,
      },
      {
        name: 'Aspirine 100mg',
        price: 800,
        priceBuy: 500,
        stock: 120,
        minStock: 25,
      },
      {
        name: 'Oméprazole 20mg',
        price: 2500,
        priceBuy: 1500,
        stock: 40,
        minStock: 10,
      },
      {
        name: 'Métronidazole 500mg',
        price: 1800,
        priceBuy: 1100,
        stock: 45,
        minStock: 12,
      },
    ];

    const createdProducts = [];
    for (const product of products) {
      // Use upsert to prevent duplicates - match by name
      const existing = await prisma.product.findFirst({
        where: { name: product.name },
      });

      const created = await prisma.product.upsert({
        where: { id: existing?.id ?? createId() }, // Use existing ID or new CUID if not found
        update: {
          price: product.price,
          priceBuy: product.priceBuy,
          minStock: product.minStock,
          // Don't update stock - it may have changed from sales
        },
        create: product,
      });
      createdProducts.push(created);
    }

    console.log(`✅ Created/updated ${products.length} sample products`);

    // 🆕 Phase 3: Create product batches for FEFO tracking
    console.log('📦 Creating product batches...');

    const today = new Date();
    const batches = [
      // Paracétamol 500mg (Product 1) - 100 units total across 3 batches
      {
        productId: createdProducts[0].id,
        lotNumber: 'LOT-2026-001',
        expirationDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days (critical)
        quantity: 30,
        initialQty: 30,
        receivedDate: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      },
      {
        productId: createdProducts[0].id,
        lotNumber: 'LOT-2026-002',
        expirationDate: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days (warning)
        quantity: 50,
        initialQty: 50,
        receivedDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
      {
        productId: createdProducts[0].id,
        lotNumber: 'LOT-2026-003',
        expirationDate: new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000), // 120 days (ok)
        quantity: 20,
        initialQty: 20,
        receivedDate: today,
      },
      // Ibuprofène 400mg (Product 2) - 80 units
      {
        productId: createdProducts[1].id,
        lotNumber: 'LOT-2026-004',
        expirationDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
        quantity: 80,
        initialQty: 80,
        receivedDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
      // Amoxicilline 500mg (Product 3) - 50 units
      {
        productId: createdProducts[2].id,
        lotNumber: 'LOT-2026-005',
        expirationDate: new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000), // 180 days
        quantity: 50,
        initialQty: 50,
        receivedDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      // Vitamine C 1000mg (Product 4) - 60 units
      {
        productId: createdProducts[3].id,
        lotNumber: 'LOT-2026-006',
        expirationDate: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000), // 365 days
        quantity: 60,
        initialQty: 60,
        receivedDate: today,
      },
      // Sirop contre la toux (Product 5) - 30 units
      {
        productId: createdProducts[4].id,
        lotNumber: 'LOT-2026-007',
        expirationDate: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days
        quantity: 30,
        initialQty: 30,
        receivedDate: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
      // Aspirine 100mg (Product 6) - 120 units
      {
        productId: createdProducts[5].id,
        lotNumber: 'LOT-2026-008',
        expirationDate: new Date(today.getTime() + 200 * 24 * 60 * 60 * 1000), // 200 days
        quantity: 120,
        initialQty: 120,
        receivedDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      // Oméprazole 20mg (Product 7) - 40 units
      {
        productId: createdProducts[6].id,
        lotNumber: 'LOT-2026-009',
        expirationDate: new Date(today.getTime() + 150 * 24 * 60 * 60 * 1000), // 150 days
        quantity: 40,
        initialQty: 40,
        receivedDate: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
      // Métronidazole 500mg (Product 8) - 45 units
      {
        productId: createdProducts[7].id,
        lotNumber: 'LOT-2026-010',
        expirationDate: new Date(today.getTime() + 100 * 24 * 60 * 60 * 1000), // 100 days
        quantity: 45,
        initialQty: 45,
        receivedDate: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const batch of batches) {
      // Use upsert to prevent duplicate batches - match by product + lot number
      const existing = await prisma.productBatch.findFirst({
        where: {
          productId: batch.productId,
          lotNumber: batch.lotNumber,
        },
      });

      await prisma.productBatch.upsert({
        where: { id: existing?.id ?? createId() },
        update: {
          // Update quantities and dates if batch exists
          quantity: batch.quantity,
          expirationDate: batch.expirationDate,
        },
        create: batch,
      });
    }

    console.log(`✅ Created/updated ${batches.length} product batches (FEFO tracking enabled)`);

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('Login credentials (all owners):');
    console.log('  - Oumar Sow (marsow07@gmail.com)');
    console.log('  - Abdoulaye Sow (abdoulaye.sow.1989@gmail.com)');
    console.log('  - Binta Bah (bintabah708@yahoo.fr)');
    console.log('  - Default PIN for all: 1234');
    console.log('\n⚠️  Remember to change the default PINs in production!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
