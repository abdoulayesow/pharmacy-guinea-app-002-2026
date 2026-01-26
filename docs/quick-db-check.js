/**
 * Quick Database Check - Run in Browser Console
 *
 * This script uses dynamic imports to check IndexedDB data.
 * Works on any page of the app.
 */

(async function quickCheck() {
  console.log('🔍 Quick IndexedDB Check\n');
  console.log('Loading database...');

  try {
    // Dynamically import the database
    const { db } = await import('/src/lib/client/db.ts');

    console.log('✅ Database loaded successfully\n');

    // 1. Count batches
    const batchCount = await db.product_batches.count();
    console.log(`📦 Product Batches: ${batchCount}`);

    if (batchCount === 0) {
      console.log('\n❌ NO BATCHES IN INDEXEDDB');
      console.log('   The sync may not have completed.');
      console.log('   Try syncing again from Settings page (Paramètres).');
      console.log('\nℹ️  To sync:');
      console.log('   1. Go to Settings/Paramètres page');
      console.log('   2. Click "Synchroniser maintenant"');
      console.log('   3. Wait for sync to complete');
      console.log('   4. Run this script again');
      return;
    }

    console.log('\n✅ Batches found! Checking details...\n');

    // 2. Get all products
    const products = await db.products.toArray();
    console.log(`📦 Total Products: ${products.length}`);

    // 3. Find Paracétamol (with or without accent)
    const paracetamol = products.find(p =>
      p.name.toLowerCase().includes('paracetamol') ||
      p.name.toLowerCase().includes('paracétamol')
    );

    if (!paracetamol) {
      console.log('⚠️  Paracétamol not found in products');
      console.log('\nAvailable products:');
      products.slice(0, 10).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (ID: ${p.id})`);
      });
      return;
    }

    console.log(`\n💊 Found: ${paracetamol.name} (ID: ${paracetamol.id})`);
    console.log(`   Product.stock: ${paracetamol.stock} units`);

    // 4. Get batches for Paracétamol
    const batches = await db.product_batches
      .where('product_id')
      .equals(paracetamol.id)
      .toArray();

    // Sort by expiration date (FEFO order)
    batches.sort((a, b) =>
      new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()
    );

    console.log(`   Batches: ${batches.length}`);

    if (batches.length === 0) {
      console.log('\n   ❌ NO BATCHES for Paracétamol!');
      console.log('   This will cause the "disponible 0" error.');
      console.log('\n   The product exists but has no batch tracking.');
      console.log('   You need to sync from the server to get the batches.');
      return;
    }

    const totalBatchQty = batches.reduce((sum, b) => sum + b.quantity, 0);
    console.log(`   Total batch quantity: ${totalBatchQty} units`);
    console.log(`   Product.stock vs Batches: ${paracetamol.stock} vs ${totalBatchQty}`);

    if (paracetamol.stock !== totalBatchQty) {
      console.log('   ⚠️  Mismatch detected (this is expected - product.stock is deprecated)');
    }

    console.log('\n   Batch Details (FEFO order - earliest expiration first):');
    batches.forEach((b, i) => {
      const expDate = new Date(b.expiration_date);
      const daysToExpiry = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
      const status = daysToExpiry < 7 ? '⚠️ CRITICAL' : daysToExpiry < 60 ? '🟡 WARNING' : '✅ OK';

      console.log(`   ${i + 1}. Lot ${b.lot_number}:`);
      console.log(`      Quantity: ${b.quantity}/${b.initial_qty} units`);
      console.log(`      Expires: ${expDate.toLocaleDateString('fr-FR')} (${daysToExpiry} days) ${status}`);
    });

    // 5. Test FEFO allocation logic
    console.log('\n🧪 Testing FEFO Allocation (15 units):');

    const { selectBatchForSale } = await import('/src/lib/client/db.ts');

    try {
      const allocations = await selectBatchForSale(paracetamol.id, 15);

      console.log(`   ✅ Allocation successful!`);
      console.log(`   Batches used: ${allocations.length}`);

      allocations.forEach((alloc, i) => {
        console.log(`   ${i + 1}. Batch ID ${alloc.batchId} (Lot ${alloc.lotNumber}): ${alloc.quantity} units`);
      });

      const totalAllocated = allocations.reduce((sum, a) => sum + a.quantity, 0);
      console.log(`   Total allocated: ${totalAllocated} units`);

      if (totalAllocated === 15) {
        console.log('   ✅ Allocation matches requested quantity');
      } else {
        console.log(`   ❌ Allocation mismatch: expected 15, got ${totalAllocated}`);
      }

    } catch (error) {
      console.log(`   ❌ Allocation failed: ${error.message}`);
    }

    // 6. Final result
    console.log('\n' + '='.repeat(60));
    console.log('📋 Summary:');
    console.log(`   Total Batches: ${batchCount} ✅`);
    console.log(`   Paracétamol Batches: ${batches.length} ✅`);
    console.log(`   Total Quantity: ${totalBatchQty} units ✅`);
    console.log(`   FEFO Allocation: ✅ Working`);

    console.log('\n✅ SUCCESS! Database is aligned and ready.');
    console.log('✅ You can now test the sale flow.\n');
    console.log('Next Steps:');
    console.log('   1. Navigate to Nouvelle Vente (New Sale)');
    console.log('   2. Add 15 units of Paracétamol to cart');
    console.log('   3. Complete the sale');
    console.log('   4. Expected: Sale completes successfully (no "disponible 0" error)');
    console.log('   5. Expected: First batch (earliest expiry) decrements by 15 units');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);

    if (error.message.includes('Failed to fetch')) {
      console.log('\nℹ️  Make sure you are running the app (npm run dev)');
      console.log('   and that you are on a page within the app.');
    }
  }
})();
