/**
 * Clean Up Duplicate Paracetamol Products
 *
 * Problem: Two Paracetamol 500mg products exist:
 * - ID 23: No batches, 26 units stock
 * - ID 28: Has batches, 66 units stock
 *
 * Solution:
 * 1. Check if ID 23 has any sales/stock movements
 * 2. If yes, migrate them to ID 28
 * 3. Delete ID 23
 *
 * Run: npx tsx scripts/cleanup-duplicate-paracetamol.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Configure Neon
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function cleanupDuplicateParacetamol() {
  console.log('🧹 Cleaning Up Duplicate Paracetamol Products\n');
  console.log('='.repeat(60));

  try {
    // 1. Find both Paracetamol products
    console.log('\n🔍 Finding Paracetamol products...');

    const paracetamols = await prisma.product.findMany({
      where: {
        name: {
          contains: 'Paracetamol',
          mode: 'insensitive',
        },
      },
      include: {
        batches: true,
        saleItems: true,
        stockMovements: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (paracetamols.length === 0) {
      console.log('  ❌ No Paracetamol products found!');
      return;
    }

    if (paracetamols.length === 1) {
      console.log('  ✅ Only one Paracetamol product found. No cleanup needed.');
      return;
    }

    console.log(`  Found ${paracetamols.length} Paracetamol products:\n`);

    paracetamols.forEach((p, i) => {
      console.log(`  ${i + 1}. ID: ${p.id} | Name: ${p.name} | Stock: ${p.stock}`);
      console.log(`     Batches: ${p.batches.length}`);
      console.log(`     Sale Items: ${p.saleItems.length}`);
      console.log(`     Stock Movements: ${p.stockMovements.length}`);
      console.log('');
    });

    // 2. Identify which to keep and which to delete
    const productToKeep = paracetamols.find((p) => p.batches.length > 0);
    const productToDelete = paracetamols.find(
      (p) => p.batches.length === 0 && p.id !== productToKeep?.id
    );

    if (!productToKeep) {
      console.log('  ❌ No product with batches found! Cannot proceed.');
      return;
    }

    if (!productToDelete) {
      console.log('  ⚠️  All products have batches or only one exists. No cleanup needed.');
      return;
    }

    console.log('📋 Cleanup Plan:');
    console.log(`  KEEP:   ID ${productToKeep.id} - ${productToKeep.name} (${productToKeep.batches.length} batches)`);
    console.log(`  DELETE: ID ${productToDelete.id} - ${productToDelete.name} (${productToDelete.batches.length} batches)`);
    console.log('');

    // 3. Migrate sale items
    if (productToDelete.saleItems.length > 0) {
      console.log(`\n🔄 Migrating ${productToDelete.saleItems.length} sale items...`);

      await prisma.saleItem.updateMany({
        where: {
          productId: productToDelete.id,
        },
        data: {
          productId: productToKeep.id,
        },
      });

      console.log('  ✅ Sale items migrated');
    }

    // 4. Migrate stock movements
    if (productToDelete.stockMovements.length > 0) {
      console.log(`\n🔄 Migrating ${productToDelete.stockMovements.length} stock movements...`);

      await prisma.stockMovement.updateMany({
        where: {
          productId: productToDelete.id,
        },
        data: {
          productId: productToKeep.id,
        },
      });

      console.log('  ✅ Stock movements migrated');
    }

    // 5. Delete the duplicate product
    console.log(`\n🗑️  Deleting duplicate product (ID ${productToDelete.id})...`);

    await prisma.product.delete({
      where: {
        id: productToDelete.id,
      },
    });

    console.log('  ✅ Duplicate product deleted');

    // 6. Verify cleanup
    console.log('\n✅ Cleanup Complete!\n');
    console.log('='.repeat(60));

    const remainingParacetamols = await prisma.product.findMany({
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

    console.log('\n📊 Final State:');
    remainingParacetamols.forEach((p) => {
      console.log(`  Product: ${p.name} (ID: ${p.id})`);
      console.log(`  Stock: ${p.stock} units`);
      console.log(`  Batches: ${p.batches.length}`);

      if (p.batches.length > 0) {
        const totalBatchQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
        console.log(`  Total batch quantity: ${totalBatchQty} units`);

        p.batches.forEach((batch, i) => {
          const daysToExpiry = Math.ceil(
            (batch.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          console.log(
            `    ${i + 1}. Lot ${batch.lotNumber}: ${batch.quantity}/${batch.initialQty} units, expires in ${daysToExpiry} days`
          );
        });
      }
    });

    console.log('\n📝 Next Steps:');
    console.log('  1. Run sync from Settings page in the app');
    console.log('  2. Verify test-db page shows batches for Paracetamol');
    console.log('  3. Test FEFO sale flow with Paracetamol');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateParacetamol();
