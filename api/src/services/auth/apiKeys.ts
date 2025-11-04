/**
 * API Key generation and hashing
 */


const API_KEY_PREFIX = 'bkm_';
const API_KEY_LENGTH = 40;

/**
 * Generate a new API key
 */
export async function generateAPIKey(): Promise<{
  key: string;
  hash: string;
  prefix: string;
}> {
  // Generate random key: bkm_<40 random hex chars>
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = (API_KEY_PREFIX + randomPart).slice(0, API_KEY_LENGTH);
  const hash = await hashAPIKey(key);
  const prefix = key.slice(0, 12); // "bkm_12345678"

  return { key, hash, prefix };
}

/**
 * Hash an API key using SHA-256
 */
export async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate API key format
 */
export function isValidAPIKeyFormat(key: string): boolean {
  return (
    key.startsWith(API_KEY_PREFIX) &&
    key.length === API_KEY_LENGTH &&
    /^bkm_[a-f0-9]+$/.test(key)
  );
}
