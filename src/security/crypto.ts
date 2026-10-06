// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Web Crypto API Encryption
// PBKDF2 key derivation + AES-GCM-256 encryption
// ─────────────────────────────────────────────────

import { VAULT_CONFIG } from '@shared/constants';
import { bufferToBase64, base64ToBuffer } from '@shared/utils';

/**
 * Generate a random salt for PBKDF2 key derivation.
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.SALT_LENGTH));
}

/**
 * Generate a random IV for AES-GCM encryption.
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(VAULT_CONFIG.IV_LENGTH));
}

/**
 * Derive an encryption key from a password using PBKDF2.
 * Uses SHA-256 with 600,000 iterations for strong key derivation.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Import password as raw key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: VAULT_CONFIG.PBKDF2_ITERATIONS,
      hash: VAULT_CONFIG.HASH,
    },
    baseKey,
    {
      name: VAULT_CONFIG.ALGORITHM,
      length: VAULT_CONFIG.KEY_LENGTH,
    },
    false, // Not extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt data using AES-GCM-256.
 * Returns ciphertext and the IV used (which must be stored alongside).
 */
export async function encrypt(
  data: string,
  key: CryptoKey,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const iv = generateIV();

  const ciphertext = await crypto.subtle.encrypt(
    { name: VAULT_CONFIG.ALGORITHM, iv: iv as BufferSource },
    key,
    encoder.encode(data),
  );

  return { ciphertext, iv };
}

/**
 * Decrypt data using AES-GCM-256.
 * The IV must be the same one used during encryption.
 */
export async function decrypt(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: VAULT_CONFIG.ALGORITHM, iv: iv as BufferSource },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt and serialize for storage.
 * Returns base64-encoded ciphertext, salt, and IV.
 */
export async function encryptForStorage(
  data: string,
  password: string,
): Promise<{ encrypted: string; salt: string; iv: string }> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const { ciphertext, iv } = await encrypt(data, key);

  return {
    encrypted: bufferToBase64(ciphertext),
    salt: bufferToBase64(salt.buffer as ArrayBuffer),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt data from storage.
 * Accepts base64-encoded ciphertext, salt, and IV.
 */
export async function decryptFromStorage(
  encrypted: string,
  salt: string,
  iv: string,
  password: string,
): Promise<string> {
  const saltBuffer = new Uint8Array(base64ToBuffer(salt));
  const ivBuffer = new Uint8Array(base64ToBuffer(iv));
  const cipherBuffer = base64ToBuffer(encrypted);

  const key = await deriveKey(password, saltBuffer);
  return decrypt(cipherBuffer, key, ivBuffer);
}
