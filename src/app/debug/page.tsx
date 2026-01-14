'use client';

import { useState } from 'react';
import { db, clearDatabase, seedInitialData, getDatabaseStats } from '@/lib/client/db';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  const [message, setMessage] = useState('');

  const handleClearAndReseed = async () => {
    try {
      await clearDatabase();
      await seedInitialData();
      setMessage('✅ Database cleared! Demo products and suppliers reseeded. Users must log in via Google.');
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  const handleCheckUsers = async () => {
    try {
      const users = await db.users.toArray();
      console.log('Users in database:', users);
      setMessage(`Found ${users.length} user(s) in IndexedDB. Check console for details.`);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  const handleCheckStats = async () => {
    try {
      const stats = await getDatabaseStats();
      console.log('Database stats:', stats);
      setMessage(`Products: ${stats.products}, Users: ${stats.users}, Suppliers: ${stats.suppliers}, Pending sync: ${stats.pendingSync}`);
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
              Tools for debugging the IndexedDB local database
            </p>
          </div>

          <Button
            onClick={handleClearAndReseed}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Clear Database & Reseed Demo Data
          </Button>

          <Button
            onClick={handleCheckUsers}
            variant="outline"
            className="w-full"
          >
            Check Users in IndexedDB
          </Button>

          <Button
            onClick={handleCheckStats}
            variant="outline"
            className="w-full"
          >
            Show Database Stats
          </Button>

          {message && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-900 dark:text-blue-100">
              {message}
            </div>
          )}

          <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
              Auth Flow:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-emerald-800 dark:text-emerald-200">
              <li>Log in with Google (first time creates user in Postgres)</li>
              <li>Default PIN "1234" is auto-set, user is prompted to change it</li>
              <li>After 5 min inactivity, PIN is required to re-enter</li>
              <li>After 7 days, full Google re-login is required</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
