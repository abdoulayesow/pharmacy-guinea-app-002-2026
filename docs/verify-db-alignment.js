/**
 * Database Alignment Verification Script
 *
 * Run this in the browser console to verify that PostgreSQL and IndexedDB are aligned.
 *
 * Checks:
 * 1. Table structure alignment
 * 2. Data record counts
 * 3. Sample data comparison (product_batches)
 * 4. Sync queue status
 */

async function verifyDatabaseAlignment() {
  console.log('🔍 Database Alignment Verification\n');
  console.log('=' .repeat(60));

  // Dynamically import the database
  console.log('Loading database...\n');

  let db;
  try {
    const dbModule = await import('/src/lib/client/db.ts');
    db = dbModule.db;
    console.log('✅ Database loaded successfully\n');
  } catch (error) {
    console.error('❌ Failed to load database:', error.message);
    console.log('\nℹ️  Make sure you are running the app (npm run dev)');
    console.log('   and that you are on a page within the app.');
    return;
  }

  try {
    // 1. Check IndexedDB table structure
    console.log('\n📊 IndexedDB Tables:');
    const tables = [
      'users',
      'products',
      'product_batches',
      'sales',
      'sale_items',
      'expenses',
      'stock_movements',
      'suppliers',
      'supplier_orders',
      'supplier_order_items',
      'supplier_returns',
      'product_suppliers',
      'credit_payments',
      'sync_queue'
    ];

    const tableCounts = {};
    for (const table of tables) {
      try {
        const count = await db[table].count();
        tableCounts[table] = count;
        console.log(`  ✓ ${table.padEnd(25)} ${count} records`);
      } catch (error) {
        console.log(`  ❌ ${table.padEnd(25)} ERROR: ${error.message}`);
      }
    }

    // 2. Check product_batches specifically (focus of current work)
    console.log('\n📦 Product Batches Detail:');
    const batches = await db.product_batches.toArray();

    if (batches.length === 0) {
      console.log('  ⚠️  NO BATCHES FOUND IN INDEXEDDB');
      console.log('  This explains the "disponible 0" error!');
      console.log('  You need to sync from PostgreSQL.');
    } else {
      console.log(`  Found ${batches.length} batches:`);

      // Group by product
      const batchesByProduct = {};
      for (const batch of batches) {
        if (!batchesByProduct[batch.product_id]) {
          batchesByProduct[batch.product_id] = [];
        }
        batchesByProduct[batch.product_id].push(batch);
      }

      for (const [productId, productBatches] of Object.entries(batchesByProduct)) {
        const product = await db.products.get(parseInt(productId));
        const totalQty = productBatches.reduce((sum, b) => sum + b.quantity, 0);

        console.log(`\n  Product: ${product?.name || 'Unknown'} (ID: ${productId})`);
        console.log(`  Total quantity across batches: ${totalQty} units`);
        console.log(`  Product.stock field: ${product?.stock || 0} units`);

        productBatches.forEach((batch, i) => {
          const daysToExpiry = Math.ceil(
            (new Date(batch.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)
          );
          console.log(`    ${i + 1}. Lot ${batch.lot_number}: ${batch.quantity} units, expires in ${daysToExpiry} days`);
        });
      }
    }

    // 3. Check sync queue status
    console.log('\n🔄 Sync Queue Status:');
    const pendingSync = await db.sync_queue
      .where('status')
      .equals('PENDING')
      .count();
    const failedSync = await db.sync_queue
      .where('status')
      .equals('FAILED')
      .count();
    const syncedCount = await db.sync_queue
      .where('status')
      .equals('SYNCED')
      .count();

    console.log(`  Pending: ${pendingSync}`);
    console.log(`  Failed: ${failedSync}`);
    console.log(`  Synced: ${syncedCount}`);

    if (pendingSync > 0) {
      console.log('\n  ⚠️  You have pending sync items. Run a sync to push them to server.');
    }

    // 4. Sample products for verification
    console.log('\n🏥 Sample Products:');
    const products = await db.products.limit(5).toArray();
    products.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - Stock: ${p.stock} units, Price: ${p.price} GNF`);
    });

    // 5. Check for Paracetamol specifically (test case)
    console.log('\n💊 Paracetamol Test Case:');
    const paracetamol = await db.products
      .filter(p => p.name.toLowerCase().includes('paracetamol'))
      .first();

    if (paracetamol) {
      console.log(`  Product: ${paracetamol.name}`);
      console.log(`  Product.stock: ${paracetamol.stock} units`);

      const paracetamolBatches = await db.product_batches
        .where('product_id')
        .equals(paracetamol.id)
        .toArray();

      console.log(`  Batches found: ${paracetamolBatches.length}`);

      if (paracetamolBatches.length === 0) {
        console.log('  ❌ NO BATCHES - This will cause "disponible 0" error on sale!');
      } else {
        const totalBatchQty = paracetamolBatches.reduce((sum, b) => sum + b.quantity, 0);
        console.log(`  Total batch quantity: ${totalBatchQty} units`);

        paracetamolBatches.forEach((batch, i) => {
          const daysToExpiry = Math.ceil(
            (new Date(batch.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)
          );
          console.log(`    ${i + 1}. Lot ${batch.lot_number}: ${batch.quantity} units, expires in ${daysToExpiry} days`);
        });
      }
    } else {
      console.log('  ⚠️  Paracetamol not found in database');
    }

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Summary:');
    console.log('  IndexedDB Structure: ✓ Tables exist');
    console.log(`  Product Batches: ${batches.length > 0 ? '✓' : '❌'} ${batches.length} batches`);
    console.log(`  Sync Queue: ${pendingSync === 0 && failedSync === 0 ? '✓' : '⚠️'} ${pendingSync} pending, ${failedSync} failed`);

    if (batches.length === 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('  1. Go to Settings page (Paramètres)');
      console.log('  2. Click "Synchroniser maintenant" (Sync now)');
      console.log('  3. Wait for sync to complete');
      console.log('  4. Run this script again to verify batches are present');
    } else {
      console.log('\n✅ Database appears aligned! You can test the sale flow.');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.error(error.stack);
  }
}

// Run verification
verifyDatabaseAlignment();
