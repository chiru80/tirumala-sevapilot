// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ServiceIntelligence } from '../../src/services/service-intelligence';
import { calculateProfileHealth, checkPilgrimHealth } from '../../src/services/profile-health';
import { Gender, IdType, ServiceType } from '../../src/shared/types';
import type { Pilgrim, Profile } from '../../src/shared/types';

describe('Phase 5: Profiles & Pilgrim Manager Intelligence Matrix', () => {
  const readyPilgrim1: Pilgrim = {
    id: 'p1',
    firstName: 'Raghav',
    lastName: 'Sharma',
    fullName: 'Raghav Sharma',
    age: 36,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '200000000018',
    country: 'India',
    createdAt: new Date().toISOString(),
  };

  const readyPilgrim2: Pilgrim = {
    id: 'p2',
    firstName: 'Ananya',
    lastName: 'Sharma',
    fullName: 'Ananya Sharma',
    age: 32,
    gender: Gender.FEMALE,
    idType: IdType.AADHAAR,
    idNumber: '200000000026',
    country: 'India',
    createdAt: new Date().toISOString(),
  };

  const readyPilgrim3: Pilgrim = {
    id: 'p3',
    firstName: 'Karthik',
    lastName: 'Sharma',
    fullName: 'Karthik Sharma',
    age: 12,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '200000000034',
    country: 'India',
    createdAt: new Date().toISOString(),
  };

  const incompletePilgrim: Pilgrim = {
    id: 'p-inc',
    firstName: 'Incomplete',
    lastName: 'Devotee',
    fullName: 'Incomplete Devotee',
    age: 40,
    gender: Gender.MALE,
    idType: IdType.AADHAAR,
    idNumber: '', // missing ID number
    country: 'India',
    createdAt: new Date().toISOString(),
  };

  const profileMulti: Profile = {
    id: 'prof-multi',
    name: 'Sharma Family',
    isDefault: true,
    pilgrims: [incompletePilgrim, readyPilgrim1, readyPilgrim2, readyPilgrim3],
    selectedPilgrims: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    general: {
      email: 'sharma@example.com',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pinCode: '500001',
      gothram: 'Kashyapa',
    },
  };

  // ─── A. PILGRIM SELECTION RECONCILIATION ───

  describe('A. Pilgrim Selection Auto-Reconcile', () => {
    it('Homam ₹1600 strictly selects 2 devotees prioritizing ready devotees', () => {
      const selected = ServiceIntelligence.reconcilePilgrimSelection(profileMulti, 'sri-srinivasa-divyanugraha-homam');
      expect(selected).toHaveLength(2);
      // Ready pilgrims should be chosen before incomplete pilgrim
      expect(selected).toContain('p1');
      expect(selected).toContain('p2');
      expect(selected).not.toContain('p-inc');
    });

    it('Srivari Seva strictly selects 1 participant prioritizing ready devotees', () => {
      const selected = ServiceIntelligence.reconcilePilgrimSelection(profileMulti, 'srivari-seva');
      expect(selected).toHaveLength(1);
      expect(['p1', 'p2', 'p3']).toContain(selected[0]);
      expect(selected[0]).not.toBe('p-inc');
    });

    it('Special Entry Darshan ₹300 selects up to 6 devotees prioritizing ready devotees', () => {
      const selected = ServiceIntelligence.reconcilePilgrimSelection(profileMulti, 'special-entry-darshan-300');
      expect(selected).toHaveLength(4); // all 4 in profile (3 ready + 1 incomplete)
      // First 3 should be ready
      expect(selected.slice(0, 3)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
      expect(selected[3]).toBe('p-inc');
    });

    it('Padmavathi ₹200 selects up to 6 devotees', () => {
      const selected = ServiceIntelligence.reconcilePilgrimSelection(profileMulti, 'padmavathi-supadham-entry-200');
      expect(selected).toHaveLength(4);
    });

    it('handles empty profile gracefully', () => {
      const emptyProfile: Profile = {
        ...profileMulti,
        id: 'prof-empty',
        pilgrims: [],
      };
      const selected = ServiceIntelligence.reconcilePilgrimSelection(emptyProfile, 'sri-srinivasa-divyanugraha-homam');
      expect(selected).toEqual([]);
    });
  });

  // ─── B. DEVOTEE READINESS BREAKDOWN ───

  describe('B. Devotee Readiness & Checklist', () => {
    it('evaluates ready devotee as complete for SED ₹300', () => {
      const readiness = ServiceIntelligence.getDevoteeReadiness(readyPilgrim1, 'special-entry-darshan-300');
      expect(readiness.isReady).toBe(true);
      expect(readiness.missingFields).toHaveLength(0);
      expect(readiness.checklist['name']).toBe(true);
      expect(readiness.checklist['age']).toBe(true);
      expect(readiness.checklist['gender']).toBe(true);
      expect(readiness.checklist['idProofType']).toBe(true);
      expect(readiness.checklist['idProofNumber']).toBe(true);
    });

    it('identifies missing ID number on incomplete devotee', () => {
      const readiness = ServiceIntelligence.getDevoteeReadiness(incompletePilgrim, 'special-entry-darshan-300');
      expect(readiness.isReady).toBe(false);
      expect(readiness.missingFields).toContain('idProofNumber');
      expect(readiness.checklist['idProofNumber']).toBe(false);
    });

    it('identifies Srivari Seva specific required fields (DOB, Photo, Mobile, District)', () => {
      const srivariPilgrimWithoutExtras: Pilgrim = {
        ...readyPilgrim1,
        dateOfBirth: undefined,
        photo: undefined,
        mobile: undefined,
        district: undefined,
      };

      const readiness = ServiceIntelligence.getDevoteeReadiness(srivariPilgrimWithoutExtras, 'srivari-seva');
      expect(readiness.isReady).toBe(false);
      expect(readiness.missingFields).toContain('dateOfBirth');
      expect(readiness.missingFields).toContain('photo');
      expect(readiness.missingFields).toContain('mobile');
      expect(readiness.missingFields).toContain('district');
    });

    it('validates complete Srivari Seva devotee', () => {
      const completeSrivariPilgrim: Pilgrim = {
        ...readyPilgrim1,
        dateOfBirth: '1988-04-12',
        photo: 'data:image/jpeg;base64,samplephoto',
        mobile: '9876543210',
        district: 'Chittoor',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        pinCode: '517501',
        srivariSeva: {
          doorNumber: '12-3',
          street: 'Temple Road',
        },
      };

      const readiness = ServiceIntelligence.getDevoteeReadiness(completeSrivariPilgrim, 'srivari-seva');
      expect(readiness.isReady).toBe(true);
      expect(readiness.missingFields).toHaveLength(0);
    });
  });

  // ─── C. CANONICAL SERVICE-AWARE PROFILE HEALTH ───

  describe('C. Service-Aware Profile Health', () => {
    it('considers General Details automatically satisfied for Padmavathi ₹200 (no step)', () => {
      const profileNoGeneral: Profile = {
        id: 'prof-no-gen',
        name: 'Single Devotee',
        isDefault: true,
        pilgrims: [readyPilgrim1],
        selectedPilgrims: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        general: undefined, // No General Details
      };

      const health = calculateProfileHealth(profileNoGeneral, false, 'padmavathi-supadham-entry-200');
      expect(health.percentage).toBe(100);
      expect(health.generalHealth?.isReady).toBe(true);
      expect(health.generalHealth?.missingFields).toHaveLength(0);
    });

    it('considers General Details automatically satisfied for Srivari Seva (embedded in devotee)', () => {
      const profileNoGeneral: Profile = {
        id: 'prof-srivari',
        name: 'Sevak',
        isDefault: true,
        pilgrims: [readyPilgrim1],
        selectedPilgrims: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        general: undefined,
      };

      const health = calculateProfileHealth(profileNoGeneral, false, 'srivari-seva');
      expect(health.generalHealth?.isReady).toBe(true);
    });

    it('strictly checks Gothram in General Details for Homam ₹1600', () => {
      const profileWithoutGothram: Profile = {
        id: 'prof-no-gothram',
        name: 'Homam Couple',
        isDefault: true,
        pilgrims: [readyPilgrim1, readyPilgrim2],
        selectedPilgrims: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        general: {
          city: 'Hyderabad',
          state: 'Telangana',
          country: 'India',
          pinCode: '500001',
          // Gothram omitted
        },
      };

      const health = calculateProfileHealth(profileWithoutGothram, false, 'sri-srinivasa-divyanugraha-homam');
      expect(health.generalHealth?.isReady).toBe(false);
      expect(health.generalHealth?.missingFields).toContain('gothram');
    });

    it('satisfies Homam ₹1600 General Details when Gothram and address are provided', () => {
      const profileWithGothram: Profile = {
        id: 'prof-homam-ok',
        name: 'Homam Couple',
        isDefault: true,
        pilgrims: [readyPilgrim1, readyPilgrim2],
        selectedPilgrims: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        general: {
          city: 'Hyderabad',
          state: 'Telangana',
          country: 'India',
          pinCode: '500001',
          gothram: 'Kashyapa',
        },
      };

      const health = calculateProfileHealth(profileWithGothram, false, 'sri-srinivasa-divyanugraha-homam');
      expect(health.generalHealth?.isReady).toBe(true);
      expect(health.generalHealth?.missingFields).toHaveLength(0);
    });
  });
});
