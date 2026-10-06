// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Secure Backup (.spbk)
// ─────────────────────────────────────────────────

import { encryptForStorage, decryptFromStorage } from './crypto';
import { CURRENT_SCHEMA_VERSION, EXTENSION_VERSION } from '@shared/constants';
import { validateImportPayload } from '@storage/repository';
import logger from '@shared/logger';
import type { BackupFile, Profile } from '@shared/types';

/**
 * Create an encrypted backup file.
 */
export async function createBackup(
  profiles: Profile[],
  password: string,
): Promise<BackupFile> {
  const data = JSON.stringify(profiles);
  const { encrypted, salt, iv } = await encryptForStorage(data, password);

  const pilgrimCount = profiles.reduce((sum, p) => sum + (p?.pilgrims?.length || 0), 0);

  const backup: BackupFile = {
    format: 'SPBK',
    version: 1,
    salt,
    iv,
    encrypted,
    metadata: {
      createdAt: new Date().toISOString(),
      profileCount: profiles.length,
      pilgrimCount,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      extensionVersion: EXTENSION_VERSION,
    },
  };

  logger.info(`Backup created: ${profiles.length} profiles, ${pilgrimCount} pilgrims`);
  return backup;
}

/**
 * Restore profiles from an encrypted backup file.
 */
export async function restoreBackup(
  backup: BackupFile,
  password: string,
): Promise<Profile[]> {
  // Validate backup format
  if (backup.format !== 'SPBK') {
    throw new Error('Invalid backup file format. Expected SPBK.');
  }

  if (!backup.encrypted || !backup.salt || !backup.iv) {
    throw new Error('Corrupted backup file: missing encryption data');
  }

  try {
    const decrypted = await decryptFromStorage(
      backup.encrypted,
      backup.salt,
      backup.iv,
      password,
    );

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(decrypted);
    } catch {
      throw new Error('Corrupted backup payload: invalid JSON structure');
    }

    // Canonical runtime validation
    const validation = validateImportPayload(rawParsed);
    if (!validation.valid || !validation.profiles) {
      throw new Error(validation.error || 'Decrypted backup data failed validation');
    }

    logger.info(`Backup restored and validated: ${validation.profiles.length} profiles`);
    return validation.profiles;
  } catch (error) {
    if (error instanceof Error && error.message.includes('decrypt')) {
      throw new Error('Wrong password. Cannot decrypt backup.');
    }
    throw error;
  }
}

/**
 * Export backup as a downloadable file.
 */
export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `sevapilot-backup-${timestamp}.spbk`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
  logger.info(`Backup downloaded: ${filename}`);
}

/**
 * Read a backup file from user input.
 */
export function readBackupFile(file: File): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const backup: BackupFile = JSON.parse(reader.result as string);
        resolve(backup);
      } catch {
        reject(new Error('Invalid backup file. Cannot parse JSON.'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read backup file.'));
    reader.readAsText(file);
  });
}
