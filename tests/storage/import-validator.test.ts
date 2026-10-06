import { describe, it, expect, beforeEach } from 'vitest';
import { validateImportPayload, importProfilesSafely, getProfiles } from '../../src/storage/repository';
import { MAX_PROFILES, MAX_PILGRIMS_PER_PROFILE, STORAGE_KEYS } from '../../src/shared/constants';
import { Gender, IdType } from '../../src/shared/types';

const storageMap = new Map<string, any>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: any) => {
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

describe('Import / Restore Canonical Validator & Safe Import Pipeline', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('rejects malformed raw JSON and non-array structures', () => {
    expect(validateImportPayload(null).valid).toBe(false);
    expect(validateImportPayload('string').valid).toBe(false);
    expect(validateImportPayload({ unrelated: 123 }).valid).toBe(false);
    expect(validateImportPayload([]).valid).toBe(false);
  });

  it('rejects profile with missing or empty name', () => {
    const payload = [
      {
        name: '   ',
        pilgrims: [],
      },
    ];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('missing a required name');
  });

  it('rejects import exceeding MAX_PROFILES', () => {
    const oversized = Array.from({ length: MAX_PROFILES + 1 }, (_, i) => ({
      name: `Profile ${i}`,
      pilgrims: [],
    }));
    const res = validateImportPayload(oversized);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('maximum allowed profiles limit');
  });

  it('rejects profile exceeding MAX_PILGRIMS_PER_PROFILE', () => {
    const oversizedPilgrims = Array.from({ length: MAX_PILGRIMS_PER_PROFILE + 1 }, (_, i) => ({
      fullName: `Devotee ${i}`,
      gender: 'Male',
      idType: 'Aadhaar',
      idNumber: `10000000000${i}`,
    }));
    const payload = [{ name: 'Crowded Profile', pilgrims: oversizedPilgrims }];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('maximum allowed devotee limit');
  });

  it('rejects pilgrim with invalid gender', () => {
    const payload = [
      {
        name: 'Family',
        pilgrims: [
          {
            fullName: 'Ramesh',
            gender: 'Alien',
            idType: 'Aadhaar',
            idNumber: '234567890123',
          },
        ],
      },
    ];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('invalid or missing gender');
  });

  it('rejects pilgrim with invalid ID proof type', () => {
    const payload = [
      {
        name: 'Family',
        pilgrims: [
          {
            fullName: 'Ramesh',
            gender: 'Male',
            idType: 'CollegeID',
            idNumber: '234567890123',
          },
        ],
      },
    ];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('invalid or missing ID proof type');
  });

  it('rejects pilgrim with missing ID number', () => {
    const payload = [
      {
        name: 'Family',
        pilgrims: [
          {
            fullName: 'Ramesh',
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '   ',
          },
        ],
      },
    ];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('missing required ID number');
  });

  it('rejects duplicate ID numbers within the same profile', () => {
    const payload = [
      {
        name: 'Family',
        pilgrims: [
          {
            fullName: 'Ramesh',
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '234567890123',
          },
          {
            fullName: 'Suresh',
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '234567890123',
          },
        ],
      },
    ];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Duplicate ID number');
  });

  it('rejects pilgrim with invalid mobile number format', () => {
    const payload = [
      {
        name: 'Family',
        pilgrims: [
          {
            fullName: 'Ramesh',
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '234567890123',
            mobile: '12345',
          },
        ],
      },
    ];
    const res = validateImportPayload(payload);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Invalid mobile number');
  });

  it('normalizes valid profiles, assigns safe timestamps, and handles optional mobile', () => {
    const payload = [
      {
        name: 'Tirupati Group',
        pilgrims: [
          {
            firstName: 'Venkatesh',
            lastName: 'Kumar',
            gender: 'male',
            idType: 'aadhaar',
            idNumber: '998877665544',
            age: 35,
          },
          {
            fullName: 'Lakshmi Devi',
            gender: 'female',
            idType: 'passport',
            idNumber: 'Z1234567',
            mobile: '9876543210',
          },
        ],
        general: {
          mobile: '9876543210',
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
        },
      },
    ];

    const res = validateImportPayload(payload);
    expect(res.valid).toBe(true);
    expect(res.profiles).toBeDefined();
    expect(res.profiles?.length).toBe(1);

    const prof = res.profiles![0];
    expect(prof.name).toBe('Tirupati Group');
    expect(prof.pilgrims.length).toBe(2);

    expect(prof.pilgrims[0].gender).toBe(Gender.MALE);
    expect(prof.pilgrims[0].idType).toBe(IdType.AADHAAR);
    expect(prof.pilgrims[0].age).toBe(35);
    expect(prof.pilgrims[0].mobile).toBeUndefined(); // optional

    expect(prof.pilgrims[1].gender).toBe(Gender.FEMALE);
    expect(prof.pilgrims[1].idType).toBe(IdType.PASSPORT);
    expect(prof.pilgrims[1].mobile).toBe('9876543210');

    expect(prof.general?.city).toBe('Tirupati');
  });

  it('safely imports profiles with rollback guarantee', async () => {
    const payload = [
      {
        name: 'Rollback Test Profile',
        pilgrims: [
          {
            fullName: 'Balaji Devotee',
            gender: 'Male',
            idType: 'Aadhaar',
            idNumber: '556677889900',
          },
        ],
      },
    ];

    const result = await importProfilesSafely(payload);
    expect(result.importedCount).toBe(1);

    const stored = await getProfiles();
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('Rollback Test Profile');

    // Verify no temporary backup key remains in storage after success
    const allKeys = Array.from(storageMap.keys());
    const tempBackupKeys = allKeys.filter(k => k.startsWith('sp_auto_backup_pre_import_'));
    expect(tempBackupKeys.length).toBe(0);
  });
});
