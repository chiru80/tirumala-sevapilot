// ─────────────────────────────────────────────────
// Tirumala SevaPilot — Data Migration Framework
// ─────────────────────────────────────────────────

import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from '@shared/constants';
import logger from '@shared/logger';

interface MigrationFn {
  (data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Migration registry: version → migration function */
const migrations: Record<number, MigrationFn> = {
  // Example: migration from V1 → V2
  // 2: async (data) => {
  //   // Transform V1 data to V2 format
  //   return transformedData;
  // },
};

/** Safe storage helpers with retry and lastError suppression for SW lifecycle transitions */
async function safeStorageGet(keys: string | string[] | null): Promise<Record<string, unknown>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return {};
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await chrome.storage.local.get(keys);
      if (chrome.runtime?.lastError) {
        void chrome.runtime.lastError;
      }
      return res || {};
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((msg.includes('No SW') || msg.includes('context invalidated')) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      throw err;
    }
  }
  return {};
}

async function safeStorageSet(items: Record<string, unknown>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await chrome.storage.local.set(items);
      if (chrome.runtime?.lastError) {
        void chrome.runtime.lastError;
      }
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((msg.includes('No SW') || msg.includes('context invalidated')) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Detect the current schema version in storage.
 */
export async function detectSchemaVersion(): Promise<number> {
  const result = await safeStorageGet(STORAGE_KEYS.SCHEMA_VERSION);
  return (result[STORAGE_KEYS.SCHEMA_VERSION] as number | undefined) ?? 1;
}

/**
 * Run all necessary migrations from the current version to the latest.
 */
export async function runMigrations(): Promise<void> {
  const currentVersion = await detectSchemaVersion();

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    logger.debug(`Schema is up to date (v${currentVersion})`);
    return;
  }

  logger.info(`Migrating schema from v${currentVersion} to v${CURRENT_SCHEMA_VERSION}`);

  // Create backup before migration
  const allData = await safeStorageGet(null);
  const backupKey = `sp_migration_backup_v${currentVersion}_${Date.now()}`;
  await safeStorageSet({ [backupKey]: allData });
  logger.info(`Migration backup created: ${backupKey}`);

  let data = { ...allData };

  for (let v = currentVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const migrationFn = migrations[v];
    if (migrationFn) {
      logger.info(`Running migration to v${v}...`);
      try {
        data = await migrationFn(data);
        logger.info(`Migration to v${v} complete`);
      } catch (error) {
        logger.error(`Migration to v${v} failed`, error);
        throw new Error(`Migration to v${v} failed. Your data has been backed up as ${backupKey}.`);
      }
    }
  }

  // Save migrated data and update version
  await safeStorageSet({
    ...data,
    [STORAGE_KEYS.SCHEMA_VERSION]: CURRENT_SCHEMA_VERSION,
  });

  // Phase 2.3: Remove temporary migration backup on success to prevent permanent plaintext PII copies
  if (typeof chrome !== 'undefined' && chrome.storage?.local?.remove) {
    try {
      await chrome.storage.local.remove(backupKey);
      if (chrome.runtime?.lastError) void chrome.runtime.lastError;
      logger.info(`Temporary migration backup cleaned up: ${backupKey}`);
    } catch {
      // Non-critical
    }
  }

  logger.info(`Schema migration complete. Now at v${CURRENT_SCHEMA_VERSION}`);
}
