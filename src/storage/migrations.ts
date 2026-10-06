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

/**
 * Detect the current schema version in storage.
 */
export async function detectSchemaVersion(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCHEMA_VERSION);
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
  const allData = await chrome.storage.local.get(null);
  const backupKey = `sp_migration_backup_v${currentVersion}_${Date.now()}`;
  await chrome.storage.local.set({ [backupKey]: allData });
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
  await chrome.storage.local.set({
    ...data,
    [STORAGE_KEYS.SCHEMA_VERSION]: CURRENT_SCHEMA_VERSION,
  });

  // Phase 2.3: Remove temporary migration backup on success to prevent permanent plaintext PII copies
  await chrome.storage.local.remove(backupKey);
  logger.info(`Temporary migration backup cleaned up: ${backupKey}`);

  logger.info(`Schema migration complete. Now at v${CURRENT_SCHEMA_VERSION}`);
}
