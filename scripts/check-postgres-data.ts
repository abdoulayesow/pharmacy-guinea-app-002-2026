/**
 * PostgreSQL Database Data Check
 *
 * Run: npx tsx scripts/check-postgres-data.ts
 *
 * Checks:
 * 1. Table record counts
 * 2. Product batch data
 * 3. Sample products
 */

import 'dotenv/config'; // Load .env file
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Configure Neon to use WebSocket in Node.js environment
neonConfig.webSocketConstructor = ws;

// Create Prisma Client with Neon adapter
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function checkPostgresData() {
  console.log('🔍 PostgreSQL Database Data Check\n');
  console.log('='.repeat(60));

  try {
    // 1. Table counts
    console.log('\n📊 Table Record Counts:');

    const userCount = await prisma.user.count();
    console.log(`  Users:                  ${userCount}`);

    const productCount = await prisma.product.count();
    console.log(`  Products:               ${productCount}`);

    const batchCount = await prisma.productBatch.count();
    console.log(`  Product Batches:        ${batchCount}`);

    const saleCount = await prisma.sale.count();
    console.log(`  Sales:                  ${saleCount}`);

    const saleItemCount = await prisma.saleItem.count();
    console.log(`  Sale Items:             ${saleItemCount}`);

    const expenseCount = await prisma.expense.count();
    console.log(`  Expenses:               ${expenseCount}`);

    const stockMovementCount = await prisma.stockMovement.count();
    console.log(`  Stock Movements:        ${stockMovementCount}`);

    const supplierCount = await prisma.supplier.count();
    console.log(`  Suppliers:              ${supplierCount}`);

    const supplierOrderCount = await prisma.supplierOrder.count();
    console.log(`  Supplier Orders:        ${supplierOrderCount}`);

    const supplierOrderItemCount = await prisma.supplierOrderItem.count();
    console.log(`  Supplier Order Items:   ${supplierOrderItemCount}`);

    // 2. Product Batches Detail
    console.log('\n📦 Product Batches Detail:');

    if (batchCount === 0) {
      console.log('  ❌ NO BATCHES FOUND IN POSTGRESQL');
      console.log('  This is unexpected! Seed script should have created batches.');
    } else {
      const batches = await prisma.productBatch.findMany({
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          productId: 'asc',
        },
      });

      console.log(`  Found ${batches.length} batches:\n`);

      // Group by product
      const batchesByProduct: Record<string, any[]> = {};
      for (const batch of batches) {
        if (!batchesByProduct[batch.productId]) {
          batchesByProduct[batch.productId] = [];
        }
        batchesByProduct[batch.productId].push(batch);
      }

      for (const [productId, productBatches] of Object.entries(batchesByProduct)) {
        const totalQty = productBatches.reduce((sum, b) => sum + b.quantity, 0);
        const productName = productBatches[0].product.name;

        console.log(`  Product: ${productName} (ID: ${productId})`);
        console.log(`  Total quantity: ${totalQty} units`);

        productBatches.forEach((batch, i) => {
          const daysToExpiry = Math.ceil(
            (batch.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          console.log(
            `    ${i + 1}. Lot ${batch.lotNumber}: ${batch.quantity}/${batch.initialQty} units, expires in ${daysToExpiry} days`
          );
        });
        console.log('');
      }
    }

    // 3. Sample Products
    console.log('🏥 Sample Products:');
    const products = await prisma.product.findMany({
      take: 5,
      orderBy: {
        id: 'asc',
      },
    });

    products.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - Stock: ${p.stock} units, Price: ${p.price} GNF`);
    });

    // 4. Paracetamol Test Case
    console.log('\n💊 Paracetamol Test Case:');
    const paracetamol = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'Paracetamol',
          mode: 'insensitive',
        },
      },
      include: {
        batches: {
          orderBy: {
            expirationDate: 'asc',
          },
        },
      },
    });

    if (paracetamol) {
      console.log(`  Product: ${paracetamol.name}`);
      console.log(`  Product.stock: ${paracetamol.stock} units`);
      console.log(`  Batches found: ${paracetamol.batches.length}`);

      if (paracetamol.batches.length === 0) {
        console.log('  ❌ NO BATCHES - Seed script may have failed!');
      } else {
        const totalBatchQty = paracetamol.batches.reduce((sum, b) => sum + b.quantity, 0);
        console.log(`  Total batch quantity: ${totalBatchQty} units`);

        paracetamol.batches.forEach((batch, i) => {
          const daysToExpiry = Math.ceil(
            (batch.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          console.log(
            `    ${i + 1}. Lot ${batch.lotNumber}: ${batch.quantity}/${batch.initialQty} units, expires in ${daysToExpiry} days`
          );
        });
      }
    } else {
      console.log('  ⚠️  Paracetamol not found in database');
    }

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 PostgreSQL Summary:');
    console.log(`  Products:        ${productCount}`);
    console.log(`  Product Batches: ${batchCount} ${batchCount > 0 ? '✓' : '❌'}`);
    console.log(`  Sales:           ${saleCount}`);
    console.log(`  Expenses:        ${expenseCount}`);

    if (batchCount === 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('  Run: npx tsx prisma/seed.ts');
      console.log('  This will create product batches in PostgreSQL.');
    } else {
      console.log('\n✅ PostgreSQL has batch data!');
      console.log('\nNext step: Verify IndexedDB has the same data');
      console.log('  1. Run the browser console script: docs/verify-db-alignment.js');
      console.log('  2. If IndexedDB is missing batches, run sync from Settings page');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkPostgresData();
