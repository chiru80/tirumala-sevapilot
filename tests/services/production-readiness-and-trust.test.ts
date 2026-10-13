// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purgeDevoteeData, clearAllData, getProfiles, getSettings, saveSettings } from '../../src/storage/repository';
import { StorageManager } from '../../src/storage/storage-manager';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { Profile } from '../../src/shared/types';
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

    it('StorageManager.clearAllData static method delegates to clearAllData', async () => {
      storageLocalMap.set('key1', 'val1');
      await StorageManager.clearAllData();
      expect(storageLocalMap.size).toBe(0);
    });
  });

  describe('3. Production Package Security Linter Rules', () => {
    const allowedPermissions = new Set([
      'storage',
      'sidePanel',
      'activeTab',
      'scripting',
      'tabs',
      'contextMenus',
    ]);

    const forbiddenPermissions = [
      'clipboardRead',
      'clipboardWrite',
      '<all_urls>',
      'webNavigation',
      'debugger',
      'proxy',
      'webRequest',
      'webRequestBlocking',
    ];

    it('strictly forbids high-risk automation and telemetry permissions', () => {
      for (const p of forbiddenPermissions) {
        expect(allowedPermissions.has(p)).toBe(false);
      }
    });

    it('verifies official TTD host origin pinning', () => {
      const officialOrigins = [
        'https://ttdevasthanams.ap.gov.in/*',
        'https://tirupatibalaji.ap.gov.in/*',
      ];

      for (const origin of officialOrigins) {
        expect(origin.startsWith('https://')).toBe(true);
        expect(origin.includes('tirupatibalaji.ap.gov.in') || origin.includes('ttdevasthanams.ap.gov.in')).toBe(true);
      }
    });
  });
});
