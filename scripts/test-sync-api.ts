/**
 * Test script to verify sync API responses
 * Run: npx tsx scripts/test-sync-api.ts
 */

async function testSyncAPI() {
  const BASE_URL = 'http://localhost:8888';

  console.log('🧪 Testing Sync API Endpoints\n');
  console.log('============================================================\n');

  try {
    // Test Initial Sync endpoint
    console.log('📥 Testing GET /api/sync/initial?role=OWNER');
    const initialResponse = await fetch(`${BASE_URL}/api/sync/initial?role=OWNER`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!initialResponse.ok) {
      console.error(`❌ Initial sync failed: ${initialResponse.status} ${initialResponse.statusText}`);
      return;
    }

    const initialData = await initialResponse.json();
    console.log('\n✅ Initial Sync Response:');
    console.log('  Success:', initialData.success);
    console.log('  Products:', initialData.data?.products?.length || 0);
    console.log('  Sales:', initialData.data?.sales?.length || 0);
    console.log('  Expenses:', initialData.data?.expenses?.length || 0);
    console.log('  Stock Movements:', initialData.data?.stockMovements?.length || 0);
    console.log('  Suppliers:', initialData.data?.suppliers?.length || 0);
    console.log('  Product Batches:', initialData.data?.productBatches?.length || 0);

    // Show first batch structure if exists
    if (initialData.data?.productBatches?.length > 0) {
      console.log('\n📦 First Product Batch Structure:');
      const firstBatch = initialData.data.productBatches[0];
      console.log(JSON.stringify(firstBatch, null, 2));
    } else {
      console.log('\n❌ No product batches in response!');
    }

    console.log('\n============================================================');

  } catch (error) {
    console.error('❌ Error testing sync API:', error);
  }
}

testSyncAPI();
