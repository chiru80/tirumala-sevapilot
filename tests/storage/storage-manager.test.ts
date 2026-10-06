import { describe, it, expect, beforeEach } from 'vitest';
import { Gender, IdType } from '../../src/shared/types';

const storageMap = new Map<string, any>();
(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: string | string[]) => {
        if (typeof key === 'string') {
          return { [key]: storageMap.get(key) };
        }
        const res: Record<string, any> = {};
        for (const k of key) {
          res[k] = storageMap.get(k);
        }
        return res;
      },
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) {
          storageMap.set(k, v);
        }
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

import { StorageManager } from '../../src/storage/storage-manager';
import { STORAGE_KEYS } from '../../src/shared/constants';
import type { Profile, Pilgrim } from '../../src/shared/types';

describe('StorageManager', () => {
  const mockPilgrim: Pilgrim = {
    id: 'p1',
    firstName: 'Anusuri',
    lastName: 'Chirudeep',
    fullName: 'Anusuri Chirudeep',
    gender: Gender.MALE,
    dateOfBirth: '1995-05-15',
    age: 31,
    idType: IdType.AADHAAR,
    idNumber: '999999990019',
    mobile: '9876543210',
    country: 'India',
    createdAt: '2026-09-23T10:00:00Z',
    updatedAt: '2026-09-23T10:00:00Z',
  };

  const mockProfile: Profile = {
    id: 'prof1',
    name: 'Primary Family',
    pilgrims: [mockPilgrim],
    selectedPilgrims: {},
    isDefault: true,
    createdAt: '2026-09-23T10:00:00Z',
    updatedAt: '2026-09-23T10:00:00Z',
  };

  beforeEach(() => {
    storageMap.clear();
    storageMap.set(STORAGE_KEYS.PROFILES, JSON.parse(JSON.stringify([mockProfile])));
  });

  it('retrieves pilgrims from active profile', async () => {
    const pilgrims = await StorageManager.getPilgrims();
    expect(pilgrims).toHaveLength(1);
    expect(pilgrims[0].fullName).toBe('Anusuri Chirudeep');
  });

  it('saves a new pilgrim to profile', async () => {
    const newPilgrimData = {
      firstName: 'Lakshmi',
      lastName: 'Devi',
      fullName: 'Lakshmi Devi',
      gender: Gender.FEMALE,
      age: 28,
      idType: IdType.AADHAAR,
      idNumber: '999999990020',
      mobile: '9876543211',
      country: 'India',
    };

    const saved = await StorageManager.savePilgrim('prof1', newPilgrimData);
    expect(saved.id).toBeDefined();
    expect(saved.fullName).toBe('Lakshmi Devi');

    const all = await StorageManager.getPilgrims('prof1');
    expect(all).toHaveLength(2);
  });

  it('updates an existing pilgrim', async () => {
    const updated = await StorageManager.updatePilgrim('prof1', 'p1', {
      age: 32,
    });
    expect(updated.age).toBe(32);
  });

  it('duplicates an existing pilgrim with a copy suffix', async () => {
    const copy = await StorageManager.duplicatePilgrim('prof1', 'p1');
    expect(copy.id).not.toBe('p1');
    expect(copy.fullName).toContain('(Copy)');
    const all = await StorageManager.getPilgrims('prof1');
    expect(all).toHaveLength(2);
  });

  it('deletes a pilgrim from profile', async () => {
    await StorageManager.deletePilgrim('prof1', 'p1');
    const all = await StorageManager.getPilgrims('prof1');
    expect(all).toHaveLength(0);
  });

  it('exports JSON backup cleanly with timestamped filename', async () => {
    const backup = await StorageManager.exportJsonBackup();
    expect(backup.filename).toMatch(/^seva-pilot-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(backup.json);
    expect(parsed.app).toBe('Tirumala SevaPilot');
    expect(parsed.profiles).toHaveLength(1);
    expect(parsed.settings).toBeDefined();
  });
});
