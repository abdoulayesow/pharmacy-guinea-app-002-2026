'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Logo } from '@/components/Logo';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Redirect based on auth status
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  // Show a brief loading screen while redirecting
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
      <Logo size="lg" />
      <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
        Seri
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Chargement...
      </p>
    </div>
  );
}
