import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations, detectSchemaVersion } from '../../src/storage/migrations';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from '../../src/shared/constants';

const storageMap = new Map<string, any>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: any) => {
        if (!key) return Object.fromEntries(storageMap.entries());
        if (typeof key === 'string') return { [key]: storageMap.get(key) };
        if (Array.isArray(key)) {
          const res: Record<string, any> = {};
          for (const k of key) res[k] = storageMap.get(k);
          return res;
        }
        return Object.fromEntries(storageMap.entries());
      },
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageMap.set(k, v);
      },
      remove: async (key: string) => {
        storageMap.delete(key);
      },
      clear: async () => {
        storageMap.clear();
      },
    },
  },
};

describe('Migration Backup Safety (P1)', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('does nothing when schema is already current version', async () => {
    storageMap.set(STORAGE_KEYS.SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
    await runMigrations();
    expect(storageMap.get(STORAGE_KEYS.SCHEMA_VERSION)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('cleans up temporary migration backup after successful migration', async () => {
    // Set an older schema version
    storageMap.set(STORAGE_KEYS.SCHEMA_VERSION, 0);
    storageMap.set(STORAGE_KEYS.PROFILES, [{ name: 'Pre-migration profile', pilgrims: [] }]);

    await runMigrations();

    // Verify schema updated
    expect(storageMap.get(STORAGE_KEYS.SCHEMA_VERSION)).toBe(CURRENT_SCHEMA_VERSION);

    // Verify temporary migration backup was deleted to avoid permanent plaintext PII copies
    const allKeys = Array.from(storageMap.keys());
    const migrationBackupKeys = allKeys.filter(k => k.startsWith('sp_migration_backup_'));
    expect(migrationBackupKeys.length).toBe(0);
  });
});
