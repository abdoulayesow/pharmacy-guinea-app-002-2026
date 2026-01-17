'use client';

import { useEffect, useState } from 'react';
import { db, selectBatchForSale } from '@/lib/client/db';

interface BatchInfo {
  id?: number;
  lot_number: string;
  quantity: number;
  initial_qty: number;
  expiration_date: Date | string;
}

interface ProductInfo {
  id?: number;
  name: string;
  stock: number;
}

interface TestResult {
  totalBatches: number;
  totalProducts: number;
  allProducts: ProductInfo[];
  paracetamolName?: string;
  paracetamolId?: number;
  paracetamolStock?: number;
  batches: BatchInfo[];
  totalBatchQty: number;
  fefoTest?: {
    success: boolean;
    allocations: any[];
    error?: string;
  };
}

export default function TestDatabasePage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runTest() {
      try {
        setLoading(true);

        // 1. Count total batches and products
        const totalBatches = await db.product_batches.count();
        const totalProducts = await db.products.count();

        // 2. Get all products
        const products = await db.products.toArray();
        const allProducts = products.map((p) => ({
          id: p.id,
          name: p.name,
          stock: p.stock,
        }));

        // 3. Find Paracétamol (optional)
        const paracetamol = products.find(
          (p) =>
            p.name.toLowerCase().includes('paracetamol') ||
            p.name.toLowerCase().includes('paracétamol')
        );

        let paracetamolData: Partial<TestResult> = {};
        if (paracetamol) {
          // Get batches for Paracétamol
          const batches = await db.product_batches
            .where('product_id')
            .equals(paracetamol.id!)
            .toArray();

          // Sort by expiration date (FEFO order)
          batches.sort(
            (a, b) =>
              new Date(a.expiration_date).getTime() -
              new Date(b.expiration_date).getTime()
          );

          const totalBatchQty = batches.reduce((sum, b) => sum + b.quantity, 0);

          // Test FEFO allocation
          let fefoTest: TestResult['fefoTest'];
          try {
            const allocations = await selectBatchForSale(paracetamol.id!, 15);
            fefoTest = {
              success: true,
              allocations,
            };
          } catch (err) {
            fefoTest = {
              success: false,
              allocations: [],
              error: err instanceof Error ? err.message : 'Unknown error',
            };
          }

          paracetamolData = {
            paracetamolName: paracetamol.name,
            paracetamolId: paracetamol.id,
            paracetamolStock: paracetamol.stock,
            batches,
            totalBatchQty,
            fefoTest,
          };
        }

        setResult({
          totalBatches,
          totalProducts,
          allProducts,
          batches: paracetamolData.batches || [],
          totalBatchQty: paracetamolData.totalBatchQty || 0,
          ...paracetamolData,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Test failed');
      } finally {
        setLoading(false);
      }
    }

    runTest();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Database Alignment Test</h1>
          <p className="text-gray-600">Running tests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p className="text-gray-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const getDaysToExpiry = (expirationDate: Date | string) => {
    return Math.ceil(
      (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const getExpiryStatus = (days: number) => {
    if (days < 7) return { label: 'CRITICAL', color: 'text-red-600' };
    if (days < 60) return { label: 'WARNING', color: 'text-yellow-600' };
    return { label: 'OK', color: 'text-green-600' };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-6">
          🔍 Database Alignment Verification
        </h1>

        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-600">Total Products:</p>
              <p className="text-2xl font-bold">
                {result.totalProducts}{' '}
                {result.totalProducts > 0 ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-red-600">✗</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Total Batches:</p>
              <p className="text-2xl font-bold">
                {result.totalBatches}{' '}
                {result.totalBatches > 0 ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-red-600">✗</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Paracétamol Batches:</p>
              <p className="text-2xl font-bold">
                {result.batches.length}{' '}
                {result.batches.length > 0 ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-red-600">✗</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* All Products Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">All Products in IndexedDB</h2>
          {result.totalProducts === 0 ? (
            <p className="text-red-600">No products found in IndexedDB</p>
          ) : (
            <div className="space-y-2">
              {result.allProducts.map((product, i) => (
                <div key={i} className="border border-gray-200 rounded p-3">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-gray-600">
                    ID: {product.id} | Stock: {product.stock} units
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Card */}
        {result.totalBatches === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">
              ❌ No Batches Found
            </h2>
            <p className="text-red-700 mb-4">
              IndexedDB has no product batches. This will cause the "disponible
              0" error when trying to make a sale.
            </p>
            <div className="bg-white rounded p-4">
              <p className="font-semibold mb-2">Action Required:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to Settings page (Paramètres)</li>
                <li>Click "Synchroniser maintenant" (Sync now)</li>
                <li>Wait for sync to complete</li>
                <li>Refresh this page to verify</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-800 mb-2">
              ✅ Batches Found!
            </h2>
            <p className="text-green-700">
              IndexedDB has {result.totalBatches} product batches. Database is
              synced.
            </p>
          </div>
        )}

        {/* Paracétamol Details */}
        {result.paracetamolName && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              💊 {result.paracetamolName}
            </h2>
            <div className="space-y-2 mb-4">
              <p>
                <span className="font-semibold">Product ID:</span>{' '}
                {result.paracetamolId}
              </p>
              <p>
                <span className="font-semibold">Product.stock:</span>{' '}
                {result.paracetamolStock} units
              </p>
              <p>
                <span className="font-semibold">Total Batch Quantity:</span>{' '}
                {result.totalBatchQty} units
              </p>
              {result.paracetamolStock !== result.totalBatchQty && (
                <p className="text-yellow-600 text-sm">
                  ⚠️ Product.stock ({result.paracetamolStock}) differs from
                  batch total ({result.totalBatchQty}). This is expected -
                  product.stock is deprecated when batches exist.
                </p>
              )}
            </div>

            {result.batches.length === 0 ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-700 font-semibold">
                  ❌ No batches for this product!
                </p>
                <p className="text-red-600 text-sm">
                  This will cause the "disponible 0" error. Sync needed.
                </p>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-2">
                  Batches (FEFO Order - Earliest Expiration First):
                </h3>
                <div className="space-y-3">
                  {result.batches.map((batch, i) => {
                    const days = getDaysToExpiry(batch.expiration_date);
                    const status = getExpiryStatus(days);
                    return (
                      <div
                        key={i}
                        className="border border-gray-200 rounded p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">
                              {i + 1}. Lot {batch.lot_number}
                            </p>
                            <p className="text-sm text-gray-600">
                              Quantity: {batch.quantity}/{batch.initial_qty}{' '}
                              units
                            </p>
                            <p className="text-sm text-gray-600">
                              Expires:{' '}
                              {new Date(
                                batch.expiration_date
                              ).toLocaleDateString('fr-FR')}{' '}
                              ({days} days)
                            </p>
                          </div>
                          <span
                            className={`text-sm font-semibold ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEFO Test Results */}
        {result.fefoTest && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              🧪 FEFO Allocation Test (15 units)
            </h2>
            {result.fefoTest.success ? (
              <div className="space-y-3">
                <p className="text-green-600 font-semibold">
                  ✅ Allocation Successful!
                </p>
                <div>
                  <p className="font-semibold mb-2">
                    Batches Used: {result.fefoTest.allocations.length}
                  </p>
                  {result.fefoTest.allocations.map((alloc, i) => (
                    <div
                      key={i}
                      className="border border-gray-200 rounded p-3 mb-2"
                    >
                      <p>
                        {i + 1}. Batch ID {alloc.batchId} (Lot{' '}
                        {alloc.lotNumber}): <strong>{alloc.quantity}</strong>{' '}
                        units
                      </p>
                    </div>
                  ))}
                  <p className="text-sm text-gray-600 mt-2">
                    Total Allocated:{' '}
                    {result.fefoTest.allocations.reduce(
                      (sum, a) => sum + a.quantity,
                      0
                    )}{' '}
                    units
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-700 font-semibold">
                  ❌ Allocation Failed
                </p>
                <p className="text-red-600 text-sm">{result.fefoTest.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Next Steps */}
        {result.batches.length > 0 && result.fefoTest?.success && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-800 mb-4">
              🎯 Next Steps: Test the Sale Flow
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-blue-900">
              <li>Navigate to Nouvelle Vente (New Sale) page</li>
              <li>Add 15 units of {result.paracetamolName} to cart</li>
              <li>Proceed to payment</li>
              <li>Complete the sale</li>
              <li>
                Expected: Sale completes successfully (no "disponible 0" error)
              </li>
              <li>
                Expected: First batch (Lot {result.batches[0]?.lot_number})
                decrements from {result.batches[0]?.quantity} to{' '}
                {result.batches[0]?.quantity - 15} units
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
