'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register in production (not in development)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        // Register service worker
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('✓ Service Worker registered:', registration);
          })
          .catch((error) => {
            console.error('✗ Service Worker registration failed:', error);
          });

        // Listen for controller change (when service worker updates)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          // Reload page when new service worker is activated
          window.location.reload();
        });

        // Check for updates periodically
        setInterval(() => {
          navigator.serviceWorker.ready.then((registration) => {
            registration.update().catch(() => {
              // Silently ignore errors during periodic checks
            });
          });
        }, 60000); // Check every minute
      }
    }
  }, []);

  return null;
}
