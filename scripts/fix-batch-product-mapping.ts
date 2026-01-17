/**
 * Fix Product Batch Product ID Mapping
 *
 * Problem: PostgreSQL product IDs (1-10) don't match IndexedDB product IDs (17-26)
 * Solution: Remap batches to use correct IndexedDB product IDs by matching product names
 *
 * Run in browser console at localhost:8888/test-db:
 * - Copy this script
 * - Open DevTools Console
 * - Paste and run
 */

import { db } from '@/lib/client/db';

export async function fixBatchProductMapping() {
  console.log('🔧 Fixing Product Batch Product ID Mapping\n');
  console.log('='.repeat(60));

  try {
    // 1. Get all products from IndexedDB
    const allProducts = await db.products.toArray();
    console.log(`\n📦 Found ${allProducts.length} products in IndexedDB`);

    // Create name → IndexedDB ID mapping
    const nameToIdMap: Record<string, number> = {};
    allProducts.forEach((p) => {
      const normalizedName = p.name.toLowerCase().trim();
      nameToIdMap[normalizedName] = p.id!;
      console.log(`  ${p.name} → ID ${p.id} (serverId: ${p.serverId})`);
    });

    // 2. Get all batches
    const allBatches = await db.product_batches.toArray();
    console.log(`\n🧪 Found ${allBatches.length} batches`);

    if (allBatches.length === 0) {
      console.log('❌ No batches found - sync may have failed');
      return;
    }

    // 3. For each batch, find the correct product ID by looking up serverIdproduct
    let fixed = 0;
    let alreadyCorrect = 0;

    for (const batch of allBatches) {
      // Find the product in IndexedDB that has this serverId
      const correctProduct = allProducts.find((p) => p.serverId === batch.product_id);

      if (!correctProduct) {
        console.warn(`  ⚠️ Batch ${batch.id}: No product found with serverId=${batch.product_id}`);
        continue;
      }

      if (batch.product_id === correctProduct.id) {
        console.log(`  ✓ Batch ${batch.id} already correct (product_id: ${batch.product_id})`);
        alreadyCorrect++;
      } else {
        console.log(`  🔧 Batch ${batch.id}: Fixing product_id ${batch.product_id} → ${correctProduct.id} (${correctProduct.name})`);

        await db.product_batches.update(batch.id!, {
          product_id: correctProduct.id,
        });
        fixed++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Mapping Fix Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Already Correct: ${alreadyCorrect}`);
    console.log(`  Total Batches: ${allBatches.length}`);

    // 4. Verify Paracétamol
    const paracetamol = allProducts.find((p) =>
      p.name.toLowerCase().includes('paracétamol') ||
      p.name.toLowerCase().includes('paracetamol')
    );

    if (paracetamol) {
      const paracetamolBatches = await db.product_batches
        .where('product_id')
        .equals(paracetamol.id!)
        .toArray();

      console.log(`\n💊 Paracétamol Verification:`);
      console.log(`  Product ID: ${paracetamol.id}`);
      console.log(`  Batches: ${paracetamolBatches.length}`);
      paracetamolBatches.forEach((b) => {
        console.log(`    - Lot ${b.lot_number}: ${b.quantity} units`);
      });
    }

    console.log('\n📝 Next Steps:');
    console.log('  1. Refresh the page to see updated results');
    console.log('  2. Try creating a sale with Paracétamol');
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }
}

// Auto-run if this is imported in browser
if (typeof window !== 'undefined') {
  fixBatchProductMapping();
}
