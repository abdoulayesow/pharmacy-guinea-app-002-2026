/**
 * Client-side UI utilities
 *
 * These are UI-specific utilities that are only used in the browser.
 * For shared utilities, see @/lib/shared/utils
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 * Used for conditional className composition in React components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Debounce a function (useful for search inputs)
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get network status
 */
export function isOnline(): boolean {
  if (!isBrowser()) return false;
  return navigator.onLine;
}

/**
 * Vibrate device (for haptic feedback on touch)
 */
export function vibrate(duration: number = 10): void {
  if (isBrowser() && 'vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Share via Web Share API (for receipt sharing)
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  if (!isBrowser() || !navigator.share) {
    return false;
  }

  try {
    await navigator.share(data);
    return true;
  } catch (error) {
    // User cancelled share or error occurred
    return false;
  }
}

/**
 * Request persistent storage (for PWA)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!isBrowser() || !navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    console.log('[Storage] Persistent storage:', isPersisted);
    return isPersisted;
  } catch (error) {
    console.error('[Storage] Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate() {
  if (!isBrowser() || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      usagePercentage: estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0,
    };
  } catch (error) {
    console.error('[Storage] Failed to get storage estimate:', error);
    return null;
  }
}
