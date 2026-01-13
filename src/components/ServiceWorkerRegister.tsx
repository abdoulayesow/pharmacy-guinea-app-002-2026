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
        let lastReloadTime = 0;
        const RELOAD_COOLDOWN = 5000; // 5 seconds minimum between reloads

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;

          // Prevent rapid successive reloads
          const now = Date.now();
          if (now - lastReloadTime < RELOAD_COOLDOWN) {
            console.log('⏸ Skipping reload (cooldown active)');
            return;
          }

          refreshing = true;
          lastReloadTime = now;

          // Preserve current URL before reload
          const currentPath = window.location.pathname + window.location.search + window.location.hash;

          // Only preserve non-root paths (avoid redirect loop)
          if (currentPath !== '/' && currentPath !== '/login') {
            sessionStorage.setItem('seri-reload-path', currentPath);
          }

          console.log('🔄 Service Worker updated, reloading...');
          // Reload page when new service worker is activated
          window.location.reload();
        });

        // Restore path after service worker reload
        const savedPath = sessionStorage.getItem('seri-reload-path');
        if (savedPath) {
          sessionStorage.removeItem('seri-reload-path');
          // Only restore if we're on the root page (meaning reload sent us here)
          if (window.location.pathname === '/') {
            console.log('↩ Restoring path:', savedPath);
            window.location.replace(savedPath);
          }
        }

        // Check for updates periodically (reduced frequency)
        setInterval(() => {
          navigator.serviceWorker.ready.then((registration) => {
            registration.update().catch(() => {
              // Silently ignore errors during periodic checks
            });
          });
        }, 300000); // Check every 5 minutes (was 1 minute)
      }
    }
  }, []);

  return null;
}
