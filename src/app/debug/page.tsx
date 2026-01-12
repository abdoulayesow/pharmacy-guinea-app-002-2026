'use client';

import { useState } from 'react';
import { db, clearDatabase, seedInitialData } from '@/lib/client/db';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  const [message, setMessage] = useState('');

  const handleClearAndReseed = async () => {
    try {
      await clearDatabase();
      await seedInitialData();
      setMessage('✅ Database cleared and reseeded successfully! PIN 1234 should now work.');
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  const handleCheckUsers = async () => {
    try {
      const users = await db.users.toArray();
      console.log('Users in database:', users);
      setMessage(`Found ${users.length} users. Check console for details.`);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          Debug Panel
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
              Database Actions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Use these tools to fix the PIN hash issue
            </p>
          </div>

          <Button
            onClick={handleClearAndReseed}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Clear Database & Reseed (Fix PIN 1234)
          </Button>

          <Button
            onClick={handleCheckUsers}
            variant="outline"
            className="w-full"
          >
            Check Users in Database
          </Button>

          {message && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-900 dark:text-blue-100">
              {message}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Instructions:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
              <li>Click "Clear Database & Reseed"</li>
              <li>Go back to login page</li>
              <li>Select Mamadou or Fatoumata</li>
              <li>Enter PIN: 1234</li>
              <li>Login should work!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
