// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Encrypted Vault Manager
// Architectural Note (Phase 2.3 Hardening):
// VaultManager is a cryptographic utility for explicit password-protected
// vaults. Active pilgrim profiles are stored locally in chrome.storage.local
// without encryption at rest to allow instantaneous form autofill without
// master password blocking during high-speed TTD quota releases.
// For at-rest encrypted storage, users must use Encrypted Backup (.spbk AES-GCM).
// ─────────────────────────────────────────────────

import { deriveKey, encrypt, decrypt, generateSalt } from './crypto';
import { STORAGE_KEYS, VAULT_CONFIG } from '@shared/constants';
import { bufferToBase64, base64ToBuffer } from '@shared/utils';
import logger from '@shared/logger';
import type { VaultData } from '@shared/types';

interface VaultStorage {
  encrypted: string; // Base64
  iv: string; // Base64
  version: number;
}

export class VaultManager {
  private key: CryptoKey | null = null;
  private salt: Uint8Array | null = null;
  private locked = true;
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null;

  /** Check if the vault is currently locked */
  isLocked(): boolean {
    return this.locked;
  }

  /** Check if a vault exists in storage */
  async exists(): Promise<boolean> {
    const result = await chrome.storage.local.get([STORAGE_KEYS.VAULT, STORAGE_KEYS.VAULT_SALT]);
    return !!(result[STORAGE_KEYS.VAULT] && result[STORAGE_KEYS.VAULT_SALT]);
  }

  /**
   * Initialize a new vault with a password.
   * Creates the encryption key and stores the salt.
   */
  async initialize(password: string, data: VaultData): Promise<void> {
    this.salt = generateSalt();
    this.key = await deriveKey(password, this.salt);

    await this.saveData(data);

    // Store salt separately
    await chrome.storage.local.set({
      [STORAGE_KEYS.VAULT_SALT]: bufferToBase64(this.salt.buffer as ArrayBuffer),
    });

    this.locked = false;
    logger.info('Vault initialized');
  }

  /**
   * Unlock the vault with a password.
   * Derives the key and attempts to decrypt the stored data.
   */
  async unlock(password: string): Promise<VaultData> {
    const result = await chrome.storage.local.get([STORAGE_KEYS.VAULT, STORAGE_KEYS.VAULT_SALT]);

    const saltBase64 = result[STORAGE_KEYS.VAULT_SALT] as string | undefined;
    const vaultStorage = result[STORAGE_KEYS.VAULT] as VaultStorage | undefined;

    if (!saltBase64 || !vaultStorage) {
      throw new Error('No vault found. Please initialize first.');
    }

    this.salt = new Uint8Array(base64ToBuffer(saltBase64));
    this.key = await deriveKey(password, this.salt);

    try {
      const ivBuffer = new Uint8Array(base64ToBuffer(vaultStorage.iv));
      const cipherBuffer = base64ToBuffer(vaultStorage.encrypted);
      const decrypted = await decrypt(cipherBuffer, this.key, ivBuffer);
      const data: VaultData = JSON.parse(decrypted);

      this.locked = false;
      logger.info('Vault unlocked');
      return data;
    } catch {
      this.key = null;
      this.salt = null;
      throw new Error('Wrong password or corrupted vault data');
    }
  }

  /** Lock the vault and clear the key from memory */
  lock(): void {
    this.key = null;
    this.locked = true;
    this.clearAutoLock();
    logger.info('Vault locked');
  }

  /** Save data to the encrypted vault */
  async saveData(data: VaultData): Promise<void> {
    if (!this.key) {
      throw new Error('Vault is locked');
    }

    const plaintext = JSON.stringify(data);
    const { ciphertext, iv } = await encrypt(plaintext, this.key);

    const vaultStorage: VaultStorage = {
      encrypted: bufferToBase64(ciphertext),
      iv: bufferToBase64(iv.buffer as ArrayBuffer),
      version: data.version,
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.VAULT]: vaultStorage,
    });

    logger.debug('Vault data saved');
  }

  /** Read data from the vault (must be unlocked) */
  async readData(): Promise<VaultData> {
    if (!this.key) {
      throw new Error('Vault is locked');
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
    const vaultStorage = result[STORAGE_KEYS.VAULT] as VaultStorage | undefined;

    if (!vaultStorage) {
      throw new Error('No vault data found');
    }

    const ivBuffer = new Uint8Array(base64ToBuffer(vaultStorage.iv));
    const cipherBuffer = base64ToBuffer(vaultStorage.encrypted);
    const decrypted = await decrypt(cipherBuffer, this.key, ivBuffer);

    return JSON.parse(decrypted);
  }

  /**
   * Change the vault password.
   * Re-encrypts all data with the new password.
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // First, unlock with old password to get data
    const data = await this.unlock(oldPassword);

    // Re-initialize with new password
    this.salt = generateSalt();
    this.key = await deriveKey(newPassword, this.salt);

    await this.saveData(data);

    await chrome.storage.local.set({
      [STORAGE_KEYS.VAULT_SALT]: bufferToBase64(this.salt.buffer as ArrayBuffer),
    });

    this.locked = false;
    logger.info('Vault password changed');
  }

  /** Set auto-lock timer (in minutes) */
  setAutoLock(minutes: number): void {
    this.clearAutoLock();
    if (minutes > 0) {
      this.autoLockTimer = setTimeout(() => {
        this.lock();
        logger.info(`Vault auto-locked after ${minutes} minutes`);
      }, minutes * 60 * 1000);
    }
  }

  /** Clear the auto-lock timer */
  private clearAutoLock(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  /** Delete the vault entirely */
  async destroy(): Promise<void> {
    this.lock();
    await chrome.storage.local.remove([STORAGE_KEYS.VAULT, STORAGE_KEYS.VAULT_SALT]);
    logger.info('Vault destroyed');
  }
}

// Singleton instance
export const vault = new VaultManager();
