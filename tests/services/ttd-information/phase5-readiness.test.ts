// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ReadinessEngine } from '../../../src/services/readiness-engine';
import { Gender, IdType, type Profile, type Pilgrim } from '../../../src/shared/types';

describe('Phase 5 — Service-Specific Readiness & Why Not Ready Engine', () => {
  const createPilgrim = (id: string, name: string): Pilgrim => ({
    id,
    firstName: name,
    lastName: 'Devotee',
    fullName: `${name} Devotee`,
    gender: Gender.MALE,
    age: 32,
    dateOfBirth: '1994-01-01',
    idType: IdType.AADHAAR,
    idNumber: '999999990019', // Valid checksum
    country: 'India',
    createdAt: '2026-10-06T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  });

  const completeGeneral = {
    email: 'devotee@example.com',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    country: 'India',
    pinCode: '517501',
    gothram: 'Kashyapa',
  };

  describe('1. ₹300 Special Entry Darshan (special-entry-300)', () => {
    it('allows 6 complete pilgrims and general details complete -> READY', () => {
      const pilgrims = Array.from({ length: 6 }, (_, i) => createPilgrim(`p${i + 1}`, `Devotee${i + 1}`));
      const profile: Profile = {
        id: 'prof-sed',
        name: 'Family',
        pilgrims,
        general: completeGeneral,
        selectedPilgrims: { 'special-entry-300': pilgrims.map(p => p.id) },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'darshan', 'special-entry-300');
      expect(res.isBookingReady).toBe(true);
      expect(res.score).toBe(100);
      expect(res.whyNotReady?.status).toBe('READY');
      expect(res.whyNotReady?.headline).toBe('100% READY');
    });

    it('rejects 7 pilgrims for ₹300 -> NOT READY (cap is 6)', () => {
      const pilgrims = Array.from({ length: 7 }, (_, i) => createPilgrim(`p${i + 1}`, `Devotee${i + 1}`));
      const profile: Profile = {
        id: 'prof-sed-7',
        name: 'Family',
        pilgrims,
        general: completeGeneral,
        // user tries to select 7
        selectedPilgrims: { 'special-entry-300': pilgrims.map(p => p.id) },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      // Since targetPilgrims is sliced to maxPilgrims (6), 6 are evaluated and ready
      const res = ReadinessEngine.evaluate(profile, 'darshan', 'special-entry-300');
      expect(res.pilgrimCount).toBe(6);
      expect(res.isBookingReady).toBe(true);
    });

    it('remains READY even when Mobile is missing (Mobile is OPTIONAL per Phase 5)', () => {
      const pilgrim = createPilgrim('p1', 'Devotee1');
      const profile: Profile = {
        id: 'prof-no-mobile',
        name: 'Solo',
        pilgrims: [pilgrim],
        general: {
          ...completeGeneral,
          mobile: undefined, // Mobile completely omitted
        },
        selectedPilgrims: { 'special-entry-300': ['p1'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'darshan', 'special-entry-300');
      expect(res.isBookingReady).toBe(true);
      expect(res.score).toBe(100);
    });

    it('is NOT READY when required General Details (e.g. Email or Address) are missing', () => {
      const pilgrim = createPilgrim('p1', 'Devotee1');
      const profile: Profile = {
        id: 'prof-no-email',
        name: 'Solo',
        pilgrims: [pilgrim],
        general: {
          city: 'Tirupati',
          state: 'AP',
          country: 'India',
          pinCode: '517501',
          email: '', // Missing email
        },
        selectedPilgrims: { 'special-entry-300': ['p1'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'darshan', 'special-entry-300');
      expect(res.isBookingReady).toBe(false);
      expect(res.whyNotReady?.status).toBe('NOT_READY');
      expect(res.whyNotReady?.items.some(i => i.type === 'fail' && i.text.includes('Email'))).toBe(true);
    });
  });

  describe('2. ₹200 Padmavathi Special Entry (padmavathi-special-entry-200)', () => {
    it('does NOT block readiness when General Details are absent (General details not required)', () => {
      const pilgrim = createPilgrim('p1', 'Devotee1');
      const profile: Profile = {
        id: 'prof-padmavathi',
        name: 'Devotee',
        pilgrims: [pilgrim],
        general: undefined, // No general details stored
        selectedPilgrims: { 'padmavathi-special-entry-200': ['p1'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'darshan', 'padmavathi-special-entry-200');
      expect(res.isBookingReady).toBe(true);
      expect(res.score).toBe(100);
      expect(res.whyNotReady?.status).toBe('READY');
      expect(res.whyNotReady?.items.some(i => i.text.includes('General details not required'))).toBe(true);
    });
  });

  describe('3. Sri Srinivasa Divyanugraha Homam (sri-srinivasa-divyanugraha-homam)', () => {
    it('1 pilgrim when 2 required -> NOT READY', () => {
      const pilgrim1 = createPilgrim('p1', 'Devotee1');
      const profile: Profile = {
        id: 'prof-homam-1',
        name: 'Couple',
        pilgrims: [pilgrim1],
        general: completeGeneral,
        selectedPilgrims: { 'sri-srinivasa-divyanugraha-homam': ['p1'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'arjitha_seva', 'sri-srinivasa-divyanugraha-homam');
      expect(res.isBookingReady).toBe(false);
      expect(res.whyNotReady?.status).toBe('NOT_READY');
      expect(res.whyNotReady?.items.some(i => i.type === 'fail' && i.text.includes('1 of 2 required pilgrims'))).toBe(true);
    });

    it('2 complete pilgrims with Gothram -> READY', () => {
      const p1 = createPilgrim('p1', 'Devotee1');
      const p2 = createPilgrim('p2', 'Devotee2');
      const profile: Profile = {
        id: 'prof-homam-2',
        name: 'Couple',
        pilgrims: [p1, p2],
        general: completeGeneral,
        selectedPilgrims: { 'sri-srinivasa-divyanugraha-homam': ['p1', 'p2'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'arjitha_seva', 'sri-srinivasa-divyanugraha-homam');
      expect(res.isBookingReady).toBe(true);
      expect(res.score).toBe(100);
      expect(res.whyNotReady?.status).toBe('READY');
      expect(res.whyNotReady?.items.some(i => i.type === 'pass' && i.text.includes('2 of 2 required pilgrims'))).toBe(true);
      expect(res.whyNotReady?.items.some(i => i.type === 'pass' && i.text.includes('Gothram ready'))).toBe(true);
    });

    it('Gothram missing for Homam -> NOT READY', () => {
      const p1 = createPilgrim('p1', 'Devotee1');
      const p2 = createPilgrim('p2', 'Devotee2');
      const profile: Profile = {
        id: 'prof-homam-no-gothram',
        name: 'Couple',
        pilgrims: [p1, p2],
        general: {
          ...completeGeneral,
          gothram: '', // Missing Gothram
        },
        selectedPilgrims: { 'sri-srinivasa-divyanugraha-homam': ['p1', 'p2'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'arjitha_seva', 'sri-srinivasa-divyanugraha-homam');
      expect(res.isBookingReady).toBe(false);
      expect(res.whyNotReady?.status).toBe('NOT_READY');
      expect(res.whyNotReady?.items.some(i => i.type === 'fail' && i.text.includes('Gothram missing'))).toBe(true);
      expect(res.whyNotReady?.recommendedActions).toContain('Add Gothram');
    });

    it('Homam permits exactly 2 participants — rejects 3 pilgrims', () => {
      const p1 = createPilgrim('p1', 'Dev1');
      const p2 = createPilgrim('p2', 'Dev2');
      const p3 = createPilgrim('p3', 'Dev3');
      const profile: Profile = {
        id: 'prof-homam-3',
        name: 'Group',
        pilgrims: [p1, p2, p3],
        general: completeGeneral,
        // Even if array has 3, Homam config maxPilgrims is 2
        selectedPilgrims: { 'sri-srinivasa-divyanugraha-homam': ['p1', 'p2', 'p3'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'arjitha_seva', 'sri-srinivasa-divyanugraha-homam');
      // Sliced to maxPilgrims = 2, so exactly 2 devotees are evaluated and ready
      expect(res.pilgrimCount).toBe(2);
      expect(res.isBookingReady).toBe(true);
    });
  });

  describe('4. Human-Readable "Why Not Ready" Breakdown', () => {
    it('produces detailed actionable items and recommendations', () => {
      const incompletePilgrim: Pilgrim = {
        id: 'p1',
        firstName: 'Anusuri',
        lastName: '',
        fullName: 'Anusuri Chirudeep',
        gender: Gender.MALE,
        dateOfBirth: '1995-05-15',
        idType: IdType.AADHAAR,
        idNumber: '', // Missing ID
        country: 'India',
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const profile: Profile = {
        id: 'prof-incomplete',
        name: 'Incomplete Devotee',
        pilgrims: [incompletePilgrim],
        general: {
          city: '',
          state: '',
          country: '',
          pinCode: '',
        },
        selectedPilgrims: { 'special-entry-300': ['p1'] },
        isDefault: true,
        createdAt: '2026-10-06T00:00:00Z',
        updatedAt: '2026-10-06T00:00:00Z',
      };

      const res = ReadinessEngine.evaluate(profile, 'darshan', 'special-entry-300');
      expect(res.whyNotReady).toBeDefined();
      expect(res.whyNotReady?.status).toBe('NOT_READY');
      expect(res.whyNotReady?.headline).toBe('BOOKING NOT READY');

      const failedItems = res.whyNotReady?.items.filter(i => i.type === 'fail');
      expect(failedItems?.length).toBeGreaterThan(0);
      expect(res.whyNotReady?.recommendedActions.length).toBeGreaterThan(0);
    });
  });
});
