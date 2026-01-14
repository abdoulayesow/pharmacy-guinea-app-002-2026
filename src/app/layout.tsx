import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Providers } from '@/components/Providers';
import { AppLockGuard } from '@/components/AppLockGuard';

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('seri-theme');
      var theme = 'dark';
      if (stored) {
        var parsed = JSON.parse(stored);
        theme = parsed.state?.theme || 'dark';
      }
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export const metadata: Metadata = {
  title: 'Seri - Pharmacie Thierno Mamadou',
  description: 'Systeme de gestion pour pharmacie - Offline-first PWA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Seri',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 antialiased">
        <Providers>
          <ThemeProvider>
            <AppLockGuard>
              <ServiceWorkerRegister />
              <OfflineIndicator />
              <PWAInstallPrompt />
              <Toaster
                position="top-center"
                richColors
                toastOptions={{
                  duration: 3000,
                  className: 'font-medium',
                }}
              />
              {children}
            </AppLockGuard>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
