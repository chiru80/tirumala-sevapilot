// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { purgeDevoteeData, clearAllData, getProfiles, getSettings, saveSettings } from '../../src/storage/repository';
import { StorageManager } from '../../src/storage/storage-manager';
import { STORAGE_KEYS } from '../../src/shared/constants';
import { createBackup, restoreBackup } from '../../src/security/backup';
import type { Profile, BackupFile } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

describe('Phase 16 — Production Readiness, Data Security & Trust', () => {
  const storageLocalMap = new Map<string, any>();
  const storageSyncMap = new Map<string, any>();
  const storageSessionMap = new Map<string, any>();

  beforeEach(() => {
    storageLocalMap.clear();
    storageSyncMap.clear();
    storageSessionMap.clear();

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: any) => {
            if (typeof key === 'string') return { [key]: storageLocalMap.get(key) };
            if (Array.isArray(key)) {
              const res: Record<string, any> = {};
              for (const k of key) res[k] = storageLocalMap.get(k);
              return res;
            }
            return Object.fromEntries(storageLocalMap.entries());
          }),
          set: vi.fn(async (items: Record<string, any>) => {
            for (const [k, v] of Object.entries(items)) storageLocalMap.set(k, v);
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            for (const k of arr) storageLocalMap.delete(k);
          }),
          clear: vi.fn(async () => storageLocalMap.clear()),
        },
        sync: {
          get: vi.fn(async (key: any) => {
            if (typeof key === 'string') return { [key]: storageSyncMap.get(key) };
            return Object.fromEntries(storageSyncMap.entries());
          }),
          set: vi.fn(async (items: Record<string, any>) => {
            for (const [k, v] of Object.entries(items)) storageSyncMap.set(k, v);
          }),
          remove: vi.fn(async (key: string) => storageSyncMap.delete(key)),
          clear: vi.fn(async () => storageSyncMap.clear()),
        },
        session: {
          get: vi.fn(async (key: any) => {
            if (typeof key === 'string') return { [key]: storageSessionMap.get(key) };
            return Object.fromEntries(storageSessionMap.entries());
          }),
          set: vi.fn(async (items: Record<string, any>) => {
            for (const [k, v] of Object.entries(items)) storageSessionMap.set(k, v);
          }),
          remove: vi.fn(async (key: string) => storageSessionMap.delete(key)),
          clear: vi.fn(async () => storageSessionMap.clear()),
        },
      },
    };
  });

  describe('1. Devotee Data Erasure (purgeDevoteeData)', () => {
    it('wipes devotee profiles, vault, notifications, session history while preserving UI settings and cache', async () => {
      // Setup sensitive devotee state
      const mockProfiles: Profile[] = [
        {
          id: 'prof-1',
          name: 'Family Profile',
          isDefault: true,
          createdAt: new Date().toISOString(),
          pilgrims: [
            {
              id: 'pilgrim-1',
              firstName: 'Venkata',
              lastName: 'Raman',
              fullName: 'Venkata Raman',
              gender: Gender.MALE,
              age: 45,
              idType: IdType.AADHAAR,
              idNumber: '234567890123',
              country: 'India',
              createdAt: new Date().toISOString(),
            },
          ],
          general: {
            mobile: '9876543210',
            email: 'devotee@example.com',
            city: 'Tirupati',
            state: 'Andhra Pradesh',
            country: 'India',
            pinCode: '517501',
          },
        },
      ];

      storageLocalMap.set(STORAGE_KEYS.PROFILES, mockProfiles);
      storageLocalMap.set(STORAGE_KEYS.VAULT, { 'pilgrim-1': 'ENCRYPTED_VAULT_DATA' });
      storageLocalMap.set(STORAGE_KEYS.VAULT_SALT, 'SALT_12345');
      storageLocalMap.set(STORAGE_KEYS.NOTIFICATIONS, [{ id: 'notif-1', title: 'SED Open' }]);
      storageLocalMap.set(STORAGE_KEYS.SESSION_HISTORY, [{ id: 'hist-1', service: 'SED ₹300' }]);
      storageLocalMap.set('sp_session_draft_tokens', { token: 'DRAFT_XYZ' });

      // Settings and release schedule cache
      storageLocalMap.set(STORAGE_KEYS.SETTINGS, { language: 'te', theme: 'dark' });
      storageLocalMap.set('sp_release_schedule_cache', { lastFetched: Date.now(), schedules: [] });

      // Run purgeDevoteeData
      await purgeDevoteeData();

      // Devotee profiles and sensitive data must be gone
      expect(storageLocalMap.has(STORAGE_KEYS.PROFILES)).toBe(false);
      expect(storageLocalMap.has(STORAGE_KEYS.VAULT)).toBe(false);
      expect(storageLocalMap.has(STORAGE_KEYS.VAULT_SALT)).toBe(false);
      expect(storageLocalMap.has(STORAGE_KEYS.NOTIFICATIONS)).toBe(false);
      expect(storageLocalMap.has(STORAGE_KEYS.SESSION_HISTORY)).toBe(false);
      expect(storageLocalMap.has('sp_session_draft_tokens')).toBe(false);

      // UI settings and release schedule cache must be preserved
      expect(storageLocalMap.has(STORAGE_KEYS.SETTINGS)).toBe(true);
      expect(storageLocalMap.get(STORAGE_KEYS.SETTINGS)).toEqual({ language: 'te', theme: 'dark' });
      expect(storageLocalMap.has('sp_release_schedule_cache')).toBe(true);
    });

    it('StorageManager.purgeDevoteeData static method delegates properly', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, [{ id: 'p1' }]);
      await StorageManager.purgeDevoteeData();
      expect(storageLocalMap.has(STORAGE_KEYS.PROFILES)).toBe(false);
    });

    it('is idempotent on repeated invocations', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, [{ id: 'p1' }]);
      await purgeDevoteeData();
      await purgeDevoteeData();
      await purgeDevoteeData();
      expect(storageLocalMap.has(STORAGE_KEYS.PROFILES)).toBe(false);
    });

    it('handles partial storage failures gracefully without leaving core keys undeleted', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, [{ id: 'p1' }]);
      storageLocalMap.set(STORAGE_KEYS.VAULT, { 'p1': 'secret' });
      // Simulate chrome.storage.local.get throwing
      (globalThis as any).chrome.storage.local.get = vi.fn().mockRejectedValue(new Error('Storage access denied'));

      await purgeDevoteeData();

      // Core keys must still be removed via fallback remove
      expect(storageLocalMap.has(STORAGE_KEYS.PROFILES)).toBe(false);
      expect(storageLocalMap.has(STORAGE_KEYS.VAULT)).toBe(false);
    });

    it('handles session storage errors silently without aborting erasure', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, [{ id: 'p1' }]);
      (globalThis as any).chrome.storage.session.clear = vi.fn().mockRejectedValue(new Error('Session error'));

      await expect(purgeDevoteeData()).resolves.toBeUndefined();
      expect(storageLocalMap.has(STORAGE_KEYS.PROFILES)).toBe(false);
    });
  });

  describe('2. Factory Reset / Nuclear Wipe (clearAllData)', () => {
    it('wipes all data across local, sync, and session storage tiers', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, [{ id: 'p1' }]);
      storageLocalMap.set(STORAGE_KEYS.SETTINGS, { language: 'en' });
      storageSyncMap.set(STORAGE_KEYS.SETTINGS, { language: 'en' });
      storageSessionMap.set('temp_policy', { srivani: 'restricted' });

      await clearAllData();

      expect(storageLocalMap.size).toBe(0);
      expect(storageSyncMap.size).toBe(0);
      expect(storageSessionMap.size).toBe(0);
    });

    it('is idempotent on repeated invocations', async () => {
      storageLocalMap.set('k1', 'v1');
      await clearAllData();
      await clearAllData();
      await clearAllData();
      expect(storageLocalMap.size).toBe(0);
    });

    it('tolerates sync storage failure while wiping local and session storage', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, [{ id: 'p1' }]);
      storageSessionMap.set('session_token', 'abc');
      (globalThis as any).chrome.storage.sync.clear = vi.fn().mockRejectedValue(new Error('Sync failure'));

      await expect(clearAllData()).resolves.toBeUndefined();
      expect(storageLocalMap.size).toBe(0);
      expect(storageSessionMap.size).toBe(0);
    });

    it('StorageManager.clearAllData static method delegates to clearAllData', async () => {
      storageLocalMap.set('key1', 'val1');
      await StorageManager.clearAllData();
      expect(storageLocalMap.size).toBe(0);
    });
  });

  describe('3. Production Package Security Linter Rules', () => {
    // Phase 17: assert against the REAL manifest instead of a local copy, so a
    // permission that creeps back into manifest.json fails the suite.
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'manifest.json'), 'utf8')) as {
      manifest_version: number;
      permissions: string[];
      host_permissions: string[];
      content_scripts: Array<{ matches: string[] }>;
      web_accessible_resources: Array<{ resources: string[]; matches: string[] }>;
      content_security_policy?: { extension_pages?: string };
    };

    const auditedPermissions = ['contextMenus', 'scripting', 'sidePanel', 'storage'];

    const forbiddenPermissions = [
      'clipboardRead',
      'clipboardWrite',
      'tabs',
      'activeTab',
      'history',
      'bookmarks',
      'cookies',
      'webNavigation',
      'debugger',
      'proxy',
      'webRequest',
      'webRequestBlocking',
      '<all_urls>',
    ];

    const officialOrigins = [
      'https://ttdevasthanams.ap.gov.in/*',
      'https://tirupatibalaji.ap.gov.in/*',
    ];

    it('declares exactly the audited minimal permission set', () => {
      expect([...manifest.permissions].sort()).toEqual(auditedPermissions);
      expect(manifest.manifest_version).toBe(3);
      for (const p of forbiddenPermissions) {
        expect(manifest.permissions).not.toContain(p);
      }
      expect(manifest.permissions).not.toContain('<all_urls>');
    });

    it('pins host permissions and content scripts to official TTD origins only', () => {
      expect([...manifest.host_permissions].sort()).toEqual([...officialOrigins].sort());
      for (const cs of manifest.content_scripts) {
        for (const match of cs.matches) {
          expect(officialOrigins).toContain(match);
        }
      }
      for (const war of manifest.web_accessible_resources) {
        for (const match of war.matches) {
          expect(officialOrigins).toContain(match);
        }
      }
    });

    it('keeps a strict extension Content Security Policy', () => {
      const csp = manifest.content_security_policy?.extension_pages || '';
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'self'");
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).not.toContain('unsafe-inline');
    });

    it('verifies official TTD host origin pinning', () => {
      for (const origin of officialOrigins) {
        expect(origin.startsWith('https://')).toBe(true);
        expect(origin.includes('tirupatibalaji.ap.gov.in') || origin.includes('ttdevasthanams.ap.gov.in')).toBe(true);
      }
    });
  });

  describe('4. Encrypted Backup (.spbk) & Export Security Validation', () => {
    const sampleProfiles: Profile[] = [
      {
        id: 'prof-secure',
        name: 'Tirumala Squad',
        isDefault: true,
        createdAt: new Date().toISOString(),
        pilgrims: [
          {
            id: 'pilgrim-secure-1',
            firstName: 'Govinda',
            lastName: 'Rao',
            fullName: 'Govinda Rao',
            gender: Gender.MALE,
            age: 40,
            idType: IdType.AADHAAR,
            idNumber: '987654321098',
            country: 'India',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ];

    it('creates authenticated AES-GCM-256 backup and restores correctly', async () => {
      const password = 'StrongPassword!2026';
      const backup = await createBackup(sampleProfiles, password);

      expect(backup.format).toBe('SPBK');
      expect(backup.encrypted).toBeDefined();
      expect(backup.salt).toBeDefined();
      expect(backup.iv).toBeDefined();
      expect(backup.metadata.profileCount).toBe(1);
      expect(backup.metadata.pilgrimCount).toBe(1);

      const restored = await restoreBackup(backup, password);
      expect(restored).toHaveLength(1);
      expect(restored[0].name).toBe('Tirumala Squad');
      expect(restored[0].pilgrims[0].fullName).toBe('Govinda Rao');
    });

    it('strictly rejects wrong decryption password without silent corruption', async () => {
      const backup = await createBackup(sampleProfiles, 'RealPassword123!');
      await expect(restoreBackup(backup, 'WrongPassword999!')).rejects.toThrow(
        /Cannot decrypt backup/i
      );
    });

    it('rejects malformed backup files with incompatible format header', async () => {
      const malformed = {
        format: 'JSON_DUMP',
        encrypted: 'fake',
        salt: 'fake',
        iv: 'fake',
      } as unknown as BackupFile;

      await expect(restoreBackup(malformed, 'pass')).rejects.toThrow(
        /Invalid backup file format. Expected SPBK/i
      );
    });

    it('rejects backups missing essential cryptographic components (salt/iv/ciphertext)', async () => {
      const incomplete = {
        format: 'SPBK',
        salt: 'salt123',
      } as unknown as BackupFile;

      await expect(restoreBackup(incomplete, 'pass')).rejects.toThrow(
        /Corrupted backup file: missing encryption data/i
      );
    });

    it('rejects tampered ciphertext where authentication tag fails', async () => {
      const backup = await createBackup(sampleProfiles, 'Password123!');
      const tampered: BackupFile = {
        ...backup,
        encrypted: backup.encrypted.slice(0, -6) + 'AAAAAA',
      };

      await expect(restoreBackup(tampered, 'Password123!')).rejects.toThrow(
        /Cannot decrypt backup/i
      );
    });

    it('plain JSON export produces valid unencrypted JSON without misrepresenting as encrypted', async () => {
      storageLocalMap.set(STORAGE_KEYS.PROFILES, sampleProfiles);
      storageLocalMap.set(STORAGE_KEYS.SETTINGS, { language: 'en' });

      const exported = await StorageManager.exportJsonBackup();
      expect(exported.filename).toMatch(/^seva-pilot-backup-\d{4}-\d{2}-\d{2}\.json$/);

      const parsed = JSON.parse(exported.json);
      expect(parsed.app).toBe('Tirumala SevaPilot');
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.format).toBeUndefined();
      expect(parsed.encrypted).toBeUndefined();
    });
  });
});
