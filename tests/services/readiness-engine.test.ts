import { describe, it, expect } from 'vitest';
import { ReadinessEngine } from '../../src/services/readiness-engine';
import type { Profile, Pilgrim } from '../../src/shared/types';
import { Gender, IdType } from '../../src/shared/types';

describe('ReadinessEngine', () => {
  it('returns 0 score when profile is null or undefined', () => {
    const res = ReadinessEngine.evaluate(null);
    expect(res.score).toBe(0);
    expect(res.isComplete).toBe(false);
    expect(res.checks.length).toBeGreaterThan(0);
  });

  it('evaluates incomplete profile and does NOT return 100%', () => {
    const incompletePilgrim: Pilgrim = {
      id: 'p1',
      firstName: 'Anusuri',
      lastName: '',
      fullName: 'Anusuri Chirudeep',
      gender: Gender.MALE,
      dateOfBirth: '1995-05-15',
      idType: IdType.AADHAAR,
      idNumber: '', // Missing
      mobile: '9876543210',
      country: 'India',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const profile: Profile = {
      id: 'prof1',
      name: 'Family',
      pilgrims: [incompletePilgrim],
      selectedPilgrims: {},
      isDefault: true,
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const res = ReadinessEngine.evaluate(profile);
    expect(res.score).toBeLessThan(100);
    expect(res.isComplete).toBe(false);
    expect(res.missingFields.some(f => f.includes('ID Number'))).toBe(true);
  });

  it('evaluates 100% complete and valid pilgrim record', () => {
    const validPilgrim: Pilgrim = {
      id: 'p1',
      firstName: 'Anusuri',
      lastName: 'Chirudeep',
      fullName: 'Anusuri Chirudeep',
      gender: Gender.MALE,
      dateOfBirth: '1995-05-15',
      age: 31,
      idType: IdType.AADHAAR,
      idNumber: '999999990019', // 12-digit Aadhaar
      mobile: '9876543210',
      country: 'India',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const profile: Profile = {
      id: 'prof1',
      name: 'Family',
      pilgrims: [validPilgrim],
      general: {
        mobile: '9876543210',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        country: 'India',
        pinCode: '517501',
      },
      selectedPilgrims: {},
      isDefault: true,
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const res = ReadinessEngine.evaluate(profile);
    expect(res.score).toBe(100);
    expect(res.isComplete).toBe(true);
    expect(res.isProfileReady).toBe(true);
    expect(res.isBookingReady).toBe(true);
    expect(res.readyPilgrimsCount).toBe(1);
    expect(res.missingFields.length).toBe(0);
  });

  it('separates PROFILE_READY from BOOKING_READY when general booking details are incomplete', () => {
    const validPilgrim: Pilgrim = {
      id: 'p1',
      firstName: 'Anusuri',
      lastName: 'Chirudeep',
      fullName: 'Anusuri Chirudeep',
      gender: Gender.MALE,
      dateOfBirth: '1995-05-15',
      age: 31,
      idType: IdType.AADHAAR,
      idNumber: '999999990019',
      country: 'India',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const profile: Profile = {
      id: 'prof1',
      name: 'Family',
      pilgrims: [validPilgrim],
      general: { mobile: '9876543210' }, // Missing city, state, country, pinCode
      selectedPilgrims: {},
      isDefault: true,
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const res = ReadinessEngine.evaluate(profile);
    // Profile is ready (devotee identity fields complete)
    expect(res.isProfileReady).toBe(true);
    // But Booking is NOT ready (required booking address details missing)
    expect(res.isBookingReady).toBe(false);
    expect(res.isComplete).toBe(false);
    expect(res.score).toBeLessThan(100);
    expect(res.missingFields.some(f => f.includes('Booking Details'))).toBe(true);
  });

  it('flags warning for invalid mobile number length', () => {
    const pilgrim: Pilgrim = {
      id: 'p1',
      firstName: 'Anusuri',
      lastName: 'Chirudeep',
      fullName: 'Anusuri Chirudeep',
      gender: Gender.MALE,
      age: 30,
      dateOfBirth: '1996-01-01',
      idType: IdType.PASSPORT,
      idNumber: 'A1234567',
      mobile: '123', // Invalid
      country: 'India',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const profile: Profile = {
      id: 'prof1',
      name: 'Family',
      pilgrims: [pilgrim],
      selectedPilgrims: {},
      isDefault: true,
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    };

    const res = ReadinessEngine.evaluate(profile);
    expect(res.score).toBeLessThan(100);
    expect(res.isComplete).toBe(false);
    expect(res.missingFields.some(f => f.includes('Mobile'))).toBe(true);
  });

  describe('Service-aware selection semantics', () => {
    const makePilgrim = (id: string, name: string): Pilgrim => ({
      id,
      firstName: name,
      lastName: 'Rao',
      fullName: `${name} Rao`,
      gender: Gender.MALE,
      age: 30,
      idType: IdType.AADHAAR,
      idNumber: '999999990019', // Valid Aadhaar checksum
      country: 'India',
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    });

    const pilgrims7 = Array.from({ length: 7 }, (_, i) => makePilgrim(`p${i + 1}`, `Devotee${i + 1}`));

    it('undefined selection defaults to first 6 pilgrims', () => {
      const profile: Profile = {
        id: 'prof1',
        name: 'Group',
        pilgrims: pilgrims7,
        selectedPilgrims: {}, // undefined for SED
        isDefault: true,
        createdAt: '2026-09-23T10:00:00Z',
        updatedAt: '2026-09-23T10:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'special-entry-darshan' as any);
      expect(res.readyPilgrimsCount).toBe(6);
      expect(res.pilgrimCount).toBe(6);
    });

    it('[] selection means explicitly zero pilgrims selected and never converts to all', () => {
      const profile: Profile = {
        id: 'prof1',
        name: 'Group',
        pilgrims: pilgrims7,
        selectedPilgrims: {
          ['special-entry-darshan' as any]: [],
        },

        isDefault: true,
        createdAt: '2026-09-23T10:00:00Z',
        updatedAt: '2026-09-23T10:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'special-entry-darshan' as any);
      expect(res.readyPilgrimsCount).toBe(0);
      expect(res.pilgrimCount).toBe(0);
      expect(res.isComplete).toBe(false);
      expect(res.checks.some(c => c.id === 'zero_selected')).toBe(true);
    });

    it('[ids] selection correctly evaluates only selected pilgrims and ignores deleted IDs', () => {
      const profile: Profile = {
        id: 'prof1',
        name: 'Group',
        pilgrims: [makePilgrim('p1', 'Dev1'), makePilgrim('p2', 'Dev2')],
        selectedPilgrims: {
          ['special-entry-darshan' as any]: ['p2', 'non-existent-id'],
        },

        isDefault: true,
        createdAt: '2026-09-23T10:00:00Z',
        updatedAt: '2026-09-23T10:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'special-entry-darshan' as any);
      expect(res.readyPilgrimsCount).toBe(1);
      expect(res.pilgrimCount).toBe(1);
    });

    it('caps selection to maximum 6 pilgrims even if more are in array', () => {
      const profile: Profile = {
        id: 'prof1',
        name: 'Group',
        pilgrims: pilgrims7,
        selectedPilgrims: {
          ['special-entry-darshan' as any]: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
        },

        isDefault: true,
        createdAt: '2026-09-23T10:00:00Z',
        updatedAt: '2026-09-23T10:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'special-entry-darshan' as any);
      expect(res.pilgrimCount).toBe(6);
      expect(res.readyPilgrimsCount).toBe(6);
    });

  });
});


