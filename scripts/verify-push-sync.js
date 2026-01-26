/**
 * Push Sync Verification Script for FEFO Phase 3
 *
 * This script verifies that product batch quantity changes sync correctly
 * from IndexedDB to PostgreSQL via the push sync mechanism.
 *
 * Usage:
 * 1. Make a sale first (e.g., 15 units of Paracétamol)
 * 2. Open browser DevTools console on /parametres page
 * 3. Copy and paste this entire script
 * 4. Review "BEFORE" results
 * 5. Click "Synchroniser maintenant" button
 * 6. Run script again to see "AFTER" results
 *
 * Expected Behavior:
 * - BEFORE: Pending count > 0, batch updates in queue
 * - AFTER: Pending count = 0, batches have serverId and synced=true
 */

(async () => {
  console.clear();
  console.log('%c=== Push Sync Verification ===', 'color: #3b82f6; font-size: 16px; font-weight: bold');
  console.log('Timestamp:', new Date().toLocaleString('fr-FR'), '\n');

  try {
    // Dynamically import the db module
    const { db } = await import('/src/lib/client/db.js');

    // === 1. Product Batches ===
    console.log('%c📦 Product Batches', 'color: #10b981; font-weight: bold');
    const allBatches = await db.product_batches.toArray();

    if (allBatches.length === 0) {
      console.warn('  ⚠️  No product batches found in database!');
    } else {
      // Group by product
      const batchesByProduct = new Map();
      for (const batch of allBatches) {
        if (!batchesByProduct.has(batch.product_id)) {
          batchesByProduct.set(batch.product_id, []);
        }
        batchesByProduct.get(batch.product_id).push(batch);
      }

      // Display each product's batches
      for (const [productId, batches] of batchesByProduct) {
        const product = await db.products.get(productId);
        console.log(`\n  Product: ${product?.name || `ID ${productId}`}`);

        // Sort by expiration date (FEFO order)
        batches.sort((a, b) => {
          const dateA = a.expiration_date instanceof Date ? a.expiration_date : new Date(a.expiration_date);
          const dateB = b.expiration_date instanceof Date ? b.expiration_date : new Date(b.expiration_date);
          return dateA.getTime() - dateB.getTime();
        });

        batches.forEach((batch, index) => {
          const expiryDate = batch.expiration_date instanceof Date
            ? batch.expiration_date
            : new Date(batch.expiration_date);
          const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

          console.log(`  ${index + 1}. ${batch.lot_number}`);
          console.log(`     Quantity: %c${batch.quantity}%c / ${batch.initial_qty} units`,
            batch.quantity === 0 ? 'color: #ef4444' : (batch.quantity < batch.initial_qty * 0.3 ? 'color: #f59e0b' : 'color: #10b981'),
            'color: inherit'
          );
          console.log(`     Expires: ${expiryDate.toLocaleDateString('fr-FR')} (${daysUntilExpiry} days)`);
          console.log(`     Synced: %c${batch.synced ? '✓' : '✗'}%c, ServerID: ${batch.serverId || 'null'}`,
            batch.synced ? 'color: #10b981' : 'color: #f59e0b',
            'color: inherit'
          );
        });
      }
    }

    // === 2. Sync Queue Status ===
    console.log('\n%c📋 Sync Queue Status', 'color: #10b981; font-weight: bold');
    const pending = await db.sync_queue
      .where('status')
      .anyOf(['PENDING', 'FAILED'])
      .toArray();

    const syncing = await db.sync_queue
      .where('status')
      .equals('SYNCING')
      .toArray();

    const synced = await db.sync_queue
      .where('status')
      .equals('SYNCED')
      .toArray();

    const failed = await db.sync_queue
      .where('status')
      .equals('FAILED')
      .toArray();

    console.log(`  Pending:  %c${pending.length}%c`,
      pending.length > 0 ? 'color: #f59e0b; font-weight: bold' : 'color: #10b981',
      'color: inherit'
    );
    console.log(`  Syncing:  ${syncing.length}`);
    console.log(`  Synced:   ${synced.length}`);
    console.log(`  Failed:   %c${failed.length}%c`,
      failed.length > 0 ? 'color: #ef4444; font-weight: bold' : 'color: inherit',
      'color: inherit'
    );

    // Show pending batch updates
    const batchUpdates = pending.filter(i => i.type === 'PRODUCT_BATCH');
    if (batchUpdates.length > 0) {
      console.log(`\n  %c🔄 Pending Batch Updates (${batchUpdates.length})`, 'color: #f59e0b; font-weight: bold');
      batchUpdates.forEach((item, index) => {
        console.log(`  ${index + 1}. Lot: ${item.payload.lot_number}`);
        console.log(`     Quantity: ${item.payload.quantity}`);
        console.log(`     Action: ${item.action}`);
        console.log(`     Retry Count: ${item.retryCount || 0}`);
        if (item.lastError) {
          console.error(`     Error: ${item.lastError}`);
        }
      });
    } else if (pending.length > 0) {
      console.log(`\n  Other pending items: ${pending.map(i => i.type).join(', ')}`);
    }

    // Show failed items
    if (failed.length > 0) {
      console.log(`\n  %c❌ Failed Items`, 'color: #ef4444; font-weight: bold');
      failed.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.type} (${item.action})`);
        console.log(`     Error: ${item.lastError}`);
        console.log(`     Retries: ${item.retryCount || 0}`);
      });
    }

    // === 3. Recent Sales (with batch tracking) ===
    console.log('\n%c🛒 Recent Sales (Last 5)', 'color: #10b981; font-weight: bold');
    const recentSales = await db.sales
      .orderBy('created_at')
      .reverse()
      .limit(5)
      .toArray();

    if (recentSales.length === 0) {
      console.warn('  ⚠️  No sales found');
    } else {
      for (const sale of recentSales) {
        const saleDate = sale.created_at instanceof Date ? sale.created_at : new Date(sale.created_at);
        const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();

        console.log(`\n  Sale #${sale.id} - ${saleDate.toLocaleString('fr-FR')}`);
        console.log(`  Total: ${new Intl.NumberFormat('fr-GN').format(sale.total)} GNF`);
        console.log(`  Synced: %c${sale.synced ? '✓' : '✗'}%c`,
          sale.synced ? 'color: #10b981' : 'color: #f59e0b',
          'color: inherit'
        );

        if (items.length > 0) {
          console.log(`  Items (${items.length}):`);
          for (const item of items) {
            const product = await db.products.get(item.product_id);
            console.log(`    - ${product?.name || `Product ${item.product_id}`}: ${item.quantity} × ${new Intl.NumberFormat('fr-GN').format(item.unit_price)} GNF`);

            // Show batch tracking
            if (item.product_batch_id) {
              const batch = await db.product_batches.get(item.product_batch_id);
              if (batch) {
                console.log(`      %cBatch: ${batch.lot_number}%c (FEFO tracked ✓)`,
                  'color: #10b981',
                  'color: inherit'
                );
              } else {
                console.warn(`      ⚠️  Batch ID ${item.product_batch_id} not found`);
              }
            } else {
              console.log(`      %cNo batch tracking%c (legacy sale)`,
                'color: #94a3b8',
                'color: inherit'
              );
            }
          }
        }
      }
    }

    // === 4. Summary & Recommendations ===
    console.log('\n%c📊 Summary', 'color: #3b82f6; font-weight: bold; font-size: 14px');

    const totalBatches = allBatches.length;
    const syncedBatches = allBatches.filter(b => b.synced).length;
    const unsyncedBatches = totalBatches - syncedBatches;

    console.log(`  Total Batches: ${totalBatches}`);
    console.log(`  Synced: %c${syncedBatches}%c`,
      syncedBatches === totalBatches ? 'color: #10b981; font-weight: bold' : 'color: inherit',
      'color: inherit'
    );
    console.log(`  Unsynced: %c${unsyncedBatches}%c`,
      unsyncedBatches > 0 ? 'color: #f59e0b; font-weight: bold' : 'color: inherit',
      'color: inherit'
    );

    console.log('\n%c💡 Next Steps', 'color: #3b82f6; font-weight: bold');

    if (pending.length > 0) {
      console.log(`  1. Click "Synchroniser maintenant" button to push ${pending.length} pending changes`);
      console.log(`  2. Run this script again after sync completes`);
      console.log(`  3. Verify pending count = 0 and all batches show synced = ✓`);
    } else if (unsyncedBatches > 0) {
      console.warn(`  ⚠️  ${unsyncedBatches} batches not synced, but no pending sync items`);
      console.log(`  This might indicate batches created before sync queue was implemented`);
      console.log(`  Consider triggering a manual batch sync or updating these batches`);
    } else {
      console.log(`  %c✅ All systems green! Push sync working correctly.`, 'color: #10b981; font-weight: bold');
      console.log(`  - All batches synced`);
      console.log(`  - No pending sync items`);
      console.log(`  - FEFO Phase 3 push sync: VERIFIED`);
    }

  } catch (error) {
    console.error('%c❌ Error running verification:', 'color: #ef4444; font-weight: bold');
    console.error(error);
    console.log('\nMake sure you are running this script on a page with the app loaded (e.g., /parametres)');
  }

  console.log('\n%c=== End Verification ===', 'color: #3b82f6; font-size: 16px; font-weight: bold');
})();
