// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { checkPilgrimHealth, checkGeneralHealth, calculateProfileHealth } from '../../src/services/profile-health';
import { ReadinessEngine } from '../../src/services/readiness-engine';
import { Gender, IdType, ServiceType } from '../../src/shared/types';
import type { Pilgrim, Profile } from '../../src/shared/types';

describe('Profile Health Service', () => {
  const completePilgrim: Pilgrim = {
    id: 'p1',
    firstName: 'Venkat',
    lastName: 'Rao',
    fullName: 'Venkat Rao',
    gender: Gender.MALE,
    age: 45,
    idType: IdType.AADHAAR,
    idNumber: '123456789012',
    country: 'India',
    createdAt: new Date().toISOString(),
  };

  it('validates a complete pilgrim as ready without requiring mobile', () => {
    const health = checkPilgrimHealth(completePilgrim);
    expect(health.isReady).toBe(true);
    expect(health.missingFields).toHaveLength(0);
  });

  it('identifies incomplete fields for a devotee with missing ID', () => {
    const incompletePilgrim: Pilgrim = {
      ...completePilgrim,
      idNumber: '',
    };
    const health = checkPilgrimHealth(incompletePilgrim);
    expect(health.isReady).toBe(false);
    expect(health.missingFields).toContain('idNumber');
  });

  it('evaluates age or dateOfBirth properly', () => {
    const pilgrimWithDob: Pilgrim = {
      ...completePilgrim,
      age: undefined,
      dateOfBirth: '1980-05-15',
    };
    const health = checkPilgrimHealth(pilgrimWithDob);
    expect(health.isReady).toBe(true);
  });

  it('separately validates General Details (Step 2 booking details)', () => {
    const validGeneral = {
      mobile: '9876543210',
      email: 'bhakta@example.com',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      country: 'India',
      pinCode: '517501',
    };
    const health = checkGeneralHealth(validGeneral, true);
    expect(health.isReady).toBe(true);
    expect(health.missingFields).toHaveLength(0);

    const invalidGeneral = {
      mobile: '12345', // invalid
      city: '',
      state: 'AP',
      country: 'India',
      pinCode: '123', // invalid
    };
    const incomplete = checkGeneralHealth(invalidGeneral, false);
    expect(incomplete.isReady).toBe(false);
    expect(incomplete.missingFields).toContain('mobile');
    expect(incomplete.missingFields).toContain('city');
    expect(incomplete.missingFields).toContain('pinCode');
  });

  it('calculates 100% health for a profile with all ready pilgrims', () => {
    const profile: Profile = {
      id: 'prof1',
      name: 'Family',
      isDefault: true,
      selectedPilgrims: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pilgrims: [
        completePilgrim,
        {
          ...completePilgrim,
          id: 'p2',
          firstName: 'Lakshmi',
          fullName: 'Lakshmi Rao',
          gender: Gender.FEMALE,
          age: 40,
          idNumber: '987654321098',
        },
      ],
    };

    const health = calculateProfileHealth(profile);
    expect(health.total).toBe(2);
    expect(health.ready).toBe(2);
    expect(health.incomplete).toBe(0);
    expect(health.percentage).toBe(100);
    expect(Object.keys(health.missingByField)).toHaveLength(0);
  });

  it('calculates partial percentage and aggregates missingByField', () => {
    const profile: Profile = {
      id: 'prof2',
      name: 'Group',
      isDefault: false,
      selectedPilgrims: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pilgrims: [
        completePilgrim,
        {
          ...completePilgrim,
          id: 'p2',
          fullName: '',
          firstName: '',
          lastName: '',
          idNumber: '',
        },
      ],
    };

    const health = calculateProfileHealth(profile);
    expect(health.total).toBe(2);
    expect(health.ready).toBe(1);
    expect(health.incomplete).toBe(1);
    expect(health.percentage).toBe(50);
    expect(health.missingByField['fullName']).toBe(1);
    expect(health.missingByField['idNumber']).toBe(1);
  });

  it('handles empty or null profiles safely', () => {
    expect(calculateProfileHealth(null).percentage).toBe(0);
    expect(calculateProfileHealth([]).total).toBe(0);
  });

  describe('Phase 2.1 Final Correction — Mobile Number / Readiness Model', () => {
    it('1. Complete pilgrim without mobile -> Profile Health = 100%', () => {
      const pilgrimWithoutMobile: Pilgrim = {
        ...completePilgrim,
        mobile: undefined,
      };
      const health = calculateProfileHealth([pilgrimWithoutMobile]);
      expect(health.percentage).toBe(100);
      expect(health.ready).toBe(1);
      expect(health.incomplete).toBe(0);
    });

    it('2. Complete pilgrim without email -> Profile Health = 100%', () => {
      const pilgrimWithoutEmail: Pilgrim = {
        ...completePilgrim,
        email: undefined,
      };
      const health = calculateProfileHealth([pilgrimWithoutEmail]);
      expect(health.percentage).toBe(100);
      expect(health.ready).toBe(1);
      expect(health.incomplete).toBe(0);
    });

    it('3. Complete pilgrim without mobile/email -> Profile Health = 100%', () => {
      const pilgrimWithoutMobileOrEmail: Pilgrim = {
        ...completePilgrim,
        mobile: undefined,
        email: undefined,
      };
      const health = calculateProfileHealth([pilgrimWithoutMobileOrEmail]);
      expect(health.percentage).toBe(100);
      expect(health.ready).toBe(1);
      expect(health.incomplete).toBe(0);
    });

    it('4. Missing ID number -> Profile Health < 100%', () => {
      const pilgrimMissingId: Pilgrim = {
        ...completePilgrim,
        idNumber: '',
      };
      const health = calculateProfileHealth([pilgrimMissingId]);
      expect(health.percentage).toBeLessThan(100);
      expect(health.incomplete).toBe(1);
      expect(health.missingByField['idNumber']).toBe(1);
    });

    it('5. Missing name -> Profile Health < 100%', () => {
      const pilgrimMissingName: Pilgrim = {
        ...completePilgrim,
        fullName: '',
        firstName: '',
        lastName: '',
      };
      const health = calculateProfileHealth([pilgrimMissingName]);
      expect(health.percentage).toBeLessThan(100);
      expect(health.incomplete).toBe(1);
      expect(health.missingByField['fullName']).toBe(1);
    });

    it('6. Missing gender -> Profile Health < 100%', () => {
      const pilgrimMissingGender: Pilgrim = {
        ...completePilgrim,
        gender: '' as any,
      };
      const health = calculateProfileHealth([pilgrimMissingGender]);
      expect(health.percentage).toBeLessThan(100);
      expect(health.incomplete).toBe(1);
      expect(health.missingByField['gender']).toBe(1);
    });

    it('7. Missing age/DOB -> Profile Health < 100%', () => {
      const pilgrimMissingAgeDob: Pilgrim = {
        ...completePilgrim,
        age: undefined,
        dateOfBirth: undefined,
      };
      const health = calculateProfileHealth([pilgrimMissingAgeDob]);
      expect(health.percentage).toBeLessThan(100);
      expect(health.incomplete).toBe(1);
      expect(health.missingByField['age']).toBe(1);
    });

    it('8. Missing General Details mobile -> Profile Health can still be 100%, Booking Readiness = incomplete', () => {
      const pilgrimWithoutMobile: Pilgrim = {
        ...completePilgrim,
        idNumber: '999999990019',
        mobile: undefined,
      };
      const profile: Profile = {
        id: 'prof-no-gen-mobile',
        name: 'Family',
        pilgrims: [pilgrimWithoutMobile],
        general: {
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
          // mobile intentionally omitted
        },
        selectedPilgrims: {},
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Profile Health = 100%
      const health = calculateProfileHealth(profile);
      expect(health.percentage).toBe(100);
      expect(health.ready).toBe(1);
      expect(health.incomplete).toBe(0);

      // Booking Readiness = incomplete
      const readiness = ReadinessEngine.evaluate(profile);
      expect(readiness.isComplete).toBe(false);
      expect(readiness.missingFields).toContain('General Details: Mobile number required');
      expect(readiness.checks.some(c => c.id === 'general_details' && c.status === 'warning')).toBe(true);
    });

    it('9. General mobile supplied -> Booking Readiness becomes ready when all other required fields are present', () => {
      const pilgrimWithoutMobile: Pilgrim = {
        ...completePilgrim,
        idNumber: '999999990019',
        mobile: undefined,
      };
      const profile: Profile = {
        id: 'prof-with-gen-mobile',
        name: 'Family',
        pilgrims: [pilgrimWithoutMobile],
        general: {
          mobile: '9876543210', // General mobile supplied
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
        },
        selectedPilgrims: {},
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const readiness = ReadinessEngine.evaluate(profile);
      expect(readiness.isComplete).toBe(true);
      expect(readiness.score).toBe(100);
      expect(readiness.readyPilgrimsCount).toBe(1);
      expect(readiness.missingFields).toHaveLength(0);
      expect(readiness.checks.some(c => c.id === 'general_details' && c.status === 'ready')).toBe(true);
    });

    it('10. Six pilgrims without individual mobile numbers -> all six can be selected and profile health remains complete', () => {
      const sixPilgrimsWithoutMobile: Pilgrim[] = Array.from({ length: 6 }, (_, i) => ({
        ...completePilgrim,
        id: `p${i + 1}`,
        fullName: `Devotee ${i + 1}`,
        firstName: `Devotee`,
        lastName: `${i + 1}`,
        idNumber: '999999990019',
        mobile: undefined, // No individual mobile
        email: undefined,
      }));

      const profile: Profile = {
        id: 'prof-six',
        name: 'Six Devotees Group',
        pilgrims: sixPilgrimsWithoutMobile,
        selectedPilgrims: {
          [ServiceType.DARSHAN]: sixPilgrimsWithoutMobile.map(p => p.id),
        },
        general: {
          mobile: '9876543210',
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          country: 'India',
          pinCode: '517501',
        },
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Profile Health = 100%
      const health = calculateProfileHealth(profile);
      expect(health.total).toBe(6);
      expect(health.ready).toBe(6);
      expect(health.incomplete).toBe(0);
      expect(health.percentage).toBe(100);

      // Booking Readiness evaluates all 6 selected pilgrims as ready
      const readiness = ReadinessEngine.evaluate(profile, ServiceType.DARSHAN);
      expect(readiness.pilgrimCount).toBe(6);
      expect(readiness.readyPilgrimsCount).toBe(6);
      expect(readiness.isComplete).toBe(true);
      expect(readiness.score).toBe(100);
    });
  });

  // ─── Homam-specific General Details Health ─────────────────────
  describe('Homam General Details — Gothram Required', () => {
    it('flags gothram as missing when requireGothram = true and gothram is empty', () => {
      const general = {
        mobile: '9876543210',
        email: 'devotee@example.com',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
        gothram: '',
      };
      const health = checkGeneralHealth(general, true, true);
      expect(health.isReady).toBe(false);
      expect(health.missingFields).toContain('gothram');
    });

    it('passes when gothram is provided with all other required fields', () => {
      const general = {
        mobile: '9876543210',
        email: 'devotee@example.com',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
        gothram: 'Kashyapa',
      };
      const health = checkGeneralHealth(general, true, true);
      expect(health.isReady).toBe(true);
      expect(health.missingFields).toHaveLength(0);
    });

    it('does NOT require gothram when requireGothram = false (SED-300 behavior)', () => {
      const general = {
        mobile: '9876543210',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      };
      const health = checkGeneralHealth(general, false, false);
      expect(health.isReady).toBe(true);
      expect(health.missingFields).not.toContain('gothram');
    });

    it('includes gothram in missing fields when general is null and requireGothram = true', () => {
      const health = checkGeneralHealth(null, true, true);
      expect(health.isReady).toBe(false);
      expect(health.missingFields).toContain('gothram');
      expect(health.missingFields).toContain('email');
    });
  });
});
