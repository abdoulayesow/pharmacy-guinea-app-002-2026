/**
 * Client-side authentication utilities
 * Uses bcryptjs for PIN hashing (works in browser)
 *
 * IMPORTANT: bcryptjs is dynamically imported to reduce initial bundle size
 * and speed up compilation. It's only loaded when actually needed.
 */

/**
 * Hash a PIN for secure storage in IndexedDB
 * @param pin - 4-digit PIN string
 * @returns Promise<string> - bcrypt hash
 */
export async function hashPin(pin: string): Promise<string> {
  // Dynamic import - only loads bcryptjs when actually hashing
  const bcrypt = await import('bcryptjs');
  // Use 10 rounds (balance between security and performance on low-end devices)
  return await bcrypt.hash(pin, 10);
}

/**
 * Verify a PIN against a stored hash
 * @param pin - 4-digit PIN entered by user
 * @param storedHash - bcrypt hash from IndexedDB
 * @returns Promise<boolean> - true if PIN matches
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    // Dynamic import - only loads bcryptjs when actually verifying
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(pin, storedHash);
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
}

/**
 * Generate a simple device fingerprint for additional security
 * Combines browser info to create a pseudo-unique identifier
 * Note: This is not cryptographically secure, just an extra layer
 */
export function getDeviceFingerprint(): string {
  const nav = navigator;
  const screen = window.screen;

  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');

  // Simple hash (not cryptographic, just for identification)
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(36);
}

/**
 * Validate PIN format (4 digits)
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
