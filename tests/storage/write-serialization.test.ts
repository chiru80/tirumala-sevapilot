import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProfile,
  updateGeneralDetails,
  addPilgrim,
  getProfile,
  clearAllData,
} from '../../src/storage/repository';
import { Gender, IdType } from '../../src/shared/types';

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
        // Introduce small async delay to test race condition resilience
        await new Promise(r => setTimeout(r, 5));
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

describe('Storage Write Serialization (P2)', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('prevents lost updates when general details update and pilgrim add occur concurrently', async () => {
    const profile = await createProfile('Concurrency Test Profile');

    // Launch concurrent mutations simultaneously
    await Promise.all([
      updateGeneralDetails(profile.id, {
        mobile: '9876543210',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      }),
      addPilgrim(profile.id, {
        firstName: 'Venkatesh',
        lastName: 'Prasad',
        fullName: 'Venkatesh Prasad',
        gender: Gender.MALE,
        idType: IdType.AADHAAR,
        idNumber: '998877665544',
        country: 'India',
      }),
    ]);

    // Read back final stored profile
    const finalProfile = await getProfile(profile.id);
    expect(finalProfile).toBeDefined();

    // Verify BOTH concurrent updates were preserved without lost updates!
    expect(finalProfile?.general?.city).toBe('Tirupati');
    expect(finalProfile?.general?.mobile).toBe('9876543210');
    expect(finalProfile?.pilgrims.length).toBe(1);
    expect(finalProfile?.pilgrims[0].fullName).toBe('Venkatesh Prasad');
  });
});
