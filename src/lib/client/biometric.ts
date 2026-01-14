/**
 * WebAuthn Biometric Authentication
 * 
 * Handles fingerprint/face ID authentication using WebAuthn API
 * Falls back to PIN if biometrics are not available
 */

import { db } from './db';

/**
 * Check if WebAuthn is available on this device
 */
export function isWebAuthnAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    'PublicKeyCredential' in window &&
    typeof navigator.credentials !== 'undefined' &&
    typeof PublicKeyCredential !== 'undefined'
  );
}

/**
 * Check if user has already registered a biometric credential
 */
export async function hasBiometricCredential(userId: string): Promise<boolean> {
  try {
    const user = await db.users.get(userId);
    return !!(user && (user as any).biometricCredentialId);
  } catch (error) {
    console.error('[Biometric] Error checking credential:', error);
    return false;
  }
}

/**
 * Register a new biometric credential for the user
 * 
 * @param userId - User ID to associate credential with
 * @param userName - User's name for credential display
 * @returns Promise<string | null> - Credential ID if successful, null if failed
 */
export async function registerBiometric(
  userId: string,
  userName: string
): Promise<string | null> {
  if (!isWebAuthnAvailable()) {
    console.warn('[Biometric] WebAuthn not available');
    return null;
  }

  try {
    // Generate a random challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Create credential
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Seri Pharmacy',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Built-in authenticator (fingerprint/face)
          userVerification: 'required',
        },
        timeout: 60000, // 60 seconds
        attestation: 'direct',
      },
    }) as PublicKeyCredential | null;

    if (!credential) {
      console.warn('[Biometric] User cancelled or credential creation failed');
      return null;
    }

    // Store credential ID in IndexedDB
    const credentialId = credential.id;
    const user = await db.users.get(userId);
    
    if (user) {
      await db.users.update(userId, {
        biometricCredentialId: credentialId,
      } as any);
    } else {
      // User doesn't exist locally - create minimal record
      await db.users.put({
        id: userId,
        name: userName,
        role: 'EMPLOYEE',
        biometricCredentialId: credentialId,
        createdAt: new Date(),
      } as any);
    }

    console.log('[Biometric] Credential registered successfully');
    return credentialId;
  } catch (error) {
    console.error('[Biometric] Registration error:', error);
    return null;
  }
}

/**
 * Authenticate using biometric credential
 * 
 * @param userId - User ID to authenticate
 * @returns Promise<boolean> - true if authentication successful
 */
export async function authenticateBiometric(userId: string): Promise<boolean> {
  if (!isWebAuthnAvailable()) {
    return false;
  }

  try {
    // Get stored credential ID
    const user = await db.users.get(userId);
    if (!user || !(user as any).biometricCredentialId) {
      console.warn('[Biometric] No credential found for user');
      return false;
    }

    const credentialId = (user as any).biometricCredentialId;

    // Generate challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Convert credential ID to ArrayBuffer
    // WebAuthn credential.id is base64url-encoded string
    // Need to decode it to ArrayBuffer for allowCredentials
    let credentialIdBuffer: ArrayBuffer;
    try {
      // Decode base64url (WebAuthn standard format)
      // Replace URL-safe characters and decode
      const base64 = credentialId.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      credentialIdBuffer = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)).buffer;
    } catch (error) {
      console.error('[Biometric] Error decoding credential ID:', error);
      return false;
    }

    // Authenticate
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credentialIdBuffer,
            type: 'public-key',
            transports: ['internal'], // Built-in authenticator
          },
        ],
        userVerification: 'required',
        timeout: 60000, // 60 seconds
      },
    });

    if (assertion) {
      console.log('[Biometric] Authentication successful');
      return true;
    }

    return false;
  } catch (error: any) {
    // User cancelled or authentication failed
    if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
      console.log('[Biometric] User cancelled or not supported');
    } else {
      console.error('[Biometric] Authentication error:', error);
    }
    return false;
  }
}

/**
 * Remove biometric credential for user
 */
export async function removeBiometricCredential(userId: string): Promise<void> {
  try {
    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, {
        biometricCredentialId: undefined,
      } as any);
    }
  } catch (error) {
    console.error('[Biometric] Error removing credential:', error);
  }
}

