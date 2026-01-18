/**
 * Stock Calculation Test Helper
 *
 * Run this in browser console to verify stock calculation logic.
 * Uses IndexedDB API directly (no dependencies needed)
 *
 * Usage:
 * 1. Open browser console (F12) on ANY page
 * 2. Copy-paste this entire file
 * 3. Press Enter to run
 */

(async function testStockCalculation() {
  console.log('🧪 Starting Stock Calculation Test...\n');

  // Helper to open IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      // Open without specifying version - uses current version
      const request = indexedDB.open('seri-db');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onblocked = () => reject(new Error('Database blocked'));
    });
  }

  // Helper to get all records from a store
  function getAllRecords(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Helper to get records by index
  function getRecordsByIndex(db, storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  try {
    // Open database
    const db = await openDB();
    console.log('✅ Database opened successfully\n');

    // Get all products
    const products = await getAllRecords(db, 'products');
    console.log(`📦 Found ${products.length} products\n`);

    if (products.length === 0) {
      console.warn('⚠️ No products found. Please login and wait for initial sync.');
      db.close();
      return;
    }

    // Test each product (first 5)
    for (const product of products.slice(0, 5)) {
      if (!product.id) continue;

      console.log(`\n📊 Product: ${product.name} (ID: ${product.id})`);
      console.log(`   Base stock: ${product.stock}`);

      // Get all movements for this product
      const allMovements = await getRecordsByIndex(db, 'stock_movements', 'product_id', product.id);

      // Get unsynced movements
      const unsyncedMovements = allMovements.filter(m => !m.synced);

      // Calculate totals
      const totalChange = allMovements.reduce((sum, m) => sum + m.quantity_change, 0);
      const unsyncedChange = unsyncedMovements.reduce((sum, m) => sum + m.quantity_change, 0);

      console.log(`   Total movements: ${allMovements.length}`);
      console.log(`   Synced movements: ${allMovements.length - unsyncedMovements.length}`);
      console.log(`   Unsynced movements: ${unsyncedMovements.length}`);
      console.log(`   Total change (all): ${totalChange}`);
      console.log(`   Unsynced change: ${unsyncedChange}`);
      console.log(`   ✅ Calculated stock: ${product.stock + unsyncedChange}`);

      // Verify logic
      if (unsyncedMovements.length === 0) {
        console.log(`   ✓ No unsynced movements - stock is accurate`);
      } else {
        console.log(`   ⚠️ Has unsynced movements - stock will update after sync`);
      }

      // Show movement details
      if (allMovements.length > 0) {
        console.log(`   Last 3 movements:`);
        allMovements.slice(-3).forEach(m => {
          console.log(`     - ${m.type}: ${m.quantity_change > 0 ? '+' : ''}${m.quantity_change} (synced: ${m.synced}, reason: ${m.reason || 'N/A'})`);
        });
      }
    }

    // Summary
    console.log('\n\n📋 Summary:');
    const allMovements = await getAllRecords(db, 'stock_movements');
    const syncedCount = allMovements.filter(m => m.synced).length;
    const unsyncedCount = allMovements.filter(m => !m.synced).length;

    console.log(`   Total stock movements: ${allMovements.length}`);
    console.log(`   Synced: ${syncedCount}`);
    console.log(`   Unsynced: ${unsyncedCount}`);

    // Check sync queue
    const syncQueue = await getAllRecords(db, 'sync_queue');
    const pendingMovements = syncQueue.filter(q => q.type === 'STOCK_MOVEMENT' && q.status === 'PENDING');

    console.log(`\n   Sync queue:`);
    console.log(`   Total items: ${syncQueue.length}`);
    console.log(`   Pending stock movements: ${pendingMovements.length}`);

    if (unsyncedCount !== pendingMovements.length) {
      console.log(`   ⚠️ WARNING: Unsynced count (${unsyncedCount}) != Queue count (${pendingMovements.length})`);
      console.log(`   This might indicate a sync issue.`);
    } else {
      console.log(`   ✅ Sync queue matches unsynced movements`);
    }

    // Test concurrent scenario check
    console.log('\n\n🔍 Concurrent Update Test Check:');
    const productsWithMultipleMovements = [];

    for (const product of products) {
      if (!product.id) continue;
      const movements = await getRecordsByIndex(db, 'stock_movements', 'product_id', product.id);
      if (movements.length >= 2) {
        productsWithMultipleMovements.push({
          name: product.name,
          movements: movements.length,
          stock: product.stock,
        });
      }
    }

    if (productsWithMultipleMovements.length > 0) {
      console.log(`   Products with multiple movements (good for testing):`);
      productsWithMultipleMovements.forEach(p => {
        console.log(`   - ${p.name}: ${p.movements} movements, stock = ${p.stock}`);
      });
    } else {
      console.log(`   No products with multiple movements yet.`);
      console.log(`   Create some sales to test concurrent updates!`);
    }

    console.log('\n✅ Test complete!\n');
    console.log('💡 Next steps:');
    console.log('   1. Create a sale to generate stock movements');
    console.log('   2. Check sync status in Settings page');
    console.log('   3. Run this test again to see changes');

    // Close database
    db.close();

  } catch (error) {
    console.error('❌ ERROR:', error.message);

    if (error.message.includes('ObjectStore')) {
      console.error('\n   Database schema mismatch. Try:');
      console.error('   1. Clear IndexedDB in DevTools');
      console.error('   2. Refresh the page');
      console.error('   3. Run this test again');
    } else if (error.name === 'NotFoundError') {
      console.error('\n   Database not found. Please:');
      console.error('   1. Login to the app first');
      console.error('   2. Wait for initial sync to complete');
      console.error('   3. Run this test again');
    }
  }
})();
