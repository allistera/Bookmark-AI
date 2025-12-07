/**
 * Encryption service for sensitive user data (Instapaper/Todoist credentials)
 * Uses AES-GCM encryption
 */

import { Env } from '../types/env';

/**
 * Encrypt plaintext using AES-GCM
 */
export async function encrypt(plaintext: string, env: Env): Promise<string> {
  const key = await getEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt ciphertext using AES-GCM
 */
export async function decrypt(ciphertext: string, env: Env): Promise<string> {
  const key = await getEncryptionKey(env);

  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Get or import the encryption key
 */
async function getEncryptionKey(env: Env): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.ENCRYPTION_KEY);

  // Ensure the key is exactly 32 bytes for AES-256
  if (keyData.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
