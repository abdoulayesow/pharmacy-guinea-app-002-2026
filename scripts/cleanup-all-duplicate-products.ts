/**
 * Clean Up ALL Duplicate Products
 *
 * Problem: Multiple seed runs created duplicate products
 * Solution: Keep the product with batches (or highest ID if none have batches),
 *           migrate all sales/movements, delete duplicates
 *
 * Run: npx tsx scripts/cleanup-all-duplicate-products.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

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

async function cleanupAllDuplicates() {
  console.log('🧹 Cleaning Up ALL Duplicate Products\n');
  console.log('='.repeat(60));

  try {
    // 1. Find all products grouped by name
    console.log('\n🔍 Analyzing products...');

    const allProducts = await prisma.product.findMany({
      include: {
        batches: true,
        saleItems: true,
        stockMovements: true,
      },
      orderBy: { id: 'asc' },
    });

    // Group by name (case-insensitive)
    const productsByName: Record<string, any[]> = {};
    for (const product of allProducts) {
      const normalizedName = product.name.toLowerCase().trim();
      if (!productsByName[normalizedName]) {
        productsByName[normalizedName] = [];
      }
      productsByName[normalizedName].push(product);
    }

    // 2. Identify duplicates
    const duplicateGroups = Object.entries(productsByName).filter(
      ([_, products]) => products.length > 1
    );

    if (duplicateGroups.length === 0) {
      console.log('  ✅ No duplicate products found!');
      return;
    }

    console.log(`\n📋 Found duplicates for ${duplicateGroups.length} product name(s):\n`);

    let totalDeleted = 0;

    for (const [normalizedName, products] of duplicateGroups) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Product: ${products[0].name}`);
      console.log(`Duplicates: ${products.length} copies\n`);

      // Show all copies
      products.forEach((p, i) => {
        console.log(`  ${i + 1}. ID: ${p.id} | Stock: ${p.stock} | Batches: ${p.batches.length} | Sales: ${p.saleItems.length} | Movements: ${p.stockMovements.length}`);
      });

      // Decide which to keep:
      // Priority 1: Product with batches
      // Priority 2: Product with most sales/movements
      // Priority 3: Highest ID (most recent)
      const productWithBatches = products.find((p) => p.batches.length > 0);
      const productWithMostActivity = products.reduce((max, p) =>
        p.saleItems.length + p.stockMovements.length >
        max.saleItems.length + max.stockMovements.length
          ? p
          : max
      );
      const productToKeep =
        productWithBatches ||
        productWithMostActivity ||
        products[products.length - 1]; // Fallback to highest ID

      const productsToDelete = products.filter((p) => p.id !== productToKeep.id);

      console.log(`\n✅ KEEP:   ID ${productToKeep.id} (${productToKeep.batches.length} batches, ${productToKeep.saleItems.length} sales, ${productToKeep.stockMovements.length} movements)`);
      console.log(`❌ DELETE: ${productsToDelete.length} duplicate(s)`);

      // Migrate data from each duplicate to the one we're keeping
      for (const duplicate of productsToDelete) {
        console.log(`\n  🔄 Migrating data from ID ${duplicate.id}...`);

        // Migrate sale items
        if (duplicate.saleItems.length > 0) {
          await prisma.saleItem.updateMany({
            where: { productId: duplicate.id },
            data: { productId: productToKeep.id },
          });
          console.log(`     ✓ Migrated ${duplicate.saleItems.length} sale items`);
        }

        // Migrate stock movements
        if (duplicate.stockMovements.length > 0) {
          await prisma.stockMovement.updateMany({
            where: { productId: duplicate.id },
            data: { productId: productToKeep.id },
          });
          console.log(`     ✓ Migrated ${duplicate.stockMovements.length} stock movements`);
        }

        // Migrate supplier order items if any
        const supplierOrderItems = await prisma.supplierOrderItem.count({
          where: { productId: duplicate.id },
        });
        if (supplierOrderItems > 0) {
          await prisma.supplierOrderItem.updateMany({
            where: { productId: duplicate.id },
            data: { productId: productToKeep.id },
          });
          console.log(`     ✓ Migrated ${supplierOrderItems} supplier order items`);
        }

        // Delete the duplicate
        await prisma.product.delete({
          where: { id: duplicate.id },
        });
        console.log(`     ✓ Deleted product ID ${duplicate.id}`);
        totalDeleted++;
      }
    }

    // 3. Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('\n✅ Cleanup Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`  Total products deleted: ${totalDeleted}`);
    console.log(`  Duplicate groups resolved: ${duplicateGroups.length}`);

    // Verify final state
    const finalProducts = await prisma.product.findMany({
      include: {
        batches: {
          orderBy: { expirationDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    console.log(`\n📦 Final product list (${finalProducts.length} products):\n`);

    finalProducts.forEach((p) => {
      const batchInfo = p.batches.length > 0
        ? `${p.batches.length} batch(es), ${p.batches.reduce((sum, b) => sum + b.quantity, 0)} units`
        : 'No batches';
      console.log(`  ${p.name.padEnd(30)} | Stock: ${String(p.stock).padStart(3)} | ${batchInfo}`);
    });

    console.log('\n📝 Next Steps:');
    console.log('  1. Clear IndexedDB (delete database in browser DevTools)');
    console.log('  2. Run sync from Settings page to pull clean data');
    console.log('  3. Test FEFO sale flow with Paracétamol');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

cleanupAllDuplicates();
